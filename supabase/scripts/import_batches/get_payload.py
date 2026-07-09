#!/usr/bin/env python3
"""Generate MCP execute_sql payloads for batches 001-034 (read via pathlib)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def main() -> None:
    n = int(sys.argv[1])
    sql = Path(BASE / f"batch_{n:03d}.sql").read_text()
    print(json.dumps({"project_id": PROJECT_ID, "query": sql, "batch": n}))


if __name__ == "__main__":
    main()
