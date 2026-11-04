// Strict input validation. Unknown properties are rejected.
export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
export const SEARCH_TYPES = ["claim", "source"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export const CONTEXT_SECTIONS = ["profile", "brand"] as const;
export type ContextSection = (typeof CONTEXT_SECTIONS)[number];
export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 20;
export const MAX_QUERY_LENGTH = 200;

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

function plain(args: unknown, allowed: string[]): Result<Record<string, unknown>> {
  if (args === undefined || args === null) args = {};
  if (typeof args !== "object" || Array.isArray(args)) return fail("arguments must be an object");
  const o = args as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!allowed.includes(k)) return fail(`unknown argument '${k}'`);
  return { ok: true, value: o };
}

function id(o: Record<string, unknown>, key: string): Result<string> {
  const v = o[key];
  if (typeof v !== "string" || !ID_RE.test(v)) return fail(`'${key}' must be an id string (letters, digits, . _ -; max 128)`);
  return { ok: true, value: v };
}

export function noArgs(args: unknown): Result<Record<string, never>> {
  const r = plain(args, []);
  return r.ok ? { ok: true, value: {} } : r;
}

export function entityOnly(args: unknown): Result<{ entity: string }> {
  const r = plain(args, ["entity"]);
  if (!r.ok) return r;
  const e = id(r.value, "entity");
  return e.ok ? { ok: true, value: { entity: e.value } } : e;
}

export function getContext(args: unknown): Result<{ entity: string; section: ContextSection }> {
  const r = plain(args, ["entity", "section"]);
  if (!r.ok) return r;
  const e = id(r.value, "entity");
  if (!e.ok) return e;
  const s = r.value.section;
  if (typeof s !== "string" || !(CONTEXT_SECTIONS as readonly string[]).includes(s))
    return fail(`'section' must be one of: ${CONTEXT_SECTIONS.join(", ")}`);
  return { ok: true, value: { entity: e.value, section: s as ContextSection } };
}

/** For get_sop / get_policy / get_source: entity plus one named id. */
export function entityAndId(key: "sop_id" | "policy_id" | "source_id") {
  return (args: unknown): Result<{ entity: string; id: string }> => {
    const r = plain(args, ["entity", key]);
    if (!r.ok) return r;
    const e = id(r.value, "entity");
    if (!e.ok) return e;
    const i = id(r.value, key);
    if (!i.ok) return i;
    return { ok: true, value: { entity: e.value, id: i.value } };
  };
}

export function searchContext(args: unknown): Result<{ entity: string; query: string; types: SearchType[]; limit: number }> {
  const r = plain(args, ["entity", "query", "types", "limit"]);
  if (!r.ok) return r;
  const e = id(r.value, "entity");
  if (!e.ok) return e;
  const q = r.value.query;
  if (typeof q !== "string" || q.trim().length === 0 || q.length > MAX_QUERY_LENGTH)
    return fail(`'query' must be a non-empty string of at most ${MAX_QUERY_LENGTH} characters`);
  let types: SearchType[] = [...SEARCH_TYPES];
  if (r.value.types !== undefined) {
    const t = r.value.types;
    if (!Array.isArray(t) || t.length === 0 || t.length > SEARCH_TYPES.length ||
        !t.every((x) => typeof x === "string" && (SEARCH_TYPES as readonly string[]).includes(x)) ||
        new Set(t).size !== t.length)
      return fail(`'types' must be a non-empty list of unique values from: ${SEARCH_TYPES.join(", ")}`);
    types = t as SearchType[];
  }
  let limit = DEFAULT_LIMIT;
  if (r.value.limit !== undefined) {
    const l = r.value.limit;
    if (typeof l !== "number" || !Number.isInteger(l) || l < 1 || l > MAX_LIMIT)
      return fail(`'limit' must be an integer from 1 to ${MAX_LIMIT}`);
    limit = l;
  }
  return { ok: true, value: { entity: e.value, query: q.trim(), types, limit } };
}
