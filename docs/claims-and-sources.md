# Claims and sources

A **claim** is one atomic, individually sourced fact. A **source** is the record that proves it. Schemas: `schema/claim.schema.json`, `schema/source.schema.json`, `schema/owner.schema.json`.

## Storage

- The canonical record is **one Markdown file per claim and per source**: YAML front matter holds the schema fields, the body is the human-readable text. Readable in Obsidian, diff-friendly in git.
- **D1 (+ FTS5) is a derived index**, rebuilt from the files and used by the MCP tools. **Files win on conflict.**
- Examples: `examples/claims/*.md`, `examples/sources/*.md` (fake data).

## Claim (front matter)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique across the vault |
| `entity_id` | string | Required; must exist in `config/owner.yaml` |
| `statement` | string | One atomic fact |
| `status` | enum | `verified`, `unverified`, `deprecated`, `conflicting`, `draft` |
| `source_id` | string | Required; must match a source `id` |
| `verified_at` | date or null | Optional, null allowed; **required (date) when `status: verified`** |

## Source (front matter)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique across the vault |
| `entity_id` | string | Required; must exist in `config/owner.yaml` |
| `title` | string | |
| `url` | string | Optional if the source is a private doc |
| `type` | enum | `official`, `first_party`, `government`, `documentation`, `internal`, `third_party`, `unknown` |
| `status` | enum | Optional; same values as claims |
| `verified_at` | date or null | Optional, null allowed; **required (date) when `status: verified`** |

## Context, SOP and policy (front matter)

Same file style as claims and sources. Folders: `vault/contexts/`, `vault/sops/`, `vault/policies/` (examples in `examples/contexts|sops|policies/`). Schemas: `schema/context.schema.json`, `schema/sop.schema.json`, `schema/policy.schema.json`. The three share one field list; the Markdown body is the content.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique across the vault |
| `entity_id` | string | Required; must exist in `config/owner.yaml` |
| `title` | string | |
| `status` | enum | Same values as claims (`verified`, `unverified`, `deprecated`, `conflicting`, `draft`); agents never set `verified` |
| `updated` | date | `YYYY-MM-DD`, last change |

`get_sop` and `get_policy` look the record up by `id` (`sop_id`, `policy_id`). `get_context` maps `section` (`profile` or `brand`) to the id `ctx-<entity>-<section>`, for example `ctx-example-owner-profile`. This id convention is decided by the owner. Contexts, SOPs and policies are also written to the FTS table, but `search_context` still searches claims and sources only.

## Entities

Entities are registered in `config/owner.yaml` as `entities[]` with `id`, `type` (`person`, `brand`, `organization`) and `name`. Ids are unique across the whole vault (entities, claims and sources share one id space).

## Rules

- No claim without a `source_id`. An unsourced claim is a draft.
- Missing context is `UNKNOWN`, never guessed. Conflicting records surface the conflict.
- Agents only draft; a human commit promotes.
- `python scripts/validate.py` (needs `pyyaml`) checks all of the above.

## MCP tool arguments (worker)

The PRD names the 7 tools and gives `search_context(entity, query)` plus `types` and `limit` (REST search). The rest are inferred and need owner confirmation:

| Tool | Arguments | Status |
|---|---|---|
| `list_entities` | none | inferred |
| `get_context` | `entity`, `section` (`profile` or `brand`) | `section` inferred from REST `/profile`, `/brand`; reads context `ctx-<entity>-<section>`, UNKNOWN if missing |
| `get_entity` | `entity` | inferred |
| `get_sop` | `entity`, `sop_id` | reads the SOP file record, UNKNOWN if missing |
| `get_policy` | `entity`, `policy_id` | reads the policy file record, UNKNOWN if missing |
| `get_source` | `entity`, `source_id` | inferred |
| `search_context` | `entity`, `query`, `types` (`claim`, `source`), `limit` (1-20, default 5) | PRD |
