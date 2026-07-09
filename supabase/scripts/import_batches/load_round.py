#!/usr/bin/env python3
"""Load MCP payloads for a parallel batch of 4 chunks (round 0-8)."""
import json
import sys
from pathlib import Path

QUEUE = Path(__file__).resolve().parent / "_mcp_queue"
OUT = Path(__file__).resolve().parent / "_chunks" / "_mcp_batch"
round_idx = int(sys.argv[1])
start = round_idx * 4
files = sorted(QUEUE.glob("[0-9][0-9]_batch_*.json"))
batch = [f for f in files if int(f.name[:2]) in range(start, start + 4)]
OUT.mkdir(parents=True, exist_ok=True)
meta = []
for f in batch:
    d = json.loads(f.read_text())
    idx = int(f.name[:2])
    out = OUT / f"payload_{idx:02d}.json"
    out.write_text(json.dumps({"project_id": d["project_id"], "query": d["query"], "file": d["file"]}))
    meta.append({"index": idx, "file": d["file"], "payload": str(out), "bytes": len(d["query"])})
print(json.dumps(meta))
