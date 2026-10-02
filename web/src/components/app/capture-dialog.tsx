"use client";
import { CalendarPlus, CheckSquare, Image as ImageIcon, Mic, Type, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useUI, type CaptureMode } from "@/providers/ui-provider";
import { useCapture } from "@/hooks/use-capture";
import { validateImageFile } from "@/lib/files";
import { cn } from "@/lib/cn";
import { VoiceRecorder } from "./voice-recorder";

const MODES: { id: CaptureMode; label: string; icon: typeof Type }[] = [
  { id: "thought", label: "Thought", icon: Type },
  { id: "image", label: "Screenshot", icon: ImageIcon },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "task", label: "Task", icon: CheckSquare },
  { id: "event", label: "Event", icon: CalendarPlus },
];

export function CaptureDialog() {
  const ui = useUI();
  const router = useRouter();
  const { capture } = useCapture();
  const [mode, setMode] = useState<CaptureMode>("thought");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ui.capture.open) return;
    if (ui.capture.mode === "task" || ui.capture.mode === "event") {
      // Task/Event go straight to their structured editors.
      ui.closeCapture();
      if (ui.capture.mode === "task") ui.openTask();
      else ui.openEvent();
      return;
    }
    setMode(ui.capture.mode);
    setText("");
    setFile(null);
    setPreview(null);
    setFileError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.capture.open, ui.capture.mode]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    const err = validateImageFile(f);
    setFileError(err);
    setFile(err ? null : f);
    if (!err) setMode("image");
  };

  // paste screenshots directly
  useEffect(() => {
    if (!ui.capture.open) return;
    const onPaste = (e: ClipboardEvent) => {
      const img = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (img) {
        e.preventDefault();
        pickFile(img);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ui.capture.open]);

  const switchMode = (m: CaptureMode) => {
    if (m === "task" || m === "event") {
      ui.closeCapture();
      if (m === "task") ui.openTask({ title: text.trim().slice(0, 200) || undefined });
      else ui.openEvent({ title: text.trim().slice(0, 200) || undefined });
      return;
    }
    setMode(m);
    if (m === "thought") window.setTimeout(() => textRef.current?.focus(), 30);
  };

  const canSubmit = mode === "image" ? !!file : !!text.trim();

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    const item = await capture({ text, contentType: mode === "image" ? "image" : mode === "voice" ? "voice" : "text", file: mode === "image" ? file : null });
    setBusy(false);
    if (item) {
      ui.closeCapture();
      router.push(`/inbox?item=${item.id}`);
    }
  };

  return (
    <Dialog open={ui.capture.open} onClose={ui.closeCapture} title="Capture" description="Drop in anything — DAYZERO will sort out what it means." size="md" initialFocus="#capture-text">
      <div className="space-y-4">
        <div role="tablist" aria-label="Capture type" className="grid grid-cols-5 gap-1 rounded-lg border border-line bg-surface p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              type="button"
              aria-selected={mode === m.id}
              onClick={() => switchMode(m.id)}
              className={cn("flex flex-col items-center gap-1 rounded-md py-2 text-2xs font-medium transition-colors sm:flex-row sm:justify-center sm:gap-1.5 sm:text-xs", mode === m.id ? "bg-elevated text-fg shadow-soft" : "text-muted hover:text-fg")}
            >
              <m.icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              {m.label}
            </button>
          ))}
        </div>

        {mode === "voice" && <VoiceRecorder transcript={text} onTranscript={setText} />}

        {mode === "image" && (
          <div>
            {file && preview ? (
              <div className="relative overflow-hidden rounded-xl border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Selected screenshot preview" className="max-h-64 w-full object-contain" />
                <button type="button" onClick={() => setFile(null)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80" aria-label="Remove image">
                  <X className="h-4 w-4" />
                </button>
                <p className="border-t border-line px-3 py-1.5 text-2xs text-subtle">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                className={cn("flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition-colors", dragging ? "border-accent bg-accent/5" : "border-line-strong bg-surface hover:border-accent/50")}
              >
                <UploadCloud className="h-6 w-6 text-muted" />
                <span className="text-sm font-medium">Upload a screenshot or photo</span>
                <span className="text-xs text-muted">Drop, paste (⌘/Ctrl + V) or browse · PNG, JPEG, WebP, GIF · max 5 MB</span>
              </button>
            )}
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" aria-label="Choose image" data-testid="capture-file" onChange={(e) => pickFile(e.target.files?.[0])} />
            {fileError && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {fileError}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="capture-text" className="sr-only">
            {mode === "image" ? "Add context (optional)" : mode === "voice" ? "Transcript" : "What's on your mind?"}
          </label>
          <Textarea
            id="capture-text"
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            rows={mode === "thought" ? 5 : 3}
            maxLength={20000}
            placeholder={mode === "image" ? "Add context (optional)" : mode === "voice" ? "Your transcript appears here — edit anything before saving" : "Type or paste anything… “Chemistry homework due Thursday, call the supplier Friday”"}
            className="text-[15px]"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="hidden text-xs text-subtle sm:block">
            <Kbd>⌘</Kbd> <Kbd>↵</Kbd> to save
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={ui.closeCapture}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={!canSubmit} loading={busy} data-testid="capture-submit">
              Capture
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
