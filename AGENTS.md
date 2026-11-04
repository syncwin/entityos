# AGENTS.md (canonical, tool-neutral)

EntityOS template: a white-label personal context store of sourced claims (facts about an owner, with provenance). Public template, MIT, no real data. Phases 0-3 (local only): schemas, a read-only MCP Worker (`worker/`) and a derived D1 index; no CI, no deploy. Rules for any AI tool or contributor.

## Repo map

| Path | Purpose |
|---|---|
| `schema/` | JSON Schemas: `claim.schema.json`, `source.schema.json`, `owner.schema.json` |
| `config/owner.example.yaml` | Placeholder owner config (real `config/owner.yaml` lives only in a private instance) |
| `docs/claims-and-sources.md` | Field tables, rules, open questions |
| `examples/` | Fake sample claims and sources |
| `scripts/validate.py` | Validator (needs `pyyaml`) |
| `scripts/index/build_index.py` | Builds the derived D1 index (SQL) from the Markdown files |
| `worker/` | Cloudflare Worker: 7 read-only MCP tools at `/mcp`, `migrations/`, `test/` |
| `.claude/ownership.md` | Owner and steward per path (obey it) |

## Commands

- Validate (run before every commit): `python scripts/validate.py`
- Worker (run in `worker/`; `npm install` first): `npm run typecheck`, `npm test` (unit), `npm run test:e2e` (`wrangler dev --local` + local D1 against the examples; reports PASS/FAIL/NOT RUN per check).
- Build index SQL: `python scripts/index/build_index.py --out <file>`, then `npx wrangler d1 execute entityos-db --local --file <file>`.
- LOCAL ONLY until the owner confirms names: never run `wrangler deploy`, `wrangler d1 create`, `--remote` or `wrangler login`. Names `entityos-worker` / `entityos-db` are placeholders; no account or database IDs in the repo.
- Secret `ENTITYOS_TOKEN` (32+ chars) goes in git-ignored `worker/.dev.vars` locally, or a Worker secret in a private instance. Never in a file that is committed.
- Migrations in `worker/migrations/` are numbered and additive-only; the index is rebuilt from files (files win). The Worker has no write tools (PRD section 13).
- No lint or formatter exists.

## Rules

- Public/private boundary: this repo never holds real biographical, business or personal data, names, stats, clients or URLs tied to a real person. If a change would, stop and ask; it belongs in the private instance.
- Never write a claim without a `source_id`. Never promote a claim to `verified` on your own; that is a human decision.
- Never fabricate facts to fill a gap; mark it `UNKNOWN` and say so.
- White-label: never hardcode an owner name, entity ID or brand outside `config/owner.yaml`.
- Never invent schema fields. If the PRD does not define something, leave a `TODO` and ask.
- Never delete or weaken tests or schemas to make validation pass. Report failed, skipped or timed-out runs honestly (NOT RUN is never a pass).
- Never commit secrets. Before every commit run `git diff --cached` and grep for `github_pat_|ghp_|sk-|Bearer |password=|api_key|token =`; on any match, stop.
- Work on a branch and open a PR. Never push to main. No commits, pushes or PRs unless asked.
- Lean code: smallest change that does the job, no new dependencies without asking. Follow neighbouring code. Never pick names or slugs without user confirmation.

## Model routing

- Opus plans, decides, writes self-contained briefs (with a report word limit) and reviews every subagent result before accepting it.
- Haiku: search, reading, mechanical edits. Sonnet: coding, tests, multi-step work.
- Never delegate what takes one or two tool calls; do it inline.

## Docs

`README.md`, `CONTRIBUTING.md`, `docs/claims-and-sources.md`.
