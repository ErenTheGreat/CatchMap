#!/usr/bin/env python3
"""Print SQL from _mcp_queue JSON by index (1-based)."""
import json
import sys
from pathlib import Path

qdir = Path(__file__).resolve().parent / "_mcp_queue"
idx = int(sys.argv[1])
files = sorted(qdir.glob(f"{idx:02d}_*.json"))
if not files:
    sys.exit(f"no queue file for index {idx}")
d = json.loads(files[0].read_text())
sys.stdout.write(d["query"])
