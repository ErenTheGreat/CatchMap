#!/usr/bin/env python3
"""Print MCP execute_sql arguments JSON for a chunk key (reads _mcp_chunks/*.sql)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
CHUNKS = BASE / "_mcp_chunks"
PROJECT = "cpzwvlpqdzjjsdlnmfgg"


def main() -> None:
    key = sys.argv[1]
    sql = (CHUNKS / f"{key}.sql").read_text()
    print(json.dumps({"project_id": PROJECT, "query": sql, "key": key}))


if __name__ == "__main__":
    main()
