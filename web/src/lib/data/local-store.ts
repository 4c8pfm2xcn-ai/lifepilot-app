"use client";
/**
 * Demo-mode persistence. Every table is a JSON array in localStorage, namespaced
 * by user id so separate demo accounts on the same browser never see each
 * other's data.
 */
import type { Profile } from "../types";
import { uid } from "../id";
import { StoreError, TABLES, type DataStore, type Row, type TableName } from "./store";

const PREFIX = "dayzero:v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    throw new StoreError("Browser storage is full. Delete some captured images or export and clear your data.", e);
  }
}

export class LocalStore implements DataStore {
  readonly kind = "local" as const;
  constructor(readonly userId: string) {}

  private key(table: string) {
    return `${PREFIX}:${this.userId}:${table}`;
  }

  async getProfile() {
    return read<Profile | null>(this.key("profile"), null);
  }

  async upsertProfile(profile: Profile) {
    if (profile.id !== this.userId) throw new StoreError("Cannot write another user's profile");
    const next = { ...profile, updated_at: new Date().toISOString() };
    write(this.key("profile"), next);
    return next;
  }

  async list<T extends TableName>(table: T): Promise<Row<T>[]> {
    return read<Row<T>[]>(this.key(table), []);
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    const rows = read<Row<T>[]>(this.key(table), []);
    const record = { ...row, user_id: this.userId } as Row<T>;
    const idx = rows.findIndex((r) => r.id === record.id);
    if (idx >= 0) rows[idx] = record;
    else rows.push(record);
    write(this.key(table), rows);
    return record;
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const rows = read<Row<T>[]>(this.key(table), []);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new StoreError("That item no longer exists.");
    const next = { ...rows[idx], ...patch, id, user_id: this.userId } as Row<T>;
    if ("updated_at" in next) (next as { updated_at: string }).updated_at = new Date().toISOString();
    rows[idx] = next;
    write(this.key(table), rows);
    return next;
  }

  async remove(table: TableName, id: string) {
    const rows = read<{ id: string }[]>(this.key(table), []);
    write(this.key(table), rows.filter((r) => r.id !== id));
    if (table === "goals") {
      const ms = read<{ id: string; goal_id: string }[]>(this.key("goal_milestones"), []);
      write(this.key("goal_milestones"), ms.filter((m) => m.goal_id !== id));
      const tasks = read<{ goal_id: string | null }[]>(this.key("tasks"), []);
      write(this.key("tasks"), tasks.map((t) => (t.goal_id === id ? { ...t, goal_id: null } : t)));
    }
    if (table === "conversations") {
      const msgs = read<{ conversation_id: string }[]>(this.key("messages"), []);
      write(this.key("messages"), msgs.filter((m) => m.conversation_id !== id));
    }
  }

  async uploadAttachment(file: Blob) {
    const dataUrl = await compressImage(file);
    const id = uid();
    write(this.key(`attachment:${id}`), dataUrl);
    return `local:${id}`;
  }

  async resolveAttachment(ref: string) {
    if (!ref.startsWith("local:")) return null;
    return read<string | null>(this.key(`attachment:${ref.slice(6)}`), null);
  }

  async removeAttachment(ref: string) {
    if (ref.startsWith("local:")) localStorage.removeItem(this.key(`attachment:${ref.slice(6)}`));
  }

  async wipe() {
    for (const t of TABLES) localStorage.removeItem(this.key(t));
    const prefix = this.key("attachment:");
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
  }

  /** Remove everything including the profile (demo account deletion). */
  destroy() {
    const prefix = `${PREFIX}:${this.userId}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
  }
}

/** Downscale to ≤1280px JPEG so screenshots fit comfortably in localStorage. */
export async function compressImage(file: Blob, maxDim = 1280, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new StoreError("Could not process image");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}
