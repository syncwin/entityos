// End-to-end: wrangler dev --local + local D1 loaded from the example data, then call each of the 7 tools.
// LOCAL ONLY. Never deploys, never uses --remote, never logs in to Cloudflare.
// Every check prints PASS or FAIL. If the server cannot start, every check is reported NOT RUN (never a pass).
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPO = resolve(WORKER, "..");
const STATE = join(WORKER, ".wrangler", "e2e-state");
const SQL = join(WORKER, ".wrangler", "e2e-index.local.sql");
const VARS = join(WORKER, ".dev.vars");
const PORT = 8799;
const URL_ = `http://127.0.0.1:${PORT}/mcp`;
const TOKEN = randomBytes(24).toString("hex"); // generated test token, 48 chars, never printed
const env = { ...process.env, CLOUDFLARE_API_TOKEN: "", WRANGLER_SEND_METRICS: "false", CI: "1" };
const wr = (args) => spawnSync("npx", ["wrangler", ...args], { cwd: WORKER, env, encoding: "utf8", shell: true });

const CHECKS = [
  "setup: migrations applied to local D1",
  "setup: example index loaded",
  "setup: wrangler dev --local started",
  "auth: no token -> 401 without detail",
  "auth: wrong token -> 401 without detail",
  "mcp: initialize + tools/list = 7 PRD tools",
  "tool list_entities",
  "tool get_context",
  "tool get_entity",
  "tool get_sop",
  "tool get_policy",
  "tool get_source",
  "tool search_context",
  "tool search_context rejects invalid input",
];
const results = new Map();
const pass = (n) => results.set(n, "PASS");
const fail = (n, why) => { results.set(n, "FAIL"); console.log(`  ${n}: ${why}`); };
const ok = (n, cond, why) => (cond ? pass(n) : fail(n, why));

let server;
function stop() {
  if (server?.pid) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  if (server?.pid && process.platform !== "win32") try { process.kill(-server.pid); } catch { /* gone */ }
  rmSync(VARS, { force: true });
}

async function rpc(method, params, headers = { authorization: `Bearer ${TOKEN}` }) {
  const res = await fetch(URL_, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function tool(name, args) {
  const r = await rpc("tools/call", { name, arguments: args });
  const t = r.body?.result;
  return { isError: t?.isError, data: t ? JSON.parse(t.content[0].text) : null, status: r.status };
}

async function main() {
  rmSync(STATE, { recursive: true, force: true });
  let r = wr(["d1", "migrations", "apply", "entityos-db", "--local", "--persist-to", STATE]);
  if (r.status !== 0) return console.log(r.stdout, r.stderr), fail(CHECKS[0], "migrations failed");
  pass(CHECKS[0]);

  r = spawnSync("python", [join(REPO, "scripts/index/build_index.py"), "--out", SQL], { encoding: "utf8" });
  if (r.status === 0) r = wr(["d1", "execute", "entityos-db", "--local", "--persist-to", STATE, "--file", SQL]);
  if (r.status !== 0) return console.log(r.stdout, r.stderr), fail(CHECKS[1], "index build/load failed");
  pass(CHECKS[1]);

  writeFileSync(VARS, `ENTITYOS_TOKEN=${TOKEN}\n`);
  server = spawn("npx", ["wrangler", "dev", "--local", "--port", String(PORT), "--persist-to", STATE], { cwd: WORKER, env, shell: true, stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((s) => setTimeout(s, 1000));
    try { await fetch(URL_, { method: "POST" }); up = true; } catch { /* not yet */ }
  }
  if (!up) return fail(CHECKS[2], "server did not start in 60s");
  pass(CHECKS[2]);

  for (const [n, h] of [[CHECKS[3], {}], [CHECKS[4], { authorization: "Bearer " + "x".repeat(48) }]]) {
    const a = await rpc("ping", {}, h);
    ok(n, a.status === 401 && JSON.stringify(a.body) === '{"error":"UNAUTHORIZED"}', `status ${a.status} body ${JSON.stringify(a.body)}`);
  }

  const init = await rpc("initialize", { protocolVersion: "2025-06-18" });
  const list = await rpc("tools/list", {});
  const names = list.body?.result?.tools?.map((t) => t.name).join(",");
  ok(CHECKS[5], init.body?.result?.serverInfo && names === "list_entities,get_context,get_entity,get_sop,get_policy,get_source,search_context", names);

  let t = await tool("list_entities", {});
  ok(CHECKS[6], !t.isError && t.data.entities.map((e) => e.id).join() === "example-brand,example-company,example-owner", JSON.stringify(t.data));
  t = await tool("get_context", { entity: "example-owner", section: "profile" });
  ok(CHECKS[7], t.isError && t.data.error === "UNKNOWN", JSON.stringify(t.data)); // profile not in schema yet: UNKNOWN is the specified behaviour
  t = await tool("get_entity", { entity: "example-company" });
  ok(CHECKS[8], !t.isError && t.data.name === "Example Company" && t.data.claim_count === 1 && t.data.source_count === 1, JSON.stringify(t.data));
  t = await tool("get_sop", { entity: "example-owner", sop_id: "content-seo-strategy" });
  ok(CHECKS[9], t.isError && t.data.error === "UNKNOWN", JSON.stringify(t.data));
  t = await tool("get_policy", { entity: "example-owner", policy_id: "no-go" });
  ok(CHECKS[10], t.isError && t.data.error === "UNKNOWN", JSON.stringify(t.data));
  t = await tool("get_source", { entity: "example-company", source_id: "source-example-site" });
  ok(CHECKS[11], !t.isError && t.data.url === "https://example.com/about" && t.data.verified_at === "2030-01-02", JSON.stringify(t.data));
  t = await tool("search_context", { entity: "example-company", query: "founded", types: ["claim"], limit: 3 });
  ok(CHECKS[12], !t.isError && t.data.results?.[0]?.id === "claim-example-founded" && t.data.results[0].status === "verified", JSON.stringify(t.data));
  t = await tool("search_context", { entity: "example-company", query: "founded", limit: 999 });
  ok(CHECKS[13], t.isError && t.data.error === "INVALID_INPUT", JSON.stringify(t.data));
}

try {
  await main();
} catch (e) {
  console.log("e2e error:", e instanceof Error ? e.message : e);
} finally {
  stop();
}
console.log("\nE2E results");
let bad = 0;
for (const n of CHECKS) {
  const s = results.get(n) ?? "NOT RUN";
  if (s !== "PASS") bad++;
  console.log(`${s.padEnd(8)} ${n}`);
}
if (existsSync(SQL)) rmSync(SQL, { force: true });
process.exit(bad ? 1 : 0);
