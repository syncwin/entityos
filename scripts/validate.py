#!/usr/bin/env python3
"""Validate example claims and sources against the schemas.

Standard library only (a small checker for the JSON Schema keywords used here).
Also checks id uniqueness and that every claim's source_id exists.
"""
import json
import re
import sys
from pathlib import Path

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
    return errs


def main():
    claim_schema = load("schema/claim.schema.json")
    source_schema = load("schema/source.schema.json")
    claims = load("examples/claims.sample.json")
    sources = load("examples/sources.sample.json")
    errs = []
    for i, c in enumerate(claims):
        errs += check(c, claim_schema, f"claims[{i}]")
    for i, s in enumerate(sources):
        errs += check(s, source_schema, f"sources[{i}]")
    for name, rows in (("claims", claims), ("sources", sources)):
        ids = [r.get("id") for r in rows]
        if len(ids) != len(set(ids)):
            errs.append(f"{name}: duplicate ids")
    source_ids = {s.get("id") for s in sources}
    for i, c in enumerate(claims):
        if c.get("source_id") not in source_ids:
            errs.append(f"claims[{i}]: source_id {c.get('source_id')!r} not found in sources")
    print(f"claims.sample.json: {len(claims)} claims checked")
    print(f"sources.sample.json: {len(sources)} sources checked")
    if errs:
        print("FAIL")
        print("\n".join(errs))
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
