// Read-only queries. Every query is scoped by entity_id.
import type { SearchType } from "./validate.ts";

export interface Db {
  prepare(sql: string): {
    bind(...v: unknown[]): { all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; first<T = Record<string, unknown>>(): Promise<T | null> };
  };
}

export type Row = Record<string, unknown>;

export async function listEntities(db: Db): Promise<Row[]> {
  return (await db.prepare("SELECT id, type, name FROM entities ORDER BY id").bind().all()).results;
}

export async function getEntity(db: Db, entity: string): Promise<Row | null> {
  return db.prepare(
    `SELECT e.id, e.type, e.name,
       (SELECT COUNT(*) FROM claims  WHERE entity_id = e.id) AS claim_count,
       (SELECT COUNT(*) FROM sources WHERE entity_id = e.id) AS source_count
     FROM entities e WHERE e.id = ?`).bind(entity).first();
}

export async function getSource(db: Db, entity: string, id: string): Promise<Row | null> {
  return db.prepare(
    "SELECT id, entity_id, title, url, type, status, verified_at, body FROM sources WHERE entity_id = ? AND id = ?",
  ).bind(entity, id).first();
}

/** Turn free text into a safe FTS5 query: quoted word tokens, ANDed. Returns null if no tokens. */
export function ftsQuery(text: string): string | null {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  return words && words.length ? words.map((w) => `"${w}"`).join(" ") : null;
}

export interface SearchHit {
  id: string; type: SearchType; statement?: string; title?: string;
  status: string | null; source_id?: string; relevance: number;
}

export async function search(db: Db, entity: string, query: string, types: SearchType[], limit: number): Promise<SearchHit[]> {
  const fts = ftsQuery(query);
  if (!fts) return [];
  const marks = types.map(() => "?").join(",");
  const rows = (await db.prepare(
    `SELECT f.id AS id, f.type AS type, bm25(search_fts) AS rank,
            c.statement AS statement, c.status AS c_status, c.source_id AS source_id,
            s.title AS title, s.status AS s_status
     FROM search_fts f
     LEFT JOIN claims  c ON f.type = 'claim'  AND c.id = f.id
     LEFT JOIN sources s ON f.type = 'source' AND s.id = f.id
     WHERE search_fts MATCH ? AND f.entity_id = ? AND f.type IN (${marks})
     ORDER BY rank LIMIT ?`,
  ).bind(fts, entity, ...types, limit).all<Row>()).results;
  return rows.map((r) => {
    const x = -(r.rank as number);
    const relevance = Math.round((x / (1 + x)) * 1000) / 1000;
    return r.type === "claim"
      ? { id: r.id as string, type: "claim" as const, statement: r.statement as string, status: r.c_status as string, source_id: r.source_id as string, relevance }
      : { id: r.id as string, type: "source" as const, title: r.title as string, status: (r.s_status as string) ?? null, relevance };
  });
}
