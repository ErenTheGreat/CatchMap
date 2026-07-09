#!/usr/bin/env python3
"""Load MCP execute_sql args for a chunk key from _invoke_args/{key}.call.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent / "_invoke_args"


def main() -> None:
    key = sys.argv[1]
    path = BASE / f"{key}.call.json"
    if not path.exists():
        path = BASE / f"{key}.mcp.json"
    print(path.read_text())


if __name__ == "__main__":
    main()
