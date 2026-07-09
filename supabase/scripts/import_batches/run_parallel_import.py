#!/usr/bin/env python3
"""Execute pending CA water-body chunk imports in parallel via Supabase Management API.

Same backend as MCP execute_sql. Requires SUPABASE_ACCESS_TOKEN in environment.

Usage:
  SUPABASE_ACCESS_TOKEN=sbp_... python3 run_parallel_import.py status
  SUPABASE_ACCESS_TOKEN=sbp_... python3 run_parallel_import.py run [--min-total 2500] [--parallel 4]
  SUPABASE_ACCESS_TOKEN=sbp_... python3 run_parallel_import.py analyze
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_ID}/database/query"
CHUNKS_DIR = BASE / "_chunks"
RESULT = BASE / "_parallel_import_result.json"

TRACKER_FILES = [
    BASE / "_batch_import_results.json",
    BASE / "_IMPORT_CHUNKS_004_009_PROGRESS.json",
    BASE / "_import_log.json",
]


def token() -> str:
    t = os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_PAT")
    if not t:
        print("ERROR: Set SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)", file=sys.stderr)
        sys.exit(1)
    return t


def execute_sql_sync(auth: str, query: str) -> str:
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Authorization": f"Bearer {auth}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read().decode()


async def execute_sql(auth: str, query: str) -> str:
    return await asyncio.to_thread(execute_sql_sync, auth, query)


def load_done_chunks() -> set[str]:
    done: set[str] = set()
    for path in TRACKER_FILES:
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        done.update(data.get("chunks_done", []))
        done.update(data.get("completed", []))
        for batch in data.get("completed", []):
            if batch.startswith("batch_"):
                for c in CHUNKS_DIR.glob(f"{batch}_chunk_*.sql"):
                    done.add(c.name)
    return done


def all_chunks() -> list[Path]:
    return sorted(CHUNKS_DIR.glob("batch_*_chunk_*.sql"))


def pending_chunks() -> list[Path]:
    done = load_done_chunks()
    return [c for c in all_chunks() if c.name not in done]


async def query_counts(auth: str) -> dict:
    total = json.loads(
        await execute_sql(auth, "SELECT count(*)::int AS n FROM public.locations;")
    )
    cats = json.loads(
        await execute_sql(
            auth,
            "SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;",
        )
    )
    return {"total": total[0]["n"] if total else None, "by_category": cats}


async def cmd_status(auth: str) -> None:
    pending = pending_chunks()
    done = load_done_chunks()
    try:
        counts = await query_counts(auth)
    except Exception as e:
        counts = {"error": str(e)[:300]}
    out = {
        "total_chunks": len(all_chunks()),
        "tracked_done": len(done),
        "pending": len(pending),
        "pending_first": [p.name for p in pending[:8]],
        "counts": counts,
    }
    print(json.dumps(out, indent=2))


async def cmd_analyze(auth: str) -> None:
    await execute_sql(auth, "ANALYZE public.locations;")
    counts = await query_counts(auth)
    print(json.dumps({"analyzed": True, **counts}, indent=2))


async def cmd_run(auth: str, min_total: int, parallel: int, max_chunks: int | None) -> None:
    pending = pending_chunks()
    if max_chunks is not None:
        pending = pending[:max_chunks]

    try:
        before = (await query_counts(auth))["total"] or 0
    except Exception:
        before = None

    sem = asyncio.Semaphore(parallel)
    completed: list[str] = []
    errors: list[dict] = []

    async def run_one(path: Path) -> None:
        async with sem:
            print(f"RUN {path.name}...", flush=True)
            try:
                await execute_sql(auth, path.read_text())
                completed.append(path.name)
                print(f"OK  {path.name}")
            except Exception as e:
                err = str(e)[:500]
                errors.append({"chunk": path.name, "error": err})
                print(f"FAIL {path.name}: {err}", file=sys.stderr)

    for i in range(0, len(pending), parallel):
        wave = pending[i : i + parallel]
        await asyncio.gather(*(run_one(p) for p in wave))
        if min_total and before is not None:
            try:
                cur = (await query_counts(auth))["total"] or 0
                if cur >= min_total:
                    print(f"Reached min_total {min_total} (now {cur})", flush=True)
                    break
            except Exception:
                pass

    await execute_sql(auth, "ANALYZE public.locations;")
    try:
        after = await query_counts(auth)
    except Exception as e:
        after = {"error": str(e)[:300]}

    summary = {
        "before_total": before,
        "chunks_run": len(completed),
        "completed": completed,
        "errors": errors,
        "after": after,
        "limited": max_chunks is not None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    RESULT.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["status", "run", "analyze"])
    parser.add_argument("--min-total", type=int, default=2500)
    parser.add_argument("--parallel", type=int, default=4)
    parser.add_argument("--max-chunks", type=int, default=None)
    args = parser.parse_args()
    auth = token()

    if args.command == "status":
        asyncio.run(cmd_status(auth))
    elif args.command == "analyze":
        asyncio.run(cmd_analyze(auth))
    else:
        asyncio.run(cmd_run(auth, args.min_total, args.parallel, args.max_chunks))


if __name__ == "__main__":
    main()
