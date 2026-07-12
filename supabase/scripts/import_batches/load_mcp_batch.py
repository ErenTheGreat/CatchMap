#!/usr/bin/env python3
"""Load batch SQL via pathlib and print MCP execute_sql arguments as JSON to stdout."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def main() -> None:
    n = int(sys.argv[1])
    query = Path(BASE / f"batch_{n:03d}.sql").read_text()
    payload = {"project_id": PROJECT_ID, "query": query}
    sys.stdout.write(json.dumps(payload))


if __name__ == "__main__":
    main()
