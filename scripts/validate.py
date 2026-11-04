#!/usr/bin/env python3
"""Validate example claims and sources against the schemas.

Parses Markdown front matter (pyyaml) and checks it with a small JSON Schema checker
(keywords used here, incl. if/then/const). Also checks entity registry, id uniqueness
across all files, and that every claim's source_id exists.
"""
import datetime
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None)}


def load(p):
    return json.loads((ROOT / p).read_text(encoding="utf-8"))


def is_type(v, t):
    if t == "boolean":
        return isinstance(v, bool)
    return isinstance(v, TYPES[t]) and not isinstance(v, bool)


def check(v, s, path="$"):
    errs = []
    t = s.get("type")
    if t:
        ts = t if isinstance(t, list) else [t]
        if not any(is_type(v, x) for x in ts):
            return [f"{path}: expected {' or '.join(ts)}"]
    if "const" in s and v != s["const"]:
        errs.append(f"{path}: {v!r} != {s['const']!r}")
    if "enum" in s and v not in s["enum"]:
        errs.append(f"{path}: {v!r} not in {s['enum']}")
    if isinstance(v, str):
        if "pattern" in s and not re.search(s["pattern"], v):
            errs.append(f"{path}: {v!r} does not match {s['pattern']}")
        if len(v) < s.get("minLength", 0):
            errs.append(f"{path}: too short")
    if isinstance(v, list):
        for i, x in enumerate(v):
            errs += check(x, s.get("items", {}), f"{path}[{i}]")
    if isinstance(v, dict):
        props = s.get("properties", {})
        for r in s.get("required", []):
            if r not in v:
                errs.append(f"{path}: missing required '{r}'")
        for k, x in v.items():
            if k in props:
                errs += check(x, props[k], f"{path}.{k}")
            elif s.get("additionalProperties") is False:
                errs.append(f"{path}: unexpected property '{k}'")
    if "if" in s and not check(v, s["if"], path) and "then" in s:
        errs += check(v, s["then"], path)
    return errs

def front_matter(p):
    m = re.match(r"---\r?\n(.*?)\r?\n---\r?\n?", p.read_text(encoding="utf-8"), re.S)
    if not m:
        return None
    d = yaml.safe_load(m.group(1))
    if isinstance(d, dict):  # YAML parses bare dates; schemas expect strings
        d = {k: (x.isoformat() if isinstance(x, datetime.date) else x) for k, x in d.items()}
    return d


def load_dir(sub, schema, errs):
    rows = []
    for p in sorted((ROOT / "examples" / sub).glob("*.md")):
        d = front_matter(p)
        if d is None:
            errs.append(f"{p.name}: no YAML front matter")
            continue
        errs += check(d, schema, p.name)
        rows.append((p.name, d))
    return rows


def main():
    errs = []
    owner = yaml.safe_load((ROOT / "config/owner.example.yaml").read_text(encoding="utf-8"))
    errs += check(owner, load("schema/owner.schema.json"), "owner")
    entities = owner.get("entities", []) if isinstance(owner, dict) else []
    entity_ids = [e.get("id") for e in entities if isinstance(e, dict)]
    claims = load_dir("claims", load("schema/claim.schema.json"), errs)
    sources = load_dir("sources", load("schema/source.schema.json"), errs)
    all_ids = entity_ids + [d.get("id") for _, d in claims + sources]
    dup = sorted({i for i in all_ids if all_ids.count(i) > 1})
    if dup:
        errs.append(f"ids not globally unique: {dup}")
    for name, d in claims + sources:
        if d.get("entity_id") not in entity_ids:
            errs.append(f"{name}: entity_id {d.get('entity_id')!r} not in owner entities")
    source_ids = {d.get("id") for _, d in sources}
    for name, d in claims:
        if d.get("source_id") not in source_ids:
            errs.append(f"{name}: source_id {d.get('source_id')!r} not found in sources")
    print(f"owner.example.yaml: {len(entities)} entities checked")
    print(f"examples/claims: {len(claims)} claims checked")
    print(f"examples/sources: {len(sources)} sources checked")
    if errs:
        print("FAIL")
        print("\n".join(errs))
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
