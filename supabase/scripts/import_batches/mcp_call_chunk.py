#!/usr/bin/env python3
"""Emit MCP execute_sql arguments for chunk index 0-35."""
import json
import sys
from pathlib import Path

QUEUE = Path(__file__).resolve().parent / "_mcp_queue"
idx = int(sys.argv[1])
files = sorted(QUEUE.glob("[0-9][0-9]_batch_*.json"))
target = None
for f in files:
    if int(f.name[:2]) == idx:
        target = f
        break
if not target:
    print(f"ERROR: no queue file for index {idx}", file=sys.stderr)
    sys.exit(1)
d = json.loads(target.read_text())
print(json.dumps({"project_id": d["project_id"], "query": d["query"], "file": d["file"]}))
