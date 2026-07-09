#!/usr/bin/env python3
"""Execute all chunks 010-018 via Supabase Management API (parallel batches of 4)."""
from __future__ import annotations

import asyncio
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
QUEUE = BASE / "_mcp_queue"
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_ID}/database/query"
PARALLEL = 4
START = int(sys.argv[1]) if len(sys.argv) > 1 else 10
END = int(sys.argv[2]) if len(sys.argv) > 2 else 18
RESULT = BASE / f"_IMPORT_CHUNKS_{START:03d}_{END:03d}.json"


def chunk_queue_files() -> list[Path]:
    files: list[Path] = []
    for b in range(START, END + 1):
        for c in range(1, 5):
            pat = f"*_batch_{b:03d}_chunk_{c:02d}.sql.json"
            matches = sorted(QUEUE.glob(pat))
            if not matches:
                raise FileNotFoundError(f"missing queue for batch_{b:03d}_chunk_{c:02d}")
            files.append(matches[0])
    return files


def execute_sql(token: str, query: str) -> None:
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        if resp.status >= 400:
            raise RuntimeError(resp.read().decode()[:500])


async def main() -> None:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_PAT")
    if not token:
        print("ERROR: Set SUPABASE_ACCESS_TOKEN", file=sys.stderr)
        sys.exit(1)

    files = chunk_queue_files()
    sem = asyncio.Semaphore(PARALLEL)
    completed: list[str] = []
    errors: list[dict] = []

    async def run_one(path: Path) -> None:
        d = json.loads(path.read_text())
        name = d["file"]
        sql = d["query"]
        async with sem:
            print(f"RUN {name} ({len(sql)} bytes)...", flush=True)
            try:
                await asyncio.to_thread(execute_sql, token, sql)
                completed.append(name)
                print(f"OK {name}", flush=True)
            except Exception as e:
                errors.append({"chunk": name, "error": str(e)[:500]})
                print(f"FAIL {name}: {e}", file=sys.stderr)

    await asyncio.gather(*(run_one(p) for p in files))

    summary = {"chunks_run": len(completed), "chunks_total": len(files), "completed": completed, "errors": errors}
    RESULT.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
