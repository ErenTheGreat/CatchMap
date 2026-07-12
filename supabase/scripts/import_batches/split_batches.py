#!/usr/bin/env python3
"""Split batch SQL files into ~125-row chunks for MCP execute_sql."""
from __future__ import annotations

import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROWS_PER_CHUNK = 125


def parse_rows(values_block: str) -> list[str]:
    rows: list[str] = []
    depth = 0
    start = 0
    for i, ch in enumerate(values_block):
        if ch == "(":
            if depth == 0:
                start = i
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                rows.append(values_block[start : i + 1])
    return rows


def split_batch(n: int, batch_dir: Path) -> list[str]:
    sql = Path(batch_dir / f"batch_{n:03d}.sql").read_text()
    m = re.search(
        r"FROM\s*\(\s*VALUES\s+(.+?)\)\s*AS\s+v(?:\([^)]*\))?",
        sql,
        re.DOTALL | re.IGNORECASE,
    )
    if not m:
        m = re.search(r"FROM \(VALUES (.+)\) AS v", sql, re.DOTALL)
    if not m:
        raise ValueError(f"batch_{n:03d}: cannot parse VALUES block")
    header = sql[: m.start(1)]
    footer = sql[m.end(1) :]
    rows = parse_rows(m.group(1))
    if not rows:
        raise ValueError(f"batch_{n:03d}: no rows parsed")
    chunks: list[str] = []
    for i in range(0, len(rows), ROWS_PER_CHUNK):
        part = ",\n  ".join(rows[i : i + ROWS_PER_CHUNK])
        chunks.append(f"{header}{part}{footer}")
    return chunks


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Split batch SQL into MCP-sized chunks")
    parser.add_argument("start", nargs="?", type=int, default=1)
    parser.add_argument("end", nargs="?", type=int, default=34)
    parser.add_argument(
        "--dir",
        type=Path,
        default=BASE,
        help="Directory containing batch_NNN.sql files (default: script dir)",
    )
    args = parser.parse_args()

    batch_dir = args.dir.resolve()
    chunk_dir = batch_dir / "_chunks"
    chunk_dir.mkdir(exist_ok=True)
    total = 0
    for n in range(args.start, args.end + 1):
        chunks = split_batch(n, batch_dir)
        for ci, chunk_sql in enumerate(chunks, 1):
            out = chunk_dir / f"batch_{n:03d}_chunk_{ci:02d}.sql"
            out.write_text(chunk_sql)
            total += 1
            print(f"batch_{n:03d} chunk {ci}/{len(chunks)}: {len(chunk_sql)} bytes -> {out.name}")
    print(f"total_chunks={total}")


if __name__ == "__main__":
    main()
