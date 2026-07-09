#!/usr/bin/env python3
"""Emit MCP execute_sql payloads for import batch chunks.

Usage:
  python3 mcp_chunk_runner.py list
  python3 mcp_chunk_runner.py payload 028 02
  python3 mcp_chunk_runner.py pending
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
DONE_LOG = BASE / "_chunk_done.json"


def chunk_files() -> list[tuple[str, str, Path]]:
    out: list[tuple[str, str, Path]] = []
    for p in sorted(BASE.glob(".chunk_invoke_*_*.json")):
        parts = p.stem.split("_")  # .chunk_invoke_028_02
        batch, chunk = parts[-2], parts[-1]
        out.append((batch, chunk, p))
    return out


def load_done() -> set[str]:
    if not DONE_LOG.exists():
        return set()
    return set(json.loads(DONE_LOG.read_text()))


def save_done(keys: set[str]) -> None:
    DONE_LOG.write_text(json.dumps(sorted(keys), indent=2))


def payload(batch: str, chunk: str) -> dict:
    p = BASE / f".chunk_invoke_{batch}_{chunk}.json"
    data = json.loads(p.read_text())
    return {"project_id": data.get("project_id", PROJECT_ID), "query": data["query"]}


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "list":
        for batch, chunk, _ in chunk_files():
            print(f"{batch}_{chunk}")
        return
    if cmd == "pending":
        done = load_done()
        for batch, chunk, _ in chunk_files():
            key = f"{batch}_{chunk}"
            if key not in done:
                print(key)
        return
    if cmd == "payload":
        batch, chunk = sys.argv[2], sys.argv[3]
        print(json.dumps(payload(batch, chunk)))
        return
    if cmd == "mark":
        done = load_done()
        done.add(sys.argv[2])
        save_done(done)
        print(f"marked {sys.argv[2]}")
        return
    raise SystemExit(f"unknown cmd: {cmd}")


if __name__ == "__main__":
    main()
