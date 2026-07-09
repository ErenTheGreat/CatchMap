#!/usr/bin/env python3
"""Print MCP execute_sql args JSON for a chunk key (reads _invoke_args/{key}.call.json)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT = "cpzwvlpqdzjjsdlnmfgg"


def args_for(key: str) -> dict:
    p = BASE / "_invoke_args" / f"{key}.call.json"
    if p.exists():
        return json.loads(p.read_text())
    sql = (BASE / "_mcp_chunks" / f"{key}.sql").read_text()
    return {"project_id": PROJECT, "query": sql}


def main() -> None:
    print(json.dumps(args_for(sys.argv[1])))


if __name__ == "__main__":
    main()
