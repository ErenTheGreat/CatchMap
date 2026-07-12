#!/usr/bin/env python3
"""Import SQL chunk files via Supabase MCP execute_sql (stdout progress JSON)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def load_query(path: Path) -> str:
    return path.read_text()


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: load_mcp_sql.py <sql-file>", file=sys.stderr)
        sys.exit(1)
    sql_path = Path(sys.argv[1]).resolve()
    payload = {"project_id": PROJECT_ID, "query": load_query(sql_path), "_file": sql_path.name}
    sys.stdout.write(json.dumps(payload))


if __name__ == "__main__":
    main()
