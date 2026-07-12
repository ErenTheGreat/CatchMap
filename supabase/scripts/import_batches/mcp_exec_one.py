#!/usr/bin/env python3
"""Print one batch's MCP execute_sql payload path and metadata."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def main() -> None:
    n = int(sys.argv[1])
    name = f"batch_{n:03d}"
    sql = (BASE / f"{name}.sql").read_text()
    out = BASE.parent.parent.parent / f"_mcp_exec_{n:03d}.json"
    out.write_text(json.dumps({"project_id": PROJECT_ID, "query": sql, "batch": name}))
    print(json.dumps({"batch": name, "chars": len(sql), "file": str(out)}))


if __name__ == "__main__":
    main()
