"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { CoinIcon, SparkIcon, WandIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { ApiRequestError, apiFetch, newIdempotencyKey } from "@/lib/client/api";
import {
  CAMERA_MOVEMENTS,
  CAMERA_MOVEMENT_IDS,
  STYLE_PRESETS,
  STYLE_PRESET_IDS,
  composeFinalPrompt,
  type CameraMovement,
  type StylePreset,
} from "@/lib/prompts/directions";
import type { GenerationMode } from "@/lib/video/types";

import { ImageDrop, type UploadedImage } from "./image-drop";
import { Segmented } from "./segmented";

export interface ModeOption {
  aspectRatios: string[];
  durations: number[];
  costs: Record<number, number>;
}

export interface ModelOption {
  provider: string;
  providerName: string;
  id: string;
  displayName: string;
  description: string;
  maxPromptLength: number;
  modes: Partial<Record<GenerationMode, ModeOption>>;
}

export interface CreateFormInitial {
  prompt?: string;
  enhancedPrompt?: string | null;
  provider?: string;
  model?: string;
  duration?: number;
  aspectRatio?: string;
  style?: StylePreset | "custom" | null;
  customStyle?: string | null;
  camera?: CameraMovement | null;
  image?: UploadedImage | null;
  projectId?: string | null;
}

const PROMPT_TIPS = [
  "Name the subject and what it does",
  "Describe the setting and time of day",
  "Mention lighting and mood",
  "Keep it to one continuous shot",
];

const MAX_USER_PROMPT = 1000;

