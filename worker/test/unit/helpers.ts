// Test helpers: an in-memory D1 stand-in over node:sqlite, loaded with the migrations and the example data.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Db } from "../../src/db.ts";

export const WORKER = resolve(import.meta.dirname, "../..");
export const REPO = resolve(WORKER, "..");
export const TOKEN = "unit-test-token-0123456789abcdef0123456789"; // test value, 42 chars

export function shim(sqlite: DatabaseSync): Db {
  return {
    prepare(sql: string) {
      return {
        bind(...v: unknown[]) {
          const params = v as (string | number | null)[];
          return {
            async all<T>() { return { results: sqlite.prepare(sql).all(...params) as T[] }; },
            async first<T>() { return (sqlite.prepare(sql).get(...params) as T | undefined) ?? null; },
          };
        },
      };
    },
  };
}

export function indexSql(): string {
  const out = join(mkdtempSync(join(tmpdir(), "entityos-")), "index.sql");
  const r = spawnSync("python", [join(REPO, "scripts/index/build_index.py"), "--out", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("build_index.py failed: " + r.stdout + r.stderr);
  return readFileSync(out, "utf8");
}

export function makeDb(): Db {
  const sqlite = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(WORKER, "migrations")).sort()) sqlite.exec(readFileSync(join(WORKER, "migrations", f), "utf8"));
  sqlite.exec(indexSql());
  return shim(sqlite);
}

export async function call(db: Db, name: string, args?: unknown) {
  const { handleRpc } = await import("../../src/mcp.ts");
  const res = (await handleRpc(db, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })) as {
    result?: { isError: boolean; content: { text: string }[] }; error?: unknown;
  };
  if (!res.result) return { rpcError: res.error } as never;
  return { isError: res.result.isError, data: JSON.parse(res.result.content[0].text) };
}
