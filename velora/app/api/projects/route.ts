import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertSameOrigin, jsonError, parseJsonBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectCreateSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("mutate", user.id);
    const body = await parseJsonBody(request, projectCreateSchema);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, name: body.name, description: body.description || null })
      .select("id")
      .single();
    if (error) throw new AppError("internal", "Could not create the project.", { cause: error });
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return jsonError(error, "api.projects.create");
  }
}
