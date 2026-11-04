// The 7 MCP tools named in PRD section 12. All read-only; there are no write tools (PRD section 13).
import * as q from "./db.ts";
import * as v from "./validate.ts";

export class ToolError extends Error {
  code: "INVALID_INPUT" | "UNKNOWN";
  constructor(code: "INVALID_INPUT" | "UNKNOWN", message: string) {
    super(message);
    this.code = code;
  }
}

const unknown = (msg = "No verified record for this query.") => new ToolError("UNKNOWN", msg);

type Props = Record<string, unknown>;
export interface Tool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Props; required?: string[]; additionalProperties: false };
  run(db: q.Db, args: unknown): Promise<unknown>;
}

const entityProp = { type: "string", description: "Entity id (see list_entities)." };

function parse<T>(r: v.Result<T>): T {
  if (!r.ok) throw new ToolError("INVALID_INPUT", r.message);
  return r.value;
}

export const TOOLS: Tool[] = [
  {
    name: "list_entities",
    description: "List all entities (person, brands, organizations) in this instance.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run(db, args) {
      parse(v.noArgs(args));
      return { entities: await q.listEntities(db) };
    },
  },
  {
    name: "get_context",
    description: "Get a context section (profile or brand) for an entity. UNKNOWN until profile/brand records are defined and indexed.",
    inputSchema: {
      type: "object",
      properties: { entity: entityProp, section: { type: "string", enum: [...v.CONTEXT_SECTIONS] } },
      required: ["entity", "section"], additionalProperties: false,
    },
    async run(db, args) {
      const a = parse(v.getContext(args));
      if (!(await q.getEntity(db, a.entity))) throw unknown();
      // TODO: profile and brand have no schema or index table yet (Phase 0 defines claims and sources only).
      throw unknown(`No ${a.section} record for this entity.`);
    },
  },
  {
    name: "get_entity",
    description: "Get one entity with its claim and source counts.",
    inputSchema: { type: "object", properties: { entity: entityProp }, required: ["entity"], additionalProperties: false },
    async run(db, args) {
      const a = parse(v.entityOnly(args));
      const e = await q.getEntity(db, a.entity);
      if (!e) throw unknown();
      return e;
    },
  },
  {
    name: "get_sop",
    description: "Get an SOP pointer by id. UNKNOWN until SOP pointers are defined and indexed.",
    inputSchema: {
      type: "object", properties: { entity: entityProp, sop_id: { type: "string" } },
      required: ["entity", "sop_id"], additionalProperties: false,
    },
    async run(db, args) {
      const a = parse(v.entityAndId("sop_id")(args));
      if (!(await q.getEntity(db, a.entity))) throw unknown();
      // TODO: SOP pointers (PRD section 6) have no schema or index table yet.
      throw unknown("No SOP with this id.");
    },
  },
  {
    name: "get_policy",
    description: "Get a policy by id. UNKNOWN until policies are defined and indexed.",
    inputSchema: {
      type: "object", properties: { entity: entityProp, policy_id: { type: "string" } },
      required: ["entity", "policy_id"], additionalProperties: false,
    },
    async run(db, args) {
      const a = parse(v.entityAndId("policy_id")(args));
      if (!(await q.getEntity(db, a.entity))) throw unknown();
      // TODO: policies have no schema or index table yet.
      throw unknown("No policy with this id.");
    },
  },
  {
    name: "get_source",
    description: "Get one source (provenance record) by id.",
    inputSchema: {
      type: "object", properties: { entity: entityProp, source_id: { type: "string" } },
      required: ["entity", "source_id"], additionalProperties: false,
    },
    async run(db, args) {
      const a = parse(v.entityAndId("source_id")(args));
      const s = await q.getSource(db, a.entity, a.id);
      if (!s) throw unknown();
      return s;
    },
  },
  {
    name: "search_context",
    description: "Full-text search over an entity's claims and sources. Returns only matching records, with status and relevance.",
    inputSchema: {
      type: "object",
      properties: {
        entity: entityProp,
        query: { type: "string", maxLength: v.MAX_QUERY_LENGTH },
        types: { type: "array", items: { type: "string", enum: [...v.SEARCH_TYPES] }, minItems: 1, uniqueItems: true },
        limit: { type: "integer", minimum: 1, maximum: v.MAX_LIMIT, default: v.DEFAULT_LIMIT },
      },
      required: ["entity", "query"], additionalProperties: false,
    },
    async run(db, args) {
      const a = parse(v.searchContext(args));
      const results = await q.search(db, a.entity, a.query, a.types, a.limit);
      if (results.length === 0) throw unknown();
      return { results };
    },
  },
];
