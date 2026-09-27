import "server-only";

import type { GenerationRow } from "@/lib/db/types";
import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/schemas";

/**
 * Loads a generation through the user's RLS-scoped client. Returns 404 for rows
 * owned by other users (indistinguishable from non-existent — prevents IDOR probing).
 */
export async function loadOwnedGeneration(id: string): Promise<GenerationRow> {
  if (!uuidSchema.safeParse(id).success) throw new AppError("not_found", "Generation not found.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("generations").select("*").eq("id", id).maybeSingle();
  if (error) throw new AppError("internal", "Could not load the generation.", { cause: error });
  if (!data) throw new AppError("not_found", "Generation not found.");
  return data;
}

export function publicGeneration(row: GenerationRow, extras: { videoUrl?: string | null } = {}) {
  return {
    id: row.id,
    status: row.status,
    progress: row.progress,
    errorMessage: row.error_message,
    completedAt: row.completed_at,
    videoUrl: extras.videoUrl ?? null,
  };
}
