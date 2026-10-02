"use client";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, ClipboardPaste, FileText, Image as ImageIcon, Inbox as InboxIcon, Lightbulb, Mic, MoreHorizontal, NotebookPen, RefreshCw, Sparkles, Trash2, Type, Wand2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/app/page-header";
import { ExtractedItemRow } from "@/components/app/extracted-item";
import { SourceBadge } from "@/components/app/source-badge";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { useCapture } from "@/hooks/use-capture";
import { validateImageFile } from "@/lib/files";
import type { InboxItem } from "@/lib/types";
import { cn } from "@/lib/cn";

type Tab = "review" | "notes" | "all";

const TYPE_ICON = { text: Type, paste: ClipboardPaste, note: NotebookPen, voice: Mic, image: ImageIcon };

function needsAttention(i: InboxItem) {
  return i.processing_status === "needs_review" || i.processing_status === "pending" || i.processing_status === "processing" || i.processing_status === "failed";
}
function isNote(i: InboxItem) {
  return i.resolution === "note" || (i.extracted_data?.items.some((x) => x.status === "accepted" && !x.created_id) ?? false);
}

export function InboxScreen() {
  const { inbox_items, createInboxItem } = useData();
  const ui = useUI();
  const { capture } = useCapture();
  const { toast } = useToast();
  const params = useSearchParams();
  const focusId = params.get("item");
  const [tab, setTab] = useState<Tab>("review");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => [...inbox_items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [inbox_items]);
  const review = sorted.filter(needsAttention);
  const notes = sorted.filter(isNote);
  const list = tab === "review" ? review : tab === "notes" ? notes : sorted;

  useEffect(() => {
    if (!focusId) return;
    const item = inbox_items.find((i) => i.id === focusId);
    if (item && !needsAttention(item)) setTab("all");
    const t = window.setTimeout(() => document.getElementById(`inbox-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const submit = async (contentType: "text" | "paste" = "text") => {
    if (!text.trim()) return;
    setBusy(true);
    const item = await capture({ text, contentType });
    setBusy(false);
    if (item) {
      setText("");
      setTab("review");
    }
  };

  const saveNote = async () => {
    if (!text.trim()) return;
    const item = await createInboxItem({
      original_content: text.trim(),
      content_type: "note",
      processing_status: "processed",
      resolution: "note",
      extracted_data: { summary: "Saved as a quick note.", items: [], source: "manual", processed_at: new Date().toISOString() },
    });
    if (item) {
      setText("");
      toast("Note saved", { tone: "success" });
    }
  };

  const paste = async () => {
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          const imgType = it.types.find((t) => t.startsWith("image/"));
          if (imgType) {
            const blob = await it.getType(imgType);
            const file = new File([blob], `pasted.${imgType.split("/")[1]}`, { type: imgType });
            await capture({ text, contentType: "image", file });
            setText("");
            return;
          }
        }
      }
      const clip = await navigator.clipboard.readText();
      if (clip) setText((t) => (t ? `${t}\n${clip}` : clip));
      else toast("Your clipboard is empty.");
    } catch {
      toast("Clipboard access was blocked — paste with ⌘/Ctrl + V instead.", { tone: "error" });
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const err = validateImageFile(f);
    if (err) {
      toast(err, { tone: "error" });
      return;
    }
    setBusy(true);
    await capture({ text, contentType: "image", file: f });
    setBusy(false);
    setText("");
    setTab("review");
  };

  return (
    <div>
      <PageHeader title="Inbox" subtitle="Capture first, decide later. DAYZERO works out what each thing means." />

      <section className="card mb-6 p-3" aria-label="New capture">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={(e) => {
            const img = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
            if (img) {
              e.preventDefault();
              onFile(img);
            }
          }}
          rows={3}
          maxLength={20000}
          aria-label="Capture text"
          placeholder="Paste a text message, an email, a to-do list… or just type what's on your mind."
          className="w-full resize-none bg-transparent px-1.5 py-1 text-[15px] leading-relaxed placeholder:text-subtle focus:outline-none"
          data-testid="inbox-input"
        />
        <div className="flex flex-wrap items-center gap-1 border-t border-line pt-2">
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImageIcon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Screenshot</span>
          </Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" aria-label="Upload screenshot" data-testid="inbox-file" onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ""))} />
          <Button size="sm" variant="ghost" onClick={() => ui.openCapture("voice")}>
            <Mic className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Voice</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={paste}>
            <ClipboardPaste className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Paste</span>
          </Button>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" variant="outline" onClick={saveNote} disabled={!text.trim()}>
              <NotebookPen className="h-3.5 w-3.5" /> Quick note
            </Button>
            <Button size="sm" variant="primary" onClick={() => submit()} disabled={!text.trim()} loading={busy} data-testid="inbox-submit">
              <Wand2 className="h-3.5 w-3.5" /> Organize
            </Button>
          </div>
        </div>
      </section>

      <div className="mb-4">
        <Segmented
          label="Inbox filter"
          value={tab}
          onChange={setTab}
          options={[
            { value: "review", label: "To review", count: review.length },
            { value: "notes", label: "Notes & ideas", count: notes.length },
            { value: "all", label: "All", count: sorted.length },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={tab === "notes" ? Lightbulb : InboxIcon}
            title={tab === "review" ? (sorted.length ? "Inbox zero" : "Nothing captured yet") : tab === "notes" ? "No notes or ideas yet" : "Nothing captured yet"}
            description={tab === "review" ? (sorted.length ? "Everything you've captured has been organized." : "Paste a message, upload a screenshot or record a voice note above. DAYZERO will find the tasks, dates and events in it.") : "Items you keep as notes or ideas will live here."}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((i) => (
            <InboxCard key={i.id} item={i} highlight={i.id === focusId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxCard({ item, highlight }: { item: InboxItem; highlight: boolean }) {
  const { store, deleteInboxItem } = useData();
  const ui = useUI();
  const router = useRouter();
  const { process, accept, acceptAll, dismiss, patchExtracted, keepAsNote } = useCapture();
  const [img, setImg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICON[item.content_type] ?? FileText;
  const ex = item.extracted_data;
  const pending = ex?.items.filter((x) => x.status === "pending") ?? [];

  useEffect(() => {
    let alive = true;
    if (item.attachment_url && store) store.resolveAttachment(item.attachment_url).then((u) => alive && setImg(u));
    return () => {
      alive = false;
    };
  }, [item.attachment_url, store]);

  const status = (() => {
    switch (item.processing_status) {
      case "processing":
        return (
          <Badge tone="accent">
            <Spinner className="h-3 w-3" /> Organizing
          </Badge>
        );
      case "needs_review":
        return <Badge tone="warning">Needs review</Badge>;
      case "failed":
        return <Badge tone="danger">Failed</Badge>;
      case "pending":
        return <Badge>Not processed</Badge>;
      default:
        return item.resolution === "note" ? <Badge>Note</Badge> : item.resolution === "dismissed" ? <Badge>Dismissed</Badge> : <Badge tone="success">Organized</Badge>;
    }
  })();

  const long = item.original_content.length > 280;

  return (
    <li id={`inbox-${item.id}`} className={cn("card overflow-hidden transition-shadow", highlight && "ring-2 ring-accent/40")} data-testid="inbox-item">
      <div className="flex items-start gap-3 p-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-elevated text-muted">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {status}
            <SourceBadge source={ex?.source} />
            <span className="text-2xs text-subtle" title={new Date(item.created_at).toLocaleString()}>
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </span>
          </div>
          {item.original_content && (
            <p className={cn("mt-2 whitespace-pre-wrap break-words text-sm text-fg/90", !expanded && long && "line-clamp-4")}>{item.original_content}</p>
          )}
          {long && (
            <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-xs text-muted hover:text-fg">
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="Captured screenshot" className="mt-3 max-h-56 rounded-lg border border-line object-contain" />
          )}
          {ex?.summary && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
              {ex.summary}
            </p>
          )}
          {ex?.notice && <p className="mt-1.5 text-2xs text-subtle">{ex.notice}</p>}
          {item.processing_status === "failed" && (
            <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle className="h-3.5 w-3.5" /> {item.error ?? "Processing failed."}
            </p>
          )}
        </div>
        <Menu
          label="Capture actions"
          items={[
            ...(item.processing_status !== "processing" ? [{ label: ex ? "Re-process" : "Process", icon: <RefreshCw className="h-3.5 w-3.5" />, onSelect: () => process(item) }] : []),
            { label: "Create task manually", icon: <FileText className="h-3.5 w-3.5" />, onSelect: () => ui.openTask({ title: item.original_content.split("\n")[0].slice(0, 120), description: item.original_content.length > 120 ? item.original_content : null, source_inbox_id: item.id }) },
            ...(item.resolution !== "note" ? [{ label: "Keep as note", icon: <NotebookPen className="h-3.5 w-3.5" />, onSelect: () => keepAsNote(item) }] : []),
            { label: "Delete", icon: <Trash2 className="h-3.5 w-3.5" />, onSelect: () => deleteInboxItem(item.id), danger: true },
          ]}
          trigger={(p) => (
            <button {...p} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-fg" aria-label="Capture actions">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        />
      </div>

      {ex && ex.items.some((x) => x.status !== "dismissed") && (
        <ul className="space-y-2 px-4 pb-4">
          {ex.items.map((x) => (
            <ExtractedItemRow
              key={x.id}
              item={x}
              onPatch={(patch) => patchExtracted(item.id, x.id, patch)}
              onAccept={(as) => accept(item, x, as)}
              onDismiss={() => dismiss(item, x)}
              onOpenCreated={() => (x.kind === "event" ? router.push("/calendar") : ui.openTask(x.created_id!))}
            />
          ))}
        </ul>
      )}

      {(pending.length > 1 || item.processing_status === "failed" || item.processing_status === "pending") && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface/50 px-4 py-2.5">
          {pending.length > 1 && (
            <Button size="sm" variant="primary" onClick={() => acceptAll(item)} data-testid="accept-all">
              Accept all {pending.length}
            </Button>
          )}
          {(item.processing_status === "failed" || item.processing_status === "pending") && (
            <Button size="sm" variant={item.processing_status === "pending" ? "primary" : "outline"} onClick={() => process(item)}>
              <RefreshCw className="h-3.5 w-3.5" /> {item.processing_status === "failed" ? "Retry" : "Organize"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => keepAsNote(item)}>
            Keep as note
          </Button>
        </div>
      )}
    </li>
  );
}
