import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { loadOwnedGeneration } from "@/lib/generations/access";
import { jsonError } from "@/lib/http";
import { BUCKETS, createSignedUrl } from "@/lib/storage";

/** Redirects to a short-lived signed download URL for the user's own completed video. */
export async function GET(_request: Request, ctx: RouteContext<"/api/generation/[id]/download">) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const row = await loadOwnedGeneration(id);
    if (row.status !== "completed" || !row.output_video_url) throw new AppError("not_found", "This video is not available.");
    const url = await createSignedUrl(BUCKETS.generatedVideos, row.output_video_url, 120, `velora-${row.id.slice(0, 8)}.mp4`);
    if (!url) throw new AppError("internal", "Could not prepare the download.");
    return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "api.generation.download");
  }
}
