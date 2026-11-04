# Claims and sources

A **claim** is one atomic, individually sourced fact. A **source** is the record that proves it. Schemas: `schema/claim.schema.json`, `schema/source.schema.json`.

## Claim

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique per entity |
| `statement` | string | One atomic fact |
| `status` | enum | `verified`, `unverified`, `deprecated`, `conflicting`, `draft` |
| `source_id` | string | Required; must match a source `id` |
| `verified_at` | date or null | `YYYY-MM-DD`; null if unverified |

## Source

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique per entity |
| `title` | string | |
| `url` | string | Optional if the source is a private doc |
| `type` | enum | `official`, `first_party`, `government`, `documentation`, `internal`, `third_party`, `unknown` |
| `verified_at` | date | |

## Rules

- No claim without a `source_id`. An unsourced claim is a draft.
- Missing context is `UNKNOWN`, never guessed. Conflicting records surface the conflict.
- Agents only draft; a human commit promotes.

## Open (not defined in the PRD)

- On-disk record format in the vault (one file per claim or per list; YAML or Markdown frontmatter).
- Whether `verified_at` is required on a source, and whether `status: verified` must carry a date.
- Schema for `config/owner.yaml`.
