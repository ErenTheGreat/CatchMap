#!/usr/bin/env python3
"""Print execute_sql args JSON for chunk key (agent loads into CallMcpTool)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
QUEUE = BASE / "_mcp_queue" / "run_args"


def main() -> None:
    key = sys.argv[1]
    path = QUEUE / f"args_{key}.json"
    if not path.exists():
        path = BASE / "_mcp_queue" / f"mcp_invoke_{key}.json"
    d = json.loads(path.read_text())
    sys.stdout.write(json.dumps({"project_id": d["project_id"], "query": d["query"]}))


if __name__ == "__main__":
    main()
