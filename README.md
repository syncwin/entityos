# EntityOS (template)

EntityOS stores facts about an owner (a person, business or brand) as **claims**, each traced to a **source**. Missing context is `UNKNOWN`, never guessed. Skills and agents will query it instead of hardcoding facts.

This repository is the **public template** (MIT). **No real data belongs here**: placeholder and example values only. Real data lives in a private fork. Status: Phases 0-3, local only: schemas, a read-only MCP Worker and a derived D1/FTS5 index (no CI, nothing deployed).

## What is in here

| Path | Purpose |
|---|---|
| `schema/*.schema.json` | The claim, source and owner shapes |
| `docs/claims-and-sources.md` | Field tables, rules, open questions |
| `config/owner.example.yaml` | Placeholder owner config |
| `examples/` | Fake sample claims and sources |
| `scripts/validate.py` | Validates the examples against the schemas |
| `scripts/index/build_index.py` | Builds the derived D1 index (SQL) from the Markdown files |
| `worker/` | Cloudflare Worker with 7 read-only MCP tools (`/mcp`), migrations, tests |
| `.claude/ownership.md` | Owner and steward per path |

## Make your own private instance

1. Create an empty **private** repo on your account (for example `<you>/entityos`).
2. Clone it, then add this template as `upstream`:
   ```
   git remote add upstream https://github.com/syncwin/entityos.git
   git fetch upstream
   git merge upstream/main --allow-unrelated-histories
   ```
3. Copy `config/owner.example.yaml` to `config/owner.yaml` and fill it in.
4. Run `python scripts/validate.py`, then add your data.
5. Pull template updates later with `git fetch upstream && git merge upstream/main`.
6. Never commit secrets.

## Validate

```
python scripts/validate.py
```

Needs `pyyaml`.

## Worker (local)

Placeholder names (`entityos-worker`, `entityos-db`): confirm before deploying. Local only, no Cloudflare login needed.

```
cd worker && npm install
npm run typecheck && npm test      # unit tests
npm run test:e2e                   # wrangler dev --local + local D1, all 7 tools
```

Run by hand: put a 32+ character token in `worker/.dev.vars` as `ENTITYOS_TOKEN=...` (git-ignored), apply migrations and load the index (see AGENTS.md), then `npm run dev` and POST JSON-RPC to `http://127.0.0.1:8787/mcp` with `Authorization: Bearer <token>`.

Tools (read-only): `list_entities`, `get_context`, `get_entity`, `get_sop`, `get_policy`, `get_source`, `search_context`. Missing context returns `{"error":"UNKNOWN",...}`. Markdown files stay canonical; the D1 index is rebuilt from them and files win.

## License

MIT, (c) 2026 SyncWin.
