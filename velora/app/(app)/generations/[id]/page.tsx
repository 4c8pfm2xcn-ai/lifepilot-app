import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GenerationActions } from "@/components/generation/generation-actions";
import { GenerationProgress } from "@/components/generation/generation-progress";
import { formatDateTime } from "@/components/ui/format";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { VideoPlayer } from "@/components/video/video-player";
import { getGeneration, listProjectOptions } from "@/lib/data/queries";
import { styleLabel } from "@/lib/generations/service";
import { CAMERA_MOVEMENTS, type CameraMovement } from "@/lib/prompts/directions";
import { uuidSchema } from "@/lib/validation/schemas";
import { findModel, findProviderDefinition } from "@/lib/video/catalog";

export const metadata: Metadata = { title: "Generation" };

export default async function GenerationPage(props: PageProps<"/generations/[id]">) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const [generation, projects] = await Promise.all([getGeneration(id), listProjectOptions()]);
  if (!generation) notFound();

  const provider = findProviderDefinition(generation.provider);
  const model = findModel(generation.provider, generation.model);
  const active = generation.status === "queued" || generation.status === "processing";
  const project = projects.find((p) => p.id === generation.project_id);
  const camera = generation.camera_movement && generation.camera_movement in CAMERA_MOVEMENTS
    ? CAMERA_MOVEMENTS[generation.camera_movement as CameraMovement].label
    : null;

  const details: [string, string | null][] = [
    ["Created", formatDateTime(generation.created_at)],
    ["Completed", generation.completed_at ? formatDateTime(generation.completed_at) : null],
    ["Duration", `${generation.duration} seconds`],
    ["Aspect ratio", generation.aspect_ratio],
    ["Model", `${model?.displayName ?? generation.model} · ${provider?.displayName ?? generation.provider}`],
    ["Mode", generation.mode === "image_to_video" ? "Image to video" : "Text to video"],
    ["Style", styleLabel(generation.style)],
    ["Camera", camera],
    ["Credits", String(generation.credits_charged)],
    ["Project", project?.name ?? null],
  ];

  return (
    <div className="animate-fade-up">
      <nav className="mb-5 text-sm text-fog-500" aria-label="Breadcrumb">
        <Link href="/library" className="hover:text-fog-200">
          Library
        </Link>
        <span className="mx-2 text-fog-600">/</span>
        <span className="text-fog-200">Generation</span>
      </nav>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {active ? (
            <GenerationProgress id={generation.id} initialStatus={generation.status} initialProgress={generation.progress} createdAt={generation.created_at} />
          ) : generation.status === "completed" && generation.videoUrl ? (
            <VideoPlayer src={generation.videoUrl} poster={generation.posterUrl} label={`Generated video: ${generation.prompt}`} />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center rounded-3xl border hairline bg-ink-900 px-6 text-center">
              <StatusBadge status={generation.status} />
              <p className="mt-4 font-display text-3xl text-fog-50">
                {generation.status === "cancelled" ? "Generation cancelled" : generation.status === "completed" ? "Video unavailable" : "Generation failed"}
              </p>
              <p className="mt-2 max-w-md text-sm text-fog-400">
                {generation.error_message ??
                  (generation.status === "cancelled" ? "This generation was cancelled and your credits were refunded." : "No video was produced.")}
              </p>
            </div>
          )}

          <GenerationActions
            id={generation.id}
            status={generation.status}
            isFavorite={generation.isFavorite}
            projectId={generation.project_id}
            projects={projects}
          />

          <section className="surface rounded-2xl p-5">
            <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-fog-500">Prompt</h2>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-fog-50">{generation.prompt}</p>
            {generation.final_prompt !== generation.prompt ? (
              <details className="mt-4 border-t hairline pt-4">
                <summary className="cursor-pointer text-sm text-fog-400 hover:text-fog-200">Prompt sent to the model</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fog-200">{generation.final_prompt}</p>
              </details>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="surface rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-fog-200">Details</h2>
              <StatusBadge status={generation.status} />
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              {details
                .filter((d): d is [string, string] => Boolean(d[1]))
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-fog-500">{k}</dt>
                    <dd className="text-right text-fog-200">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>
          {generation.posterUrl ? (
            <section className="surface overflow-hidden rounded-2xl">
              <h2 className="px-5 pt-4 text-xs font-medium uppercase tracking-[0.14em] text-fog-500">Reference image</h2>
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img src={generation.posterUrl} alt="Reference image used for this generation" className="mt-3 w-full object-cover" loading="lazy" />
            </section>
          ) : null}
          {generation.status === "failed" ? (
            <Notice tone="info">Credits for failed generations are refunded automatically. See Settings → Credits for your history.</Notice>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
