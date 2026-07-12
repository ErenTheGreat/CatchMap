#!/usr/bin/env python3
"""Load batch SQL payload for MCP execute_sql (prints JSON to stdout)."""
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def main() -> None:
    n = int(sys.argv[1])
    sql_path = BASE / f"batch_{n:03d}.sql"
    if not sql_path.exists():
        sys.exit(f"missing {sql_path}")
    payload = {"project_id": PROJECT_ID, "query": sql_path.read_text(), "batch": f"batch_{n:03d}"}
    json.dump(payload, sys.stdout)


if __name__ == "__main__":
    main()
