import { randomUUID } from "node:crypto";

import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, balanceOf, connect, createGeneration, createUser, hasDatabase } from "./helpers";

describe.skipIf(!hasDatabase)("credit ledger functions", () => {
  let db: Client;
  beforeAll(async () => {
    db = await connect();
  });
  afterAll(async () => {
    await db?.end();
  });

  it("creates a profile and zero-balance credit account on signup", async () => {
    const user = await createUser(db, "Ada");
    const { rows } = await db.query("select display_name from public.profiles where user_id = $1", [user]);
    expect(rows[0].display_name).toBe("Ada");
    expect(await balanceOf(db, user)).toBe(0);
  });

  it("grants signup credits exactly once", async () => {
    const user = await createUser(db);
    await db.query("select public.grant_signup_credits($1, 100)", [user]);
    await db.query("select public.grant_signup_credits($1, 100)", [user]);
    expect(await balanceOf(db, user)).toBe(100);
    const { rows } = await db.query("select count(*)::int as n from public.credit_transactions where user_id = $1 and type = 'signup_grant'", [user]);
    expect(rows[0].n).toBe(1);
  });

  it("deducts credits and writes a ledger entry when a generation is created", async () => {
    const user = await createUser(db);
    await db.query("select public.grant_signup_credits($1, 100)", [user]);
    const res = await createGeneration(db, user, { cost: 25 });
    expect(res.created).toBe(true);
    expect(res.balance).toBe(75);
    expect(await balanceOf(db, user)).toBe(75);
    const { rows } = await db.query("select amount, type from public.credit_transactions where generation_id = $1", [res.generation_id]);
    expect(rows).toEqual([{ amount: -25, type: "generation_charge" }]);
  });

  it("is idempotent: the same key never charges twice", async () => {
    const user = await createUser(db);
    await db.query("select public.grant_signup_credits($1, 100)", [user]);
    const key = randomUUID();
    const a = await createGeneration(db, user, { key, cost: 25 });
    const b = await createGeneration(db, user, { key, cost: 25 });
    expect(b.created).toBe(false);
    expect(b.generation_id).toBe(a.generation_id);
    expect(await balanceOf(db, user)).toBe(75);
  });

  it("serializes concurrent requests with the same key (no double charge)", async () => {
    const user = await createUser(db);
    await db.query("select public.grant_signup_credits($1, 100)", [user]);
    const key = randomUUID();
    const clients = await Promise.all([connect(), connect(), connect()]);
    try {
      const results = await Promise.all(clients.map((c) => createGeneration(c, user, { key, cost: 25 })));
      expect(results.filter((r) => r.created)).toHaveLength(1);
      expect(new Set(results.map((r) => r.generation_id)).size).toBe(1);
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
    expect(await balanceOf(db, user)).toBe(75);
  });

  it("never lets concurrent different requests overdraw the balance", async () => {
    const user = await createUser(db);
    await db.query("select public.grant_signup_credits($1, 50)", [user]);
    const clients = await Promise.all([connect(), connect(), connect(), connect()]);
    try {
      const settled = await Promise.allSettled(clients.map((c) => createGeneration(c, user, { cost: 25 })));
      expect(settled.filter((s) => s.status === "fulfilled")).toHaveLength(2);
      const rejected = settled.filter((s): s is PromiseRejectedResult => s.status === "rejected");
      expect(rejected).toHaveLength(2);
      for (const r of rejected) expect((r.reason as { code?: string }).code).toBe("VL402");
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
    expect(await balanceOf(db, user)).toBe(0);
  });

  it("rejects generations when credits are insufficient and creates nothing", async () => {
    const user = await createUser(db);
    await db.query("select public.grant_signup_credits($1, 10)", [user]);
    await expect(createGeneration(db, user, { cost: 25 })).rejects.toMatchObject({ code: "VL402" });
    const { rows } = await db.query("select count(*)::int as n from public.generations where user_id = $1", [user]);
    expect(rows[0].n).toBe(0);
    expect(await balanceOf(db, user)).toBe(10);
  });

  it("refunds once and only once", async () => {
    const user = await createUser(db);
    await db.query("select public.grant_signup_credits($1, 100)", [user]);
    const { generation_id } = await createGeneration(db, user, { cost: 25 });
    const first = await db.query("select public.refund_generation($1, 'provider failed') as ok", [generation_id]);
    const second = await db.query("select public.refund_generation($1, 'provider failed') as ok", [generation_id]);
    expect(first.rows[0].ok).toBe(true);
    expect(second.rows[0].ok).toBe(false);
    expect(await balanceOf(db, user)).toBe(100);
  });

  it("does not let a generation be attached to another user's project", async () => {
    const owner = await createUser(db);
    const attacker = await createUser(db);
    await db.query("select public.grant_signup_credits($1, 100)", [attacker]);
    const { rows } = await db.query("insert into public.projects (user_id, name) values ($1, 'Private') returning id", [owner]);
    await expect(createGeneration(db, attacker, { projectId: rows[0].id })).rejects.toMatchObject({ code: "VL404" });
    expect(await balanceOf(db, attacker)).toBe(100);
  });

  it("claim_generation_sync hands out a single lease", async () => {
    const user = await createUser(db);
    await db.query("select public.grant_signup_credits($1, 100)", [user]);
    const { generation_id } = await createGeneration(db, user);
    const a = await db.query("select id from public.claim_generation_sync($1, 60)", [generation_id]);
    const b = await db.query("select id from public.claim_generation_sync($1, 60)", [generation_id]);
    expect(a.rowCount).toBe(1);
    expect(b.rowCount).toBe(0);
  });

  it("check_rate_limit allows up to the limit per window", async () => {
    const key = `test:${randomUUID()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { rows } = await db.query("select public.check_rate_limit($1, 3, 60) as ok", [key]);
      results.push(rows[0].ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });

  it("does not let end users call the privileged functions", async () => {
    const user = await createUser(db);
    for (const sql of [
      "select public.grant_signup_credits($1, 1000000)",
      "select public.refund_generation($1, 'x')",
      "select * from public.claim_generation_sync($1, 1)",
    ]) {
      await expect(asRole(db, "authenticated", user, () => db.query(sql, [user]))).rejects.toMatchObject({ code: "42501" });
    }
    await expect(
      asRole(db, "anon", null, () => db.query("select public.check_rate_limit('x', 1, 60)")),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
