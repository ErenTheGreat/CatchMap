#!/usr/bin/env python3
"""Emit MCP execute_sql args for CA JSON chunk N (1-42). Reads SQL via pathlib."""
import json
import sys
from pathlib import Path

PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
CHUNK_DIR = Path(__file__).resolve().parent / "_ca_json_chunks"


def main() -> None:
    n = int(sys.argv[1])
    file = f"chunk_{n:04d}.sql"
    sql = (CHUNK_DIR / file).read_text()
    sys.stdout.write(json.dumps({"project_id": PROJECT_ID, "file": file, "query": sql}))


if __name__ == "__main__":
    main()
