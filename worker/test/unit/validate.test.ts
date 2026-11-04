import { test } from "node:test";
import assert from "node:assert/strict";
import * as v from "../../src/validate.ts";

test("noArgs / entityOnly reject unknown args and bad ids", () => {
  assert.equal(v.noArgs(undefined).ok, true);
  assert.equal(v.noArgs({}).ok, true);
  assert.equal(v.noArgs({ a: 1 }).ok, false);
  assert.equal(v.entityOnly({ entity: "example-owner" }).ok, true);
  for (const bad of [{}, { entity: "" }, { entity: 5 }, { entity: "a b" }, { entity: "../x" }, { entity: "a".repeat(129) }, { entity: "x", extra: 1 }, [], "str"])
    assert.equal(v.entityOnly(bad).ok, false, JSON.stringify(bad));
});

test("getContext needs section profile|brand", () => {
  assert.equal(v.getContext({ entity: "e", section: "profile" }).ok, true);
  assert.equal(v.getContext({ entity: "e", section: "brand" }).ok, true);
  assert.equal(v.getContext({ entity: "e", section: "claims" }).ok, false);
  assert.equal(v.getContext({ entity: "e" }).ok, false);
});

test("entityAndId requires its own key", () => {
  const f = v.entityAndId("source_id");
  assert.equal(f({ entity: "e", source_id: "s-1" }).ok, true);
  assert.equal(f({ entity: "e", sop_id: "s-1" }).ok, false);
  assert.equal(f({ entity: "e", source_id: "s 1" }).ok, false);
});

test("searchContext applies defaults and bounds", () => {
  const ok = v.searchContext({ entity: "e", query: "  hello  " });
  assert.deepEqual(ok.ok && ok.value, { entity: "e", query: "hello", types: ["claim", "source"], limit: 5 });
  assert.equal(v.searchContext({ entity: "e", query: "x", types: ["claim"], limit: 20 }).ok, true);
  for (const bad of [
    { entity: "e" }, { entity: "e", query: "" }, { entity: "e", query: "   " }, { entity: "e", query: 5 },
    { entity: "e", query: "x".repeat(201) },
    { entity: "e", query: "x", types: [] }, { entity: "e", query: "x", types: ["entity"] },
    { entity: "e", query: "x", types: ["claim", "claim"] }, { entity: "e", query: "x", types: "claim" },
    { entity: "e", query: "x", limit: 0 }, { entity: "e", query: "x", limit: 21 }, { entity: "e", query: "x", limit: 1.5 },
    { entity: "e", query: "x", limit: "3" }, { entity: "e", query: "x", offset: 1 },
  ]) assert.equal(v.searchContext(bad).ok, false, JSON.stringify(bad));
});
