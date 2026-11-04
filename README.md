# EntityOS (template)

EntityOS stores facts about an owner (a person, business or brand) as **claims**, each traced to a **source**. Missing context is `UNKNOWN`, never guessed. Skills and agents will query it instead of hardcoding facts.

This repository is the **public template** (MIT). **No real data belongs here**: placeholder and example values only. Real data lives in a private fork. Status: Phase 0, schemas only (no Worker, database or CI yet).

## What is in here

| Path | Purpose |
|---|---|
| `schema/*.schema.json` | The claim, source and owner shapes |
| `docs/claims-and-sources.md` | Field tables, rules, open questions |
| `config/owner.example.yaml` | Placeholder owner config |
| `examples/` | Fake sample claims and sources |
| `scripts/validate.py` | Validates the examples against the schemas |
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

Python standard library only.

## License

MIT, (c) 2026 SyncWin.
