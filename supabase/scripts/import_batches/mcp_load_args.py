#!/usr/bin/env python3
"""Load MCP execute_sql args for chunk key from _mcp_invoke/{key}.json or _invoke_args."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT = "cpzwvlpqdzjjsdlnmfgg"


def args_for(key: str) -> dict:
    for p in (
        BASE / "_mcp_invoke" / f"{key}.json",
        BASE / "_invoke_args" / f"{key}.call.json",
    ):
        if p.exists():
            return json.loads(p.read_text())
    sql = (BASE / "_mcp_chunks" / f"{key}.sql").read_text()
    return {"project_id": PROJECT, "query": sql}


if __name__ == "__main__":
    print(json.dumps(args_for(sys.argv[1])))
