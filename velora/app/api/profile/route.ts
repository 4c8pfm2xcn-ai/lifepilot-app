import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertSameOrigin, jsonError, parseJsonBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validation/schemas";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit("mutate", user.id);
    const body = await parseJsonBody(request, profileUpdateSchema);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("profiles").update({ display_name: body.displayName }).eq("user_id", user.id);
    if (error) throw new AppError("internal", "Could not update your profile.", { cause: error });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "api.profile");
  }
}
