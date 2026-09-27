import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { TestProject } from "vitest/node";
import { Client } from "pg";

/**
 * Starts a throwaway PostgreSQL cluster, installs a minimal Supabase auth/storage
 * shim, and applies every migration in supabase/migrations. Set TEST_DATABASE_URL
 * to use an existing empty database instead. If no PostgreSQL binaries are found,
 * the DB suite is skipped (with a message).
 */

function findPgBin(): string | null {
  if (process.env.PG_BIN && existsSync(path.join(process.env.PG_BIN, "initdb"))) return process.env.PG_BIN;
  const root = "/usr/lib/postgresql";
  if (existsSync(root)) {
    const versions = readdirSync(root).sort((a, b) => Number(b) - Number(a));
    for (const v of versions) {
      const bin = path.join(root, v, "bin");
      if (existsSync(path.join(bin, "initdb"))) return bin;
    }
  }
  const which = spawnSync("which", ["initdb"], { encoding: "utf8" });
  return which.status === 0 ? path.dirname(which.stdout.trim()) : null;
}

async function applyMigrations(url: string) {
  const client = new Client({ connectionString: url });
  await client.connect();
  const dir = path.resolve(__dirname, "../../supabase/migrations");
  await client.query(readFileSync(path.resolve(__dirname, "supabase-shim.sql"), "utf8"));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.query(readFileSync(path.join(dir, file), "utf8"));
  }
  await client.end();
}

export default async function setup(project: TestProject) {
  if (process.env.TEST_DATABASE_URL) {
    await applyMigrations(process.env.TEST_DATABASE_URL);
    project.provide("databaseUrl", process.env.TEST_DATABASE_URL);
    return;
  }

  const bin = findPgBin();
  if (!bin) {
    console.warn("[db tests] PostgreSQL binaries not found — skipping database tests. Set PG_BIN or TEST_DATABASE_URL.");
    project.provide("databaseUrl", "");
    return;
  }

  const dir = mkdtempSync(path.join(tmpdir(), "velora-pg-"));
  const isRoot = process.getuid?.() === 0;
  const run = (cmd: string, args: string[]) =>
    isRoot ? execFileSync("runuser", ["-u", "postgres", "--", cmd, ...args], { stdio: "pipe" }) : execFileSync(cmd, args, { stdio: "pipe" });
  if (isRoot) {
    chmodSync(dir, 0o777);
  }
  const port = 55000 + Math.floor(Math.random() * 5000);
  run(path.join(bin, "initdb"), ["-D", path.join(dir, "data"), "-A", "trust", "-U", "postgres"]);
  run(path.join(bin, "pg_ctl"), ["-D", path.join(dir, "data"), "-o", `-p ${port} -k ${dir} -c listen_addresses=''`, "-l", path.join(dir, "log"), "-w", "start"]);

  const url = `postgresql://postgres@/postgres?host=${encodeURIComponent(dir)}&port=${port}`;
  await applyMigrations(url);
  project.provide("databaseUrl", url);

  return () => {
    try {
      run(path.join(bin, "pg_ctl"), ["-D", path.join(dir, "data"), "-m", "fast", "stop"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
