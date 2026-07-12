#!/usr/bin/env python3
"""Load MCP execute_sql args for round R chunk I (0-3)."""
import json
import sys
from pathlib import Path

r, i = int(sys.argv[1]), int(sys.argv[2])
p = Path(__file__).resolve().parent / f"_round{r}_q{i}.json"
print(p.read_text())
