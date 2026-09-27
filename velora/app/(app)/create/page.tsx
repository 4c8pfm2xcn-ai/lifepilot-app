import type { Metadata } from "next";

import { CreateForm, type CreateFormInitial } from "@/components/generation/create-form";
import { PageHeader } from "@/components/ui/card";
import { MissingEnvNotice } from "@/components/ui/notice";
import { getCreditBalance, getGeneration, listProjectOptions } from "@/lib/data/queries";
import { decodeStyle } from "@/lib/generations/service";
import { enhancerStatus } from "@/lib/prompts";
import { CAMERA_MOVEMENTS, type CameraMovement } from "@/lib/prompts/directions";
import { uuidSchema } from "@/lib/validation/schemas";
import { createPageModelOptions } from "@/lib/video/options";

export const metadata: Metadata = { title: "Create" };

export default async function CreatePage(props: PageProps<"/create">) {
  const params = await props.searchParams;
  const { models, ready, missingEnv } = createPageModelOptions();
  const enhancer = enhancerStatus();
  const [balance, projects] = await Promise.all([getCreditBalance(), listProjectOptions()]);

  // "Edit & regenerate": prefill from one of the user's own generations (RLS-scoped).
  let initial: CreateFormInitial | undefined;
  const fromId = typeof params.from === "string" && uuidSchema.safeParse(params.from).success ? params.from : null;
  if (fromId) {
    const source = await getGeneration(fromId);
    if (source) {
      const { style, customStyle } = decodeStyle(source.style);
      initial = {
        prompt: source.prompt,
        enhancedPrompt: source.enhanced_prompt,
        provider: source.provider,
        model: source.model,
        duration: source.duration,
        aspectRatio: source.aspect_ratio,
        style,
        customStyle,
        camera: source.camera_movement && source.camera_movement in CAMERA_MOVEMENTS ? (source.camera_movement as CameraMovement) : null,
        image: source.input_image_url && source.posterUrl ? { path: source.input_image_url, previewUrl: source.posterUrl } : null,
        projectId: source.project_id,
      };
    }
  }
  const projectParam = typeof params.project === "string" && uuidSchema.safeParse(params.project).success ? params.project : null;
  if (projectParam && projects.some((p) => p.id === projectParam)) initial = { ...initial, projectId: projectParam };

  return (
    <>
      <PageHeader title="Create a video" description="Describe a shot, pick your settings, and Velora will generate it." />
      {!ready ? (
        <div className="mb-6">
          <MissingEnvNotice what="Video generation" names={missingEnv} />
        </div>
      ) : null}
      <CreateForm
        key={fromId ?? "new"}
        models={models}
        providerReady={ready}
        enhancerReady={enhancer.configured}
        balance={balance}
        projects={projects}
        initial={initial}
      />
    </>
  );
}
