import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorized, safeEqual, secretOk } from "../../src/auth.ts";
import { handle } from "../../src/index.ts";
import { TOKEN, makeDb } from "./helpers.ts";

test("secretOk rejects missing, non-string and short secrets", () => {
  assert.equal(secretOk(undefined), false);
  assert.equal(secretOk(""), false);
  assert.equal(secretOk("x".repeat(31)), false);
  assert.equal(secretOk("x".repeat(32)), true);
  assert.equal(secretOk(12345), false);
});

test("safeEqual compares correctly, including different lengths", async () => {
  assert.equal(await safeEqual("abc", "abc"), true);
  assert.equal(await safeEqual("abc", "abd"), false);
  assert.equal(await safeEqual("abc", "abcd"), false);
  assert.equal(await safeEqual("", "a"), false);
});

test("isAuthorized needs a well-formed Bearer header and a good secret", async () => {
  assert.equal(await isAuthorized(`Bearer ${TOKEN}`, TOKEN), true);
  assert.equal(await isAuthorized(TOKEN, TOKEN), false);
  assert.equal(await isAuthorized(`Basic ${TOKEN}`, TOKEN), false);
  assert.equal(await isAuthorized(`Bearer ${TOKEN}x`, TOKEN), false);
  assert.equal(await isAuthorized(null, TOKEN), false);
  assert.equal(await isAuthorized("Bearer short", "short"), false); // weak secret rejected even if equal
});

const post = (headers: Record<string, string>, body = '{"jsonrpc":"2.0","id":1,"method":"ping"}') =>
  new Request("http://x/mcp", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

test("handle: 401 with no detail for missing, wrong and misconfigured secret", async () => {
  const db = makeDb();
  const good = { DB: db, ENTITYOS_TOKEN: TOKEN };
  for (const [req, env] of [
    [post({}), good],
    [post({ authorization: "Bearer wrong-wrong-wrong-wrong-wrong-wrong-wrong" }), good],
    [post({ authorization: `Bearer ${TOKEN}` }), { DB: db }],
    [post({ authorization: "Bearer short" }), { DB: db, ENTITYOS_TOKEN: "short" }],
  ] as const) {
    const res = await handle(req, env);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "UNAUTHORIZED" });
  }
});

test("handle: authorized ping works; GET is 405; bad JSON is 400; wrong path is 404", async () => {
  const env = { DB: makeDb(), ENTITYOS_TOKEN: TOKEN };
  const auth = { authorization: `Bearer ${TOKEN}` };
  const ok = await handle(post(auth), env);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { jsonrpc: "2.0", id: 1, result: {} });
  const get = await handle(new Request("http://x/mcp", { headers: auth }), env);
  assert.equal(get.status, 405);
  assert.equal((await get.json() as { error: string }).error, "METHOD_NOT_ALLOWED");
  assert.equal((await handle(post(auth, "{nope"), env)).status, 400);
  assert.equal((await handle(new Request("http://x/other", { headers: auth }), env)).status, 404);
  const big = await handle(post(auth, "x".repeat(20000)), env);
  assert.equal(big.status, 413);
  const wrongType = await handle(new Request("http://x/mcp", { method: "POST", headers: { ...auth, "content-type": "text/plain" }, body: "{}" }), env);
  assert.equal(wrongType.status, 415);
});

test("handle: Origin must be allowlisted (checked after auth)", async () => {
  const auth = { authorization: `Bearer ${TOKEN}` };
  const env = { DB: makeDb(), ENTITYOS_TOKEN: TOKEN };
  const denied = await handle(post({ ...auth, origin: "https://evil.example" }), env);
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: "FORBIDDEN" });
  const allowed = { ...env, ALLOWED_ORIGINS: "https://a.example, https://ok.example" };
  assert.equal((await handle(post({ ...auth, origin: "https://ok.example" }), allowed)).status, 200);
  assert.equal((await handle(post({ ...auth, origin: "https://evil.example" }), allowed)).status, 403);
  assert.equal((await handle(post(auth), env)).status, 200); // no Origin header: fine
  assert.equal((await handle(post({ origin: "https://evil.example" }), env)).status, 401); // auth first
});

test("handle: Accept must allow json, event-stream or */*", async () => {
  const env = { DB: makeDb(), ENTITYOS_TOKEN: TOKEN };
  const auth = { authorization: `Bearer ${TOKEN}` };
  assert.equal((await handle(post({ ...auth, accept: "text/html" }), env)).status, 406);
  for (const accept of ["application/json", "application/json, text/event-stream", "*/*", "text/html, */*;q=0.1"])
    assert.equal((await handle(post({ ...auth, accept }), env)).status, 200, accept);
});

test("handle: a JSON-RPC response from the client gets 202", async () => {
  const env = { DB: makeDb(), ENTITYOS_TOKEN: TOKEN };
  const auth = { authorization: `Bearer ${TOKEN}` };
  assert.equal((await handle(post(auth, '{"jsonrpc":"2.0","id":1,"result":{}}'), env)).status, 202);
  assert.equal((await handle(post(auth, '{"jsonrpc":"2.0","id":1,"error":{"code":-1,"message":"x"}}'), env)).status, 202);
});
