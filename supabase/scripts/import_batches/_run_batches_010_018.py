#!/usr/bin/env python3
"""Load batches 010-018 SQL and write per-batch query files for MCP execute_sql."""
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
OUT = BASE.parent.parent.parent  # project root
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"

manifest = []
for n in range(10, 19):
    name = f"batch_{n:03d}"
    sql = (BASE / f"{name}.sql").read_text()
    payload = {"project_id": PROJECT_ID, "query": sql, "batch": name}
    out_path = OUT / f".mcp_exec_{n:03d}.json"
    out_path.write_text(json.dumps(payload))
    manifest.append({"batch": name, "chars": len(sql), "path": str(out_path)})

(OUT / ".mcp_manifest_010_018.json").write_text(json.dumps(manifest, indent=2))
print(json.dumps(manifest, indent=2))
