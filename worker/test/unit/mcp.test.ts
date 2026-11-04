import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRpc } from "../../src/mcp.ts";
import { call, makeDb } from "./helpers.ts";

const NAMES = ["list_entities", "get_context", "get_entity", "get_sop", "get_policy", "get_source", "search_context"];

test("tools/list exposes exactly the 7 PRD tools, none writable", async () => {
  const r = (await handleRpc(makeDb(), { jsonrpc: "2.0", id: 1, method: "tools/list" })) as { result: { tools: { name: string }[] } };
  assert.deepEqual(r.result.tools.map((t) => t.name), NAMES);
});

test("initialize, notification, unknown method, unknown tool, malformed", async () => {
  const db = makeDb();
  const init = (await handleRpc(db, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } })) as { result: { protocolVersion: string } };
  assert.equal(init.result.protocolVersion, "2025-03-26");
  assert.equal(await handleRpc(db, { jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.equal(((await handleRpc(db, { jsonrpc: "2.0", id: 1, method: "nope" })) as { error: { code: number } }).error.code, -32601);
  assert.equal(((await handleRpc(db, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "put_doc" } })) as { error: { code: number } }).error.code, -32602);
  assert.equal(((await handleRpc(db, [])) as { error: { code: number } }).error.code, -32600);
  assert.equal(((await handleRpc(db, { id: 1, method: "ping" })) as { error: { code: number } }).error.code, -32600);
});

test("tools return consistent {error, message} on bad input", async () => {
  const db = makeDb();
  for (const [name, args] of [
    ["list_entities", { x: 1 }], ["get_context", { entity: "example-owner" }], ["get_entity", {}],
    ["get_sop", { entity: "example-owner" }], ["get_policy", { entity: "bad id", policy_id: "p" }],
    ["get_source", { entity: "example-owner", source_id: 5 }], ["search_context", { entity: "example-owner" }],
  ] as const) {
    const r = await call(db, name, args);
    assert.equal(r.isError, true, name);
    assert.equal(r.data.error, "INVALID_INPUT", name);
    assert.equal(typeof r.data.message, "string");
  }
});

test("get_source is entity-scoped; unknown ids give UNKNOWN", async () => {
  const db = makeDb();
  assert.equal((await call(db, "get_source", { entity: "example-company", source_id: "source-example-site" })).data.title, "Example: a public web page");
  assert.equal((await call(db, "get_source", { entity: "example-owner", source_id: "source-example-site" })).data.error, "UNKNOWN");
  assert.equal((await call(db, "get_entity", { entity: "nobody" })).data.error, "UNKNOWN");
});
