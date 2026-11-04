import { test } from "node:test";
import assert from "node:assert/strict";
import { ftsQuery } from "../../src/db.ts";
import { call, makeDb } from "./helpers.ts";

test("ftsQuery quotes tokens and neutralises FTS syntax", () => {
  assert.equal(ftsQuery("founded 2000"), '"founded" "2000"');
  assert.equal(ftsQuery('a" OR b* NEAR(c)'), '"a" "or" "b" "near" "c"');
  assert.equal(ftsQuery("!!! ---"), null);
});

test("search finds a claim, scoped to its entity, with the PRD result shape", async () => {
  const db = makeDb();
  const r = await call(db, "search_context", { entity: "example-company", query: "founded", types: ["claim"], limit: 3 });
  assert.equal(r.isError, false);
  assert.equal(r.data.results.length, 1);
  const hit = r.data.results[0];
  assert.deepEqual(Object.keys(hit).sort(), ["id", "relevance", "source_id", "statement", "status", "type"]);
  assert.equal(hit.id, "claim-example-founded");
  assert.equal(hit.status, "verified");
  assert.equal(hit.source_id, "source-example-site");
  assert.ok(hit.relevance > 0 && hit.relevance < 1);
});

test("search never leaks across entities", async () => {
  const db = makeDb();
  const r = await call(db, "search_context", { entity: "example-owner", query: "founded" });
  assert.equal(r.isError, true);
  assert.equal(r.data.error, "UNKNOWN");
});

test("search with no match returns UNKNOWN, not an empty guess", async () => {
  const r = await call(makeDb(), "search_context", { entity: "example-owner", query: "zzzznomatch" });
  assert.deepEqual(r.data, { error: "UNKNOWN", message: "No verified record for this query." });
});

test("search honours types, limit and hostile query text", async () => {
  const db = makeDb();
  const both = await call(db, "search_context", { entity: "example-owner", query: "example" });
  assert.deepEqual(new Set(both.data.results.map((x: { type: string }) => x.type)), new Set(["claim", "source"]));
  const one = await call(db, "search_context", { entity: "example-owner", query: "example", limit: 1 });
  assert.equal(one.data.results.length, 1);
  const src = await call(db, "search_context", { entity: "example-owner", query: "document", types: ["source"] });
  assert.equal(src.data.results[0].type, "source");
  assert.equal(src.data.results[0].id, "source-example-doc");
  const evil = await call(db, "search_context", { entity: "example-owner", query: '"; DROP TABLE claims; -- NEAR(' });
  assert.equal(evil.data.error, "UNKNOWN");
  const still = await call(db, "search_context", { entity: "example-owner", query: "articles" });
  assert.equal(still.isError, false);
});
