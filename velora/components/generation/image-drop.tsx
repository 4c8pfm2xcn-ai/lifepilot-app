"use client";

/* eslint-disable @next/next/no-img-element -- previews are local object URLs / short-lived signed URLs */

import { useCallback, useId, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { ImageIcon, XIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { apiFetch } from "@/lib/client/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

export interface UploadedImage {
  path: string;
  previewUrl: string;
}

type UploadState = { kind: "idle" } | { kind: "uploading"; previewUrl: string } | { kind: "error"; message: string };

export function ImageDrop({
  value,
  onChange,
  disabled,
}: {
  value: UploadedImage | null;
  onChange: (value: UploadedImage | null) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (!ACCEPT.includes(file.type as (typeof ACCEPT)[number])) {
        setState({ kind: "error", message: "Use a JPG, PNG or WebP image." });
        return;
      }
      if (file.size > MAX_BYTES) {
        setState({ kind: "error", message: "Images must be 5 MB or smaller." });
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setState({ kind: "uploading", previewUrl });
      try {
        const signed = await apiFetch<{ bucket: string; path: string; token: string }>("/api/uploads", {
          method: "POST",
          json: { purpose: "input", contentType: file.type, size: file.size, fileName: file.name.slice(0, 200) },
        });
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.storage
          .from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
        if (error) throw new Error("Upload failed. Please try again.");
        onChange({ path: signed.path, previewUrl });
        setState({ kind: "idle" });
      } catch (error) {
        URL.revokeObjectURL(previewUrl);
        setState({ kind: "error", message: error instanceof Error ? error.message : "Upload failed." });
      }
    },
    [onChange],
  );

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void upload(file);
  };

  const preview = value?.previewUrl ?? (state.kind === "uploading" ? state.previewUrl : null);

  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-2xl border hairline bg-ink-900">
        <img src={preview} alt="Reference image preview" className="max-h-64 w-full object-contain" />
        {state.kind === "uploading" ? (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/60 backdrop-blur-sm">
            <span className="flex items-center gap-2 text-sm text-fog-200">
              <Spinner size={16} /> Uploading…
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="absolute right-2 top-2 rounded-full bg-ink-950/80 p-1.5 text-fog-200 backdrop-blur hover:text-fog-50"
            aria-label="Remove reference image"
          >
            <XIcon size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-7 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-aurora-violet",
          dragging ? "border-aurora-violet/70 bg-aurora-violet/[0.06]" : "border-white/[0.12] hover:border-white/25 hover:bg-white/[0.02]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <ImageIcon size={22} className="text-fog-500" />
        <span className="text-sm text-fog-200">Add a reference image</span>
        <span className="text-xs text-fog-500">Optional · JPG, PNG or WebP · up to 5 MB · used as the first frame</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT.join(",")}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {state.kind === "error" ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