export function CreateForm({
  models,
  providerReady,
  enhancerReady,
  balance,
  projects,
  initial,
}: {
  models: ModelOption[];
  providerReady: boolean;
  enhancerReady: boolean;
  balance: number;
  projects: { id: string; name: string }[];
  initial?: CreateFormInitial;
}) {
  const router = useRouter();
  const idempotencyKey = useRef<string>(newIdempotencyKey());

  const initialModel =
    models.find((m) => m.provider === initial?.provider && m.id === initial?.model) ?? models[0] ?? null;

  const [modelKey, setModelKey] = useState(initialModel ? `${initialModel.provider}:${initialModel.id}` : "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [enhanced, setEnhanced] = useState<string | null>(initial?.enhancedPrompt ?? null);
  const [useEnhanced, setUseEnhanced] = useState(Boolean(initial?.enhancedPrompt));
  const [image, setImage] = useState<UploadedImage | null>(initial?.image ?? null);
  const [style, setStyle] = useState<StylePreset | "custom" | null>(initial?.style ?? null);
  const [customStyle, setCustomStyle] = useState(initial?.customStyle ?? "");
  const [camera, setCamera] = useState<CameraMovement | null>(initial?.camera ?? null);
  const [projectId, setProjectId] = useState<string>(initial?.projectId ?? "");
  const [durationPick, setDurationPick] = useState<number | null>(initial?.duration ?? null);
  const [aspectPick, setAspectPick] = useState<string | null>(initial?.aspectRatio ?? null);

  const [enhancing, setEnhancing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const model = models.find((m) => `${m.provider}:${m.id}` === modelKey) ?? null;
  const mode: GenerationMode = image ? "image_to_video" : "text_to_video";
  const caps = model?.modes[mode] ?? null;

  // Derive effective selections: fall back to the first supported option when the
  // current pick isn't supported by the selected model/mode.
  const duration = caps && durationPick !== null && caps.durations.includes(durationPick) ? durationPick : (caps?.durations[0] ?? null);
  const aspectRatio = caps && aspectPick && caps.aspectRatios.includes(aspectPick) ? aspectPick : (caps?.aspectRatios[0] ?? null);
  const cost = caps && duration !== null ? (caps.costs[duration] ?? null) : null;

  const basePrompt = useEnhanced && enhanced ? enhanced : prompt;
  const finalPrompt = useMemo(
    () => (basePrompt.trim() ? composeFinalPrompt(basePrompt, { style, customStyle, camera }) : ""),
    [basePrompt, style, customStyle, camera],
  );
  const tooLong = model ? finalPrompt.length > model.maxPromptLength : false;
  const insufficient = cost !== null && cost > balance;

  const canSubmit =
    providerReady && !!model && !!caps && duration !== null && !!aspectRatio && prompt.trim().length >= 3 && !tooLong && !insufficient && !submitting;

  async function onEnhance() {
    if (!model || prompt.trim().length < 3) return;
    setEnhancing(true);
    setError(null);
    try {
      const res = await apiFetch<{ enhancedPrompt: string }>("/api/enhance", {
        method: "POST",
        json: {
          prompt,
          provider: model.provider,
          model: model.id,
          style,
          customStyle: style === "custom" ? customStyle : null,
          camera,
          hasReferenceImage: Boolean(image),
        },
      });
      setEnhanced(res.enhancedPrompt);
      setUseEnhanced(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prompt enhancement failed.");
    } finally {
      setEnhancing(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !model || duration === null || !aspectRatio) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await apiFetch<{ generationId: string }>("/api/generate", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey.current },
        json: {
          provider: model.provider,
          model: model.id,
          prompt: prompt.trim(),
          ...(useEnhanced && enhanced ? { enhancedPrompt: enhanced.trim() } : {}),
          duration,
          aspectRatio,
          style,
          customStyle: style === "custom" ? customStyle.trim() : null,
          camera,
          inputImagePath: image?.path ?? null,
          projectId: projectId || null,
        },
      });
      router.push(`/generations/${res.generationId}`);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setError(e.message);
        setFieldErrors(e.fields ?? {});
        // A definitive answer from the server: the next click is a new intent.
        // (Network errors keep the key, so retrying cannot double-charge.)
        if (e.code !== "network") idempotencyKey.current = newIdempotencyKey();
      } else {
        setError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      {/* Left: prompt + reference */}
      <div className="space-y-6">
        <section className="surface glow-ring rounded-3xl p-4 sm:p-6">
          <label htmlFor="prompt" className="mb-3 flex items-center justify-between text-sm font-medium text-fog-200">
            <span>Prompt</span>
            <span className={cn("tabular-nums text-xs", prompt.length > MAX_USER_PROMPT ? "text-danger" : "text-fog-600")}>
              {prompt.length}/{MAX_USER_PROMPT}
            </span>
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              if (useEnhanced) setUseEnhanced(false);
            }}
            maxLength={MAX_USER_PROMPT}
            rows={6}
            placeholder="Describe the video you want to create…"
            aria-invalid={Boolean(fieldErrors.prompt) || undefined}
            aria-describedby="prompt-tips"
            className="w-full resize-y rounded-2xl border-0 bg-transparent p-1 text-[17px] leading-relaxed text-fog-50 placeholder:text-fog-600 focus:outline-none sm:text-lg"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t hairline pt-4">
            <ul id="prompt-tips" className="flex flex-wrap gap-1.5" aria-label="Prompt tips">
              {PROMPT_TIPS.map((tip) => (
                <li key={tip} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] text-fog-500">
                  {tip}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onEnhance}
              loading={enhancing}
              disabled={!enhancerReady || prompt.trim().length < 3 || submitting}
              icon={<WandIcon size={15} />}
              title={enhancerReady ? "Rewrite your idea into a detailed video prompt" : "Set LLM_API_KEY on the server to enable"}
            >
              Enhance prompt
            </Button>
          </div>
          {!enhancerReady ? (
            <p className="mt-3 text-xs text-fog-600">
              Prompt enhancement is unavailable: <code className="font-mono text-fog-400">LLM_API_KEY</code> is not set on the server.
            </p>
          ) : null}
        </section>

        {enhanced ? (
          <section className="surface rounded-3xl p-4 sm:p-6 animate-fade-up" aria-labelledby="enhanced-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="enhanced-heading" className="flex items-center gap-2 text-sm font-medium text-fog-200">
                <SparkIcon size={15} className="text-aurora-violet" /> Enhanced prompt
              </h2>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-fog-400">
                <input
                  type="checkbox"
                  checked={useEnhanced}
                  onChange={(e) => setUseEnhanced(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-aurora-violet)]"
                />
                Use enhanced version
              </label>
            </div>
            <label htmlFor="enhanced" className="sr-only">
              Enhanced prompt (editable)
            </label>
            <textarea
              id="enhanced"
              value={enhanced}
              onChange={(e) => setEnhanced(e.target.value)}
              maxLength={MAX_USER_PROMPT}
              rows={5}
              className="field resize-y text-sm leading-relaxed"
            />
          </section>
        ) : null}

        <section aria-labelledby="reference-heading">
          <h2 id="reference-heading" className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-fog-500">
            Reference image
          </h2>
          <ImageDrop value={image} onChange={setImage} disabled={submitting} />
          {image && model && !model.modes.image_to_video ? (
            <p className="mt-2 text-sm text-warning">{model.displayName} does not support image-to-video.</p>
          ) : null}
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="style" className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-fog-500">
              Style
            </label>
            <select
              id="style"
              className="field"
              value={style ?? ""}
              onChange={(e) => setStyle((e.target.value || null) as StylePreset | "custom" | null)}
            >
              <option value="">No specific style</option>
              {STYLE_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {STYLE_PRESETS[id].label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            {style === "custom" ? (
              <input
                aria-label="Custom style"
                className="field mt-2"
                value={customStyle}
                maxLength={120}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="e.g. 1970s Super 8 home movie"
              />
            ) : null}
          </div>
          <div>
            <label htmlFor="camera" className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-fog-500">
              Camera movement
            </label>
            <select
              id="camera"
              className="field"
              value={camera ?? ""}
              onChange={(e) => setCamera((e.target.value || null) as CameraMovement | null)}
            >
              <option value="">Let the model decide</option>
              {CAMERA_MOVEMENT_IDS.map((id) => (
                <option key={id} value={id}>
                  {CAMERA_MOVEMENTS[id].label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-fog-600 sm:col-span-2">
            Style and camera choices are added to your prompt as directions — the provider has no separate setting for them.
          </p>
        </section>

        {finalPrompt ? (
          <details className="surface group rounded-2xl px-4 py-3 text-sm">
            <summary className="cursor-pointer select-none text-fog-400 marker:text-fog-600 hover:text-fog-200">
              Exact prompt sent to the model
              <span className={cn("ml-2 tabular-nums text-xs", tooLong ? "text-danger" : "text-fog-600")}>
                {finalPrompt.length}/{model?.maxPromptLength ?? "—"}
              </span>
            </summary>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-fog-200">{finalPrompt}</p>
          </details>
        ) : null}
      </div>

      {/* Right: settings */}
      <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
        <section className="surface space-y-6 rounded-3xl p-5">
          <div>
            <label htmlFor="model" className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-fog-500">
              Model
            </label>
            {models.length > 0 ? (
              <>
                <select id="model" className="field" value={modelKey} onChange={(e) => setModelKey(e.target.value)}>
                  {models.map((m) => (
                    <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                      {m.displayName} · {m.providerName}
                    </option>
                  ))}
                </select>
                {model ? <p className="mt-2 text-xs leading-relaxed text-fog-500">{model.description}</p> : null}
              </>
            ) : (
              <p className="text-sm text-fog-500">No video models available.</p>
            )}
          </div>

          {caps ? (
            <>
              <Segmented
                name="duration"
                label="Duration"
                value={duration}
                onChange={setDurationPick}
                columns={caps.durations.length > 2 ? "grid-cols-3" : "grid-cols-2"}
                options={caps.durations.map((d) => ({ value: d, label: `${d}s`, hint: `${caps.costs[d] ?? "?"} credits` }))}
              />
              <Segmented
                name="aspect"
                label="Aspect ratio"
                value={aspectRatio}
                onChange={setAspectPick}
                columns={caps.aspectRatios.length >= 3 ? "grid-cols-3" : "grid-cols-2"}
                options={caps.aspectRatios.map((r) => ({ value: r, label: r }))}
              />
              {mode === "text_to_video" && model?.modes.image_to_video &&
              model.modes.image_to_video.aspectRatios.length > caps.aspectRatios.length ? (
                <p className="-mt-3 text-xs text-fog-600">More aspect ratios are available when you add a reference image.</p>
              ) : null}
            </>
          ) : model ? (
            <Notice tone="warning">{model.displayName} does not support this mode.</Notice>
          ) : null}

          {projects.length > 0 ? (
            <div>
              <label htmlFor="project" className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-fog-500">
                Project
              </label>
              <select id="project" className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </section>

        <section className="surface rounded-3xl p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-fog-400">Cost</span>
            <span className="flex items-center gap-1.5 font-medium tabular-nums text-fog-50">
              <CoinIcon size={15} className="text-aurora-violet" />
              {cost ?? "—"} credits
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-fog-500">
            <span>Balance</span>
            <span className="tabular-nums">{balance.toLocaleString()} credits</span>
          </div>

          {error ? (
            <Notice tone="danger" className="mt-4">
              {error}
            </Notice>
          ) : null}
          {insufficient ? (
            <Notice tone="warning" className="mt-4">
              You need {cost} credits for this generation but have {balance}.
            </Notice>
          ) : null}
          {tooLong ? (
            <Notice tone="warning" className="mt-4">
              The prompt plus style and camera directions is too long for {model?.displayName} ({finalPrompt.length}/
              {model?.maxPromptLength}). Shorten it or remove a direction.
            </Notice>
          ) : null}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={!canSubmit} loading={submitting} icon={<SparkIcon size={16} />}>
            {submitting ? "Starting generation…" : "Generate video"}
          </Button>
          {!providerReady ? (
            <p className="mt-3 text-center text-xs text-fog-500">Generation is disabled until a video provider is configured.</p>
          ) : (
            <p className="mt-3 text-center text-xs text-fog-600">Failed generations are refunded automatically.</p>
          )}
        </section>
      </aside>
    </form>
  );
}
