import "server-only";

import type { CreditTransactionRow, GenerationRow, ProfileRow, ProjectRow } from "@/lib/db/types";
import { AppError } from "@/lib/errors";
import { BUCKETS, createSignedUrls } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LIBRARY_PAGE_SIZE, type LibraryQuery } from "@/lib/validation/schemas";

/**
 * Read models for pages. Every query uses the user's session client, so RLS
 * guarantees users only ever see their own rows. Media paths are converted to
 * short-lived signed URLs only after the row has been returned under RLS.
 */

export interface GenerationView extends GenerationRow {
  videoUrl: string | null;
  posterUrl: string | null;
  isFavorite: boolean;
}

function fail(error: unknown): never {
  throw new AppError("internal", "Could not load data.", { cause: error });
}

export async function attachMedia(rows: GenerationRow[], favoriteIds?: Set<string>): Promise<GenerationView[]> {
  const [videos, posters] = await Promise.all([
    createSignedUrls(BUCKETS.generatedVideos, rows.map((r) => r.output_video_url).filter((p): p is string => Boolean(p))),
    createSignedUrls(BUCKETS.inputImages, rows.map((r) => r.input_image_url).filter((p): p is string => Boolean(p))),
  ]);
  return rows.map((r) => ({
    ...r,
    videoUrl: r.output_video_url ? (videos.get(r.output_video_url) ?? null) : null,
    posterUrl: r.input_image_url ? (posters.get(r.input_image_url) ?? null) : null,
    isFavorite: favoriteIds?.has(r.id) ?? false,
  }));
}

async function favoriteIdsFor(generationIds: string[]): Promise<Set<string>> {
  if (generationIds.length === 0) return new Set();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("favorites").select("generation_id").in("generation_id", generationIds);
  if (error) fail(error);
  return new Set((data ?? []).map((f) => f.generation_id));
}

export async function getProfile(): Promise<ProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
  if (error) fail(error);
  return data;
}

export async function getCreditBalance(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("credits").select("balance").maybeSingle();
  if (error) fail(error);
  return data?.balance ?? 0;
}

export async function listCreditTransactions(limit = 20): Promise<CreditTransactionRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail(error);
  return data ?? [];
}

export async function listRecentGenerations(limit = 8): Promise<GenerationView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("generations").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) fail(error);
  const rows = data ?? [];
  return attachMedia(rows, await favoriteIdsFor(rows.map((r) => r.id)));
}

/** Escapes LIKE wildcards so user input is matched literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listLibrary(query: LibraryQuery & { projectId?: string }): Promise<{ items: GenerationView[]; total: number; pageCount: number }> {
  const supabase = await createSupabaseServerClient();
  const from = (query.page - 1) * LIBRARY_PAGE_SIZE;
  let request = supabase.from("generations").select("*", { count: "exact" });
  if (query.projectId) request = request.eq("project_id", query.projectId);
  if (query.status === "completed") request = request.eq("status", "completed");
  if (query.status === "failed") request = request.in("status", ["failed", "cancelled"]);
  if (query.status === "active") request = request.in("status", ["queued", "processing"]);
  if (query.q) request = request.ilike("prompt", likePattern(query.q));
  const { data, error, count } = await request
    .order("created_at", { ascending: query.sort === "oldest" })
    .range(from, from + LIBRARY_PAGE_SIZE - 1);
  if (error) fail(error);
  const rows = data ?? [];
  const total = count ?? 0;
  return {
    items: await attachMedia(rows, await favoriteIdsFor(rows.map((r) => r.id))),
    total,
    pageCount: Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE)),
  };
}

export async function listFavorites(page: number): Promise<{ items: GenerationView[]; total: number; pageCount: number }> {
  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * LIBRARY_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("favorites")
    .select("generation_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + LIBRARY_PAGE_SIZE - 1);
  if (error) fail(error);
  const ids = (data ?? []).map((f) => f.generation_id);
  if (ids.length === 0) return { items: [], total: count ?? 0, pageCount: 1 };
  const { data: gens, error: genError } = await supabase.from("generations").select("*").in("id", ids);
  if (genError) fail(genError);
  const byId = new Map((gens ?? []).map((g) => [g.id, g]));
  const ordered = ids.map((id) => byId.get(id)).filter((g): g is GenerationRow => Boolean(g));
  const total = count ?? 0;
  return { items: await attachMedia(ordered, new Set(ids)), total, pageCount: Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE)) };
}

export async function getGeneration(id: string): Promise<GenerationView | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("generations").select("*").eq("id", id).maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const [view] = await attachMedia([data], await favoriteIdsFor([data.id]));
  return view ?? null;
}

export interface ProjectView extends ProjectRow {
  coverSignedUrl: string | null;
  generationCount: number;
}

export async function listProjects(): Promise<ProjectView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(200);
  if (error) fail(error);
  const projects = data ?? [];
  if (projects.length === 0) return [];
  const [covers, counts] = await Promise.all([
    createSignedUrls(BUCKETS.thumbnails, projects.map((p) => p.cover_url).filter((p): p is string => Boolean(p))),
    supabase.from("generations").select("project_id").in("project_id", projects.map((p) => p.id)),
  ]);
  if (counts.error) fail(counts.error);
  const countMap = new Map<string, number>();
  for (const row of counts.data ?? []) {
    if (row.project_id) countMap.set(row.project_id, (countMap.get(row.project_id) ?? 0) + 1);
  }
  return projects.map((p) => ({
    ...p,
    coverSignedUrl: p.cover_url ? (covers.get(p.cover_url) ?? null) : null,
    generationCount: countMap.get(p.id) ?? 0,
  }));
}

export async function listProjectOptions(): Promise<Pick<ProjectRow, "id" | "name">[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("projects").select("id, name").order("name").limit(200);
  if (error) fail(error);
  return data ?? [];
}

export async function getProject(id: string): Promise<ProjectView | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const covers = await createSignedUrls(BUCKETS.thumbnails, data.cover_url ? [data.cover_url] : []);
  const { count } = await supabase.from("generations").select("id", { count: "exact", head: true }).eq("project_id", id);
  return { ...data, coverSignedUrl: data.cover_url ? (covers.get(data.cover_url) ?? null) : null, generationCount: count ?? 0 };
}

export async function getUsageSummary(): Promise<{ total: number; completed: number; failed: number; active: number; creditsSpent: number }> {
  const supabase = await createSupabaseServerClient();
  const head = { count: "exact" as const, head: true };
  const [total, completed, failed, active, spent] = await Promise.all([
    supabase.from("generations").select("id", head),
    supabase.from("generations").select("id", head).eq("status", "completed"),
    supabase.from("generations").select("id", head).in("status", ["failed", "cancelled"]),
    supabase.from("generations").select("id", head).in("status", ["queued", "processing"]),
    supabase.from("credit_transactions").select("amount").in("type", ["generation_charge", "generation_refund"]).limit(10000),
  ]);
  const creditsSpent = -(spent.data ?? []).reduce((sum, t) => sum + t.amount, 0);
  return {
    total: total.count ?? 0,
    completed: completed.count ?? 0,
    failed: failed.count ?? 0,
    active: active.count ?? 0,
    creditsSpent: Math.max(0, creditsSpent),
  };
}
