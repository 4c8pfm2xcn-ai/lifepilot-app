"use client";
import { useCallback } from "react";
import { useData } from "@/providers/data-provider";
import { useToast } from "@/components/ui/toast";
import { useSnapshotSource } from "./use-snapshot";
import { ApiError, blobToBase64, postApi } from "@/lib/client-api";
import { extFor, validateImageFile } from "@/lib/files";
import { dueFromParts, localDate, localTimeZone } from "@/lib/time";
import type { ContentType, ExtractedItem, Extraction, InboxItem } from "@/lib/types";

async function compressForUpload(file: File): Promise<Blob> {
  // Downscale very large screenshots before sending to the AI (keeps requests fast).
  if (file.size < 1.5 * 1024 * 1024 || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.88));
}

/** Everything that turns raw captures into organized records. */
export function useCapture() {
  const data = useData();
  const { toast } = useToast();
  const src = useSnapshotSource();
  const { store, createInboxItem, updateInboxItem, createTask, createEvent, peek, profile } = data;

  const process = useCallback(
    async (item: InboxItem, image?: Blob | null) => {
      await updateInboxItem(item.id, { processing_status: "processing", error: null });
      try {
        let img: { data: string; media_type: string } | null = null;
        if (item.content_type === "image") {
          let blob = image ?? null;
          if (!blob && item.attachment_url && store) {
            const url = await store.resolveAttachment(item.attachment_url);
            if (url) blob = await (await fetch(url)).blob();
          }
          if (blob) img = { data: await blobToBase64(blob), media_type: blob.type || "image/jpeg" };
        }
        const res = await postApi<{ extraction: Extraction }>("/api/ai/extract", { text: item.original_content, contentType: item.content_type, image: img }, src);
        const ex = res.extraction;
        const status = ex.items.length ? "needs_review" : "processed";
        await updateInboxItem(item.id, { extracted_data: ex, processing_status: status, resolution: ex.items.length ? null : "note", error: null });
        return ex;
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Processing failed.";
        await updateInboxItem(item.id, { processing_status: "failed", error: msg });
        return null;
      }
    },
    [store, updateInboxItem, src],
  );

  const capture = useCallback(
    async (input: { text: string; contentType: ContentType; file?: File | null }) => {
      let attachment: string | null = null;
      let blob: Blob | null = null;
      if (input.file) {
        const err = validateImageFile(input.file);
        if (err) {
          toast(err, { tone: "error" });
          return null;
        }
        blob = await compressForUpload(input.file);
        try {
          attachment = await store!.uploadAttachment(input.file, extFor(input.file.type));
        } catch (e) {
          toast(e instanceof Error ? e.message : "Couldn't save the image.", { tone: "error" });
          return null;
        }
      }
      const auto = profile?.preferences.ai_auto_process ?? true;
      const item = await createInboxItem({ original_content: input.text.trim(), content_type: input.contentType, attachment_url: attachment, processing_status: auto ? "processing" : "pending" });
      if (!item) return null;
      if (auto) void process(item, blob);
      return item;
    },
    [store, createInboxItem, process, toast, profile],
  );

  const patchExtracted = useCallback(
    async (inboxId: string, itemId: string, patch: Partial<ExtractedItem>) => {
      const inbox = peek("inbox_items", inboxId);
      if (!inbox?.extracted_data) return;
      const items = inbox.extracted_data.items.map((x) => (x.id === itemId ? { ...x, ...patch } : x));
      const unresolved = items.some((x) => x.status === "pending");
      const anyAccepted = items.some((x) => x.status === "accepted" && x.created_id);
      await updateInboxItem(inboxId, {
        extracted_data: { ...inbox.extracted_data, items },
        processing_status: unresolved ? "needs_review" : "processed",
        resolution: unresolved ? null : anyAccepted ? "organized" : items.some((x) => x.status === "accepted") ? "note" : "dismissed",
      });
    },
    [peek, updateInboxItem],
  );

  /** Convert an extracted item into a task/event (or keep it as a note on the capture). */
  const accept = useCallback(
    async (inbox: InboxItem, item: ExtractedItem, as: "task" | "event" | "note"): Promise<boolean> => {
      if (as === "note") {
        await patchExtracted(inbox.id, item.id, { status: "accepted", kind: item.kind === "idea" ? "idea" : "note", created_id: null });
        return true;
      }
      if (as === "task") {
        const due = item.date && (item.has_deadline || item.kind === "task") ? dueFromParts(item.date, item.time) : { due_at: null, due_all_day: false };
        const task = await createTask({
          title: item.title,
          description: item.description,
          category: item.category,
          priority: item.priority,
          estimated_minutes: item.estimated_minutes,
          ...due,
          source_inbox_id: inbox.id,
        });
        if (!task) return false;
        await patchExtracted(inbox.id, item.id, { status: "accepted", kind: "task", created_id: task.id });
        return true;
      }
      if (!item.date || !item.time) {
        toast("Add a date and start time to create an event.", { tone: "error" });
        return false;
      }
      const start = localDate(item.date, item.time);
      const end = item.end_time && item.end_time > item.time ? localDate(item.date, item.end_time) : new Date(start.getTime() + (item.estimated_minutes ?? 60) * 60000);
      const ev = await createEvent({ title: item.title, description: item.description, start_at: start.toISOString(), end_at: end.toISOString(), timezone: localTimeZone() });
      if (!ev) return false;
      await patchExtracted(inbox.id, item.id, { status: "accepted", kind: "event", created_id: ev.id });
      return true;
    },
    [createTask, createEvent, patchExtracted, toast],
  );

  const acceptAll = useCallback(
    async (inbox: InboxItem) => {
      const pending = inbox.extracted_data?.items.filter((i) => i.status === "pending") ?? [];
      // sequential: patchExtracted reads the latest row each time
      let created = 0;
      for (const item of pending) {
        const as = item.kind === "task" ? "task" : item.kind === "event" && item.date && item.time ? "event" : item.kind === "event" ? "task" : "note";
        if (await accept(inbox, item, as)) created += as === "note" ? 0 : 1;
      }
      if (created) toast(`Added ${created} item${created === 1 ? "" : "s"} to your plan`, { tone: "success" });
    },
    [accept, toast],
  );

  const dismiss = useCallback((inbox: InboxItem, item: ExtractedItem) => patchExtracted(inbox.id, item.id, { status: "dismissed" }), [patchExtracted]);

  const keepAsNote = useCallback(
    (inbox: InboxItem) =>
      updateInboxItem(inbox.id, {
        processing_status: "processed",
        resolution: "note",
        extracted_data: inbox.extracted_data ? { ...inbox.extracted_data, items: inbox.extracted_data.items.map((x) => (x.status === "pending" ? { ...x, status: "dismissed" as const } : x)) } : { summary: "Kept as a note.", items: [], source: "manual", processed_at: new Date().toISOString() },
      }),
    [updateInboxItem],
  );

  return { capture, process, accept, acceptAll, dismiss, patchExtracted, keepAsNote };
}
