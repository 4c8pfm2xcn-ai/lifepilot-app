import { randomUUID } from "node:crypto";

import { Client } from "pg";
import { inject } from "vitest";

export const databaseUrl = inject("databaseUrl");
export const hasDatabase = Boolean(databaseUrl);

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

/** Runs `fn` as a Supabase role (authenticated user / anon / service_role) inside a rolled-back transaction. */
export async function asRole<T>(
  client: Client,
  role: "authenticated" | "anon" | "service_role",
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    return await fn();
  } finally {
    await client.query("rollback");
  }
}

export async function createUser(client: Client, name = "Test"): Promise<string> {
  const id = randomUUID();
  await client.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    `${id}@example.com`,
    JSON.stringify({ display_name: name }),
  ]);
  return id;
}

export async function balanceOf(client: Client, userId: string): Promise<number> {
  const { rows } = await client.query("select balance from public.credits where user_id = $1", [userId]);
  return rows[0]?.balance ?? 0;
}

export async function createGeneration(
  client: Client,
  userId: string,
  opts: { key?: string; cost?: number; projectId?: string | null } = {},
) {
  const { rows } = await client.query(
    `select * from public.create_generation_with_charge(
       $1, $2, $3, 'runway', 'gen4.5', 'text_to_video', 'A fox', null, 'A fox', null, null, null, null, 5, '16:9', $4)`,
    [userId, opts.key ?? randomUUID(), opts.cost ?? 25, opts.projectId ?? null],
  );
  return rows[0] as { generation_id: string; created: boolean; balance: number };
}
