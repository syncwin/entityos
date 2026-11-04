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

## Entities

Entities are registered in `config/owner.yaml` as `entities[]` with `id`, `type` (`person`, `brand`, `organization`) and `name`. Ids are unique across the whole vault (entities, claims and sources share one id space).

## Rules

- No claim without a `source_id`. An unsourced claim is a draft.
- Missing context is `UNKNOWN`, never guessed. Conflicting records surface the conflict.
- Agents only draft; a human commit promotes.
- `python scripts/validate.py` (needs `pyyaml`) checks all of the above.
