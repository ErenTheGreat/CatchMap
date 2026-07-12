#!/usr/bin/env python3
"""Import all 42 CA JSON chunks via Supabase Management API (MCP execute_sql backend)."""
from __future__ import annotations

import asyncio
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_ID}/database/query"
CHUNK_DIR = Path(__file__).resolve().parent.parent / "supabase/scripts/import_batches/_ca_json_chunks"
STATUS_PATH = Path(__file__).resolve().parent.parent / ".import/ca_chunks/import_status.json"
PARALLEL = 4
TOTAL = 42


def token() -> str:
    t = os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_PAT")
    if not t:
        raise SystemExit("SUPABASE_ACCESS_TOKEN not set")
    return t


def read_chunk(n: int) -> tuple[str, str]:
    file = f"chunk_{n:04d}.sql"
    sql = (CHUNK_DIR / file).read_text()
    return file, sql


def load_status() -> dict:
    if STATUS_PATH.exists():
        return json.loads(STATUS_PATH.read_text())
    return {"baseline": 2778, "ok": [], "failed": [], "startedAt": ""}


def save_status(status: dict) -> None:
    STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATUS_PATH.write_text(json.dumps(status, indent=2))


def execute_sql_sync(auth: str, query: str) -> str:
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Authorization": f"Bearer {auth}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return resp.read().decode()


async def execute_sql(auth: str, query: str) -> str:
    return await asyncio.to_thread(execute_sql_sync, auth, query)


async def run_chunk(auth: str, n: int, status: dict) -> dict:
    file, sql = read_chunk(n)
    try:
        await execute_sql(auth, sql)
        if file not in status["ok"]:
            status["ok"].append(file)
        status["failed"] = [f for f in status["failed"] if f.get("file") != file]
        save_status(status)
        return {"n": n, "file": file, "ok": True}
    except Exception as e:
        err = str(e)[:500]
        if not any(f.get("file") == file for f in status["failed"]):
            status["failed"].append({"file": file, "error": err})
        save_status(status)
        return {"n": n, "file": file, "ok": False, "error": err}


async def main() -> None:
    auth = token()
    status = load_status()
    done = set(status.get("ok", []))
    pending = [n for n in range(1, TOTAL + 1) if f"chunk_{n:04d}.sql" not in done]
    results: list[dict] = []

    for i in range(0, len(pending), PARALLEL):
        wave = pending[i : i + PARALLEL]
        wave_results = await asyncio.gather(*[run_chunk(auth, n, status) for n in wave])
        results.extend(wave_results)
        print(f"Wave {i // PARALLEL}: {wave_results}", flush=True)

    await execute_sql(auth, "ANALYZE public.locations;")
    total = json.loads(await execute_sql(auth, "SELECT count(*)::int AS total FROM public.locations;"))[0]["total"]
    ca = json.loads(
        await execute_sql(
            auth,
            "SELECT count(*)::int AS n FROM public.locations WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42.0 AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114.0;",
        )
    )[0]["n"]
    cats = json.loads(
        await execute_sql(auth, "SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;")
    )
    summary = {
        "total": total,
        "ca_bbox": ca,
        "categories": cats,
        "ok": status["ok"],
        "failed": status["failed"],
        "results": results,
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
