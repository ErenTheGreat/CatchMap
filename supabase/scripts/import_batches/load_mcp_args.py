#!/usr/bin/env python3
"""Load execute_sql args for chunk key (stdout JSON for CallMcpTool)."""
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent / "_mcp_queue" / "run_args"
key = sys.argv[1]
p = BASE / f"_invoke_{key}.json"
if not p.exists():
    p = BASE / f"args_{key}.json"
sys.stdout.write(p.read_text())
