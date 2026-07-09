#!/usr/bin/env python3
"""Execute all pending chunks via Supabase MCP - prints chunk keys for agent MCP calls."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
CHUNKS = BASE / "_mcp_chunks"
LOG = BASE / "_mcp_chunk_log.json"
PROJECT = "cpzwvlpqdzjjsdlnmfgg"
DONE = {"028_01", "028_02"}


def load_log() -> dict:
    if LOG.exists():
        return json.loads(LOG.read_text())
    return {"ok": list(DONE), "errors": []}


def save_log(log: dict) -> None:
    LOG.write_text(json.dumps(log, indent=2))


def pending() -> list[str]:
    log = load_log()
    ok = set(log.get("ok", []))
    return sorted(p.stem for p in CHUNKS.glob("*.sql") if p.stem not in ok)


def payload(key: str) -> dict:
    sql = (CHUNKS / f"{key}.sql").read_text()
    return {"project_id": PROJECT, "query": sql, "key": key}


def mark_ok(key: str) -> None:
    log = load_log()
    if key not in log["ok"]:
        log["ok"].append(key)
    save_log(log)


def mark_err(key: str, err: str) -> None:
    log = load_log()
    log.setdefault("errors", []).append({"chunk": key, "error": err})
    save_log(log)


def batches(n: int = 4) -> list[list[str]]:
    p = pending()
    return [p[i : i + n] for i in range(0, len(p), n)]


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "status":
        log = load_log()
        print(json.dumps({"ok": log.get("ok", []), "pending": pending(), "errors": log.get("errors", [])}, indent=2))
    elif cmd == "batch":
        idx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        b = batches()
        if idx >= len(b):
            print(json.dumps([]))
        else:
            print(json.dumps(b[idx]))
    elif cmd == "payload":
        print(json.dumps(payload(sys.argv[2])))
    elif cmd == "mark_ok":
        mark_ok(sys.argv[2])
        print(f"ok {sys.argv[2]}")
    elif cmd == "mark_err":
        mark_err(sys.argv[2], sys.argv[3])
        print(f"err {sys.argv[2]}")
    elif cmd == "batches_count":
        print(len(batches()))


if __name__ == "__main__":
    main()
