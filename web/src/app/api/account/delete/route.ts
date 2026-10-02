import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, SUPABASE_URL } from "@/lib/config";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Permanently deletes the signed-in user's account. All rows cascade via
 * foreign keys to auth.users. Requires SUPABASE_SERVICE_ROLE_KEY (server-only).
 */
export async function POST() {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Not available in demo mode." }, { status: 400 });
  const sb = await getServerSupabase();
  const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!data.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Account deletion isn't enabled on this server (SUPABASE_SERVICE_ROLE_KEY missing). Your data can still be deleted from Settings → Data." }, { status: 501 });
  }
  const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: files } = await admin.storage.from("captures").list(data.user.id, { limit: 1000 });
  if (files?.length) await admin.storage.from("captures").remove(files.map((f) => `${data.user!.id}/${f.name}`));
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) return NextResponse.json({ error: "Couldn't delete the account. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
