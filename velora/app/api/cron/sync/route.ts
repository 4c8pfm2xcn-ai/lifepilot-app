import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createGenerationDeps } from "@/lib/generations/deps";
import { syncGeneration } from "@/lib/generations/service";
import { jsonError } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 300;

const BATCH_SIZE = 25;

function authorized(request: Request): boolean {
  const secret = serverEnv.cronSecret();
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Background sweep for generations whose owners closed the tab. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`. Sequential and bounded to respect provider limits.
 */
export async function GET(request: Request) {
  try {
    if (!authorized(request)) throw new AppError("unauthorized", "Unauthorized.");
    const { data, error } = await getSupabaseAdmin()
      .from("generations")
      .select("*")
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw new AppError("internal", "Could not load generations.", { cause: error });

    const deps = createGenerationDeps();
    let synced = 0;
    for (const row of data ?? []) {
      const result = await syncGeneration(row, deps);
      if (result.synced) synced += 1;
    }
    return NextResponse.json({ checked: data?.length ?? 0, synced });
  } catch (error) {
    return jsonError(error, "api.cron.sync");
  }
}
