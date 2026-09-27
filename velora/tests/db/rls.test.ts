import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, connect, createGeneration, createUser, hasDatabase } from "./helpers";

describe.skipIf(!hasDatabase)("row level security", () => {
  let db: Client;
  let alice: string;
  let bob: string;
  let aliceGen: string;
  let aliceProject: string;
  let bobProject: string;

  beforeAll(async () => {
    db = await connect();
    alice = await createUser(db, "Alice");
    bob = await createUser(db, "Bob");
    for (const u of [alice, bob]) await db.query("select public.grant_signup_credits($1, 100)", [u]);
    aliceGen = (await createGeneration(db, alice)).generation_id;
    await createGeneration(db, bob);
    aliceProject = (await db.query("insert into public.projects (user_id, name) values ($1, 'A') returning id", [alice])).rows[0].id;
    bobProject = (await db.query("insert into public.projects (user_id, name) values ($1, 'B') returning id", [bob])).rows[0].id;
    await db.query("insert into public.favorites (user_id, generation_id) values ($1, $2)", [alice, aliceGen]);
  });

  afterAll(async () => {
    await db?.end();
  });

  /** Runs one statement in its own transaction as the given role and returns the SQLSTATE it fails with. */
  const denied = async (role: "authenticated" | "anon", user: string | null, sql: string, params: unknown[] = []) =>
    asRole(db, role, user, () => db.query(sql, params).then(() => "ok", (e: { code?: string }) => e.code));

  const count = async (sql: string, params: unknown[] = []) => Number((await db.query(sql, params)).rows[0].n);

  it("users only see their own rows in every table", async () => {
    await asRole(db, "authenticated", bob, async () => {
      for (const table of ["generations", "projects", "favorites", "credits", "credit_transactions", "profiles"]) {
        const others = await count(`select count(*) as n from public.${table} where user_id = $1`, [alice]);
        expect(others, table).toBe(0);
      }
      expect(await count("select count(*) as n from public.generations")).toBe(1);
      expect(await count("select count(*) as n from public.generations where id = $1", [aliceGen])).toBe(0);
    });
  });

  it("anonymous users see nothing", async () => {
    expect(await denied("anon", null, "select * from public.generations")).toBe("42501");
    expect(await denied("anon", null, "select * from public.credits")).toBe("42501");
  });

  it("users cannot insert generations directly (must go through the charging function)", async () => {
    await asRole(db, "authenticated", alice, async () => {
      await expect(
        db.query(
          `insert into public.generations (user_id, provider, model, mode, prompt, final_prompt, duration, aspect_ratio, idempotency_key)
           values ($1, 'runway', 'gen4.5', 'text_to_video', 'free', 'free', 5, '16:9', 'free-video-key')`,
          [alice],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("users cannot change their credit balance or ledger", async () => {
    expect(await denied("authenticated", alice, "update public.credits set balance = 999999 where user_id = $1", [alice])).toBe("42501");
    expect(
      await denied("authenticated", alice, "insert into public.credit_transactions (user_id, amount, type) values ($1, 1000, 'adjustment')", [alice]),
    ).toBe("42501");
  });

  it("users cannot forge generation status or output", async () => {
    expect(await denied("authenticated", alice, "update public.generations set status = 'completed' where id = $1", [aliceGen])).toBe("42501");
    expect(await denied("authenticated", alice, "update public.generations set output_video_url = 'x/y.mp4' where id = $1", [aliceGen])).toBe("42501");
    expect(await denied("authenticated", alice, "update public.generations set credits_charged = 0 where id = $1", [aliceGen])).toBe("42501");
  });

  it("users can move their generation into their own project, but not someone else's", async () => {
    await asRole(db, "authenticated", alice, async () => {
      const ok = await db.query("update public.generations set project_id = $1 where id = $2", [aliceProject, aliceGen]);
      expect(ok.rowCount).toBe(1);
    });
    await asRole(db, "authenticated", alice, async () => {
      await expect(db.query("update public.generations set project_id = $1 where id = $2", [bobProject, aliceGen])).rejects.toMatchObject({
        code: "23503",
      });
    });
  });

  it("users cannot modify or delete other users' data (IDOR)", async () => {
    await asRole(db, "authenticated", bob, async () => {
      const upd = await db.query("update public.generations set project_id = null where id = $1", [aliceGen]);
      expect(upd.rowCount).toBe(0);
      const del = await db.query("delete from public.generations where id = $1", [aliceGen]);
      expect(del.rowCount).toBe(0);
      const delProject = await db.query("delete from public.projects where id = $1", [aliceProject]);
      expect(delProject.rowCount).toBe(0);
      const rename = await db.query("update public.projects set name = 'pwned' where id = $1", [aliceProject]);
      expect(rename.rowCount).toBe(0);
    });
    expect(await count("select count(*) as n from public.generations where id = $1", [aliceGen])).toBe(1);
  });

  it("users cannot create projects or favorites for another user", async () => {
    await asRole(db, "authenticated", bob, async () => {
      await expect(db.query("insert into public.projects (user_id, name) values ($1, 'x')", [alice])).rejects.toMatchObject({ code: "42501" });
    });
    await asRole(db, "authenticated", bob, async () => {
      // Favoriting someone else's generation fails the ownership FK.
      await expect(db.query("insert into public.favorites (user_id, generation_id) values ($1, $2)", [bob, aliceGen])).rejects.toMatchObject({
        code: "23503",
      });
    });
  });

  it("users can manage their own projects and favorites", async () => {
    await asRole(db, "authenticated", alice, async () => {
      const p = await db.query("insert into public.projects (user_id, name) values ($1, 'Mine') returning id", [alice]);
      expect(p.rowCount).toBe(1);
      const r = await db.query("update public.projects set name = 'Renamed' where id = $1", [p.rows[0].id]);
      expect(r.rowCount).toBe(1);
      const f = await db.query("delete from public.favorites where generation_id = $1", [aliceGen]);
      expect(f.rowCount).toBe(1);
    });
  });

  it("users can only edit safe profile columns", async () => {
    await asRole(db, "authenticated", alice, async () => {
      const ok = await db.query("update public.profiles set display_name = 'Alice B' where user_id = $1", [alice]);
      expect(ok.rowCount).toBe(1);
    });
    await asRole(db, "authenticated", alice, async () => {
      await expect(db.query("update public.profiles set user_id = $1 where user_id = $2", [bob, alice])).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("storage policies restrict objects to the owner's folder", async () => {
    await db.query("insert into storage.objects (bucket_id, name) values ('input-images', $1)", [`${alice}/a.png`]);
    await asRole(db, "authenticated", bob, async () => {
      expect(await count("select count(*) as n from storage.objects where name like $1", [`${alice}/%`])).toBe(0);
      await expect(
        db.query("insert into storage.objects (bucket_id, name) values ('input-images', $1)", [`${alice}/evil.png`]),
      ).rejects.toMatchObject({ code: "42501" });
    });
    await asRole(db, "authenticated", alice, async () => {
      expect(await count("select count(*) as n from storage.objects where name like $1", [`${alice}/%`])).toBe(1);
    });
  });

  it("buckets are private with type and size limits", async () => {
    const { rows } = await db.query("select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id");
    expect(rows.map((r) => r.id)).toEqual(["generated-videos", "input-images", "thumbnails"]);
    for (const r of rows) expect(r.public).toBe(false);
    const input = rows.find((r) => r.id === "input-images");
    expect(Number(input.file_size_limit)).toBe(5 * 1024 * 1024);
    expect(input.allowed_mime_types).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
