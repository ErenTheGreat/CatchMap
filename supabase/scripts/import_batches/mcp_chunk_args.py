#!/usr/bin/env python3
"""Agent helper: emit MCP execute_sql args for chunk index (0-35)."""
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
idx = int(sys.argv[1])
manifest = json.loads((BASE / "_EXEC_MANIFEST.json").read_text())
item = manifest[idx]
d = json.loads(Path(item["path"]).read_text())
print(json.dumps({"project_id": d["project_id"], "query": d["query"], "file": d["file"]}))
