#!/usr/bin/env python3
"""Extract a parallel batch of 4 chunks from manifest for MCP import."""
import json
import sys
from pathlib import Path

MANIFEST = Path(__file__).resolve().parent / "_manifest_010_018.json"
OUT_DIR = Path(__file__).resolve().parent / "_mcp_batch"

batch_idx = int(sys.argv[1])
chunks = json.loads(MANIFEST.read_text())
start = batch_idx * 4
batch = chunks[start : start + 4]
OUT_DIR.mkdir(exist_ok=True)
meta = []
for i, ch in enumerate(batch):
    out = OUT_DIR / f"{start + i:02d}_{ch['name']}"
    out.write_text(ch["sql"])
    meta.append({"index": start + i, "name": ch["name"], "path": str(out), "bytes": ch["bytes"]})
(Path(__file__).resolve().parent / "_current_batch.json").write_text(json.dumps(meta, indent=2))
print(json.dumps(meta))
