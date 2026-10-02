"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "../types";
import { DEFAULT_PREFERENCES } from "../types";
import { uid } from "../id";
import { StoreError, TABLES, type DataStore, type Row, type TableName } from "./store";

const BUCKET = "captures";

function fail(action: string, error: { message: string } | null): never {
  throw new StoreError(`Couldn't ${action}. ${error?.message ?? "Please check your connection and try again."}`, error);
}

/**
 * Supabase-backed persistence. Queries never filter by user on the client for
 * security — row-level security policies enforce `user_id = auth.uid()` on the
 * server. The explicit user_id on inserts satisfies the policies' WITH CHECK.
 */
export class SupabaseStore implements DataStore {
  readonly kind = "supabase" as const;
  constructor(private readonly sb: SupabaseClient, readonly userId: string) {}

  async getProfile() {
    const { data, error } = await this.sb.from("profiles").select("*").eq("id", this.userId).maybeSingle();
    if (error) fail("load your profile", error);
    if (!data) return null;
    return { ...data, preferences: { ...DEFAULT_PREFERENCES, ...(data.preferences ?? {}) } } as Profile;
  }

  async upsertProfile(profile: Profile) {
    const { data, error } = await this.sb
      .from("profiles")
      .upsert({
        id: this.userId,
        full_name: profile.full_name,
        timezone: profile.timezone,
        preferences: profile.preferences,
        onboarded: profile.onboarded,
        is_sample: profile.is_sample,
      })
      .select("*")
      .single();
    if (error) fail("save your profile", error);
    return { ...data, preferences: { ...DEFAULT_PREFERENCES, ...(data.preferences ?? {}) } } as Profile;
  }

  async list<T extends TableName>(table: T): Promise<Row<T>[]> {
    const { data, error } = await this.sb.from(table).select("*").order("created_at", { ascending: true }).limit(5000);
    if (error) fail(`load ${table.replace("_", " ")}`, error);
    return (data ?? []) as Row<T>[];
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    const { data, error } = await this.sb.from(table).upsert({ ...row, user_id: this.userId }).select("*").single();
    if (error) fail("save", error);
    return data as Row<T>;
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const clean = { ...patch } as Record<string, unknown>;
    delete clean.id;
    delete clean.user_id;
    delete clean.created_at;
    const { data, error } = await this.sb.from(table).update(clean).eq("id", id).select("*").single();
    if (error) fail("save your changes", error);
    return data as Row<T>;
  }

  async remove(table: TableName, id: string) {
    const { error } = await this.sb.from(table).delete().eq("id", id);
    if (error) fail("delete", error);
  }

  async uploadAttachment(file: Blob, ext: string) {
    const path = `${this.userId}/${uid()}.${ext}`;
    const { error } = await this.sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) fail("upload the image", error);
    return `storage:${path}`;
  }

  async resolveAttachment(ref: string) {
    if (!ref.startsWith("storage:")) return null;
    const { data } = await this.sb.storage.from(BUCKET).createSignedUrl(ref.slice(8), 60 * 60);
    return data?.signedUrl ?? null;
  }

  async removeAttachment(ref: string) {
    if (ref.startsWith("storage:")) await this.sb.storage.from(BUCKET).remove([ref.slice(8)]);
  }

  async wipe() {
    // children first; FK cascades handle the rest
    for (const t of [...TABLES].reverse()) {
      const { error } = await this.sb.from(t).delete().eq("user_id", this.userId);
      if (error) fail("delete your data", error);
    }
    const { data: files } = await this.sb.storage.from(BUCKET).list(this.userId, { limit: 1000 });
    if (files?.length) await this.sb.storage.from(BUCKET).remove(files.map((f) => `${this.userId}/${f.name}`));
  }
}
