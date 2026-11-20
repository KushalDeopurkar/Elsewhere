"""Re-decide the category of events already in the database.

Run after the rules in categorize.py change, and on every scrape so events
saved under older rules are brought in line. Only upcoming events are read,
and only rows whose category actually changes are written.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Dict

from supabase import Client

from app.services.categorize import categorize

logger = logging.getLogger(__name__)

PAGE = 1000


def recategorize(client: Client, dry_run: bool = False, max_rows: int = 50_000) -> Dict[str, int]:
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    changed: Dict[str, list] = {}
    moves: Counter = Counter()
    seen = 0
    start = 0
    while start < max_rows:
        rows = (
            client.table("events")
            .select("id,title,description,category,source")
            .gte("start_time", since)
            .order("id")
            .range(start, start + PAGE - 1)
            .execute()
            .data
            or []
        )
        for r in rows:
            seen += 1
            new = categorize(r["title"], r.get("description"), r.get("category"), r.get("source"))
            if new != r.get("category"):
                changed.setdefault(new, []).append(r["id"])
                moves[f"{r.get('category')}->{new}"] += 1
        if len(rows) < PAGE:
            break
        start += PAGE

    total = sum(len(v) for v in changed.values())
    logger.info(f"Recategorize: {total} of {seen} upcoming events change category")
    for move, n in moves.most_common(15):
        logger.info(f"  {move}: {n}")
    if not dry_run:
        for cat, ids in changed.items():
            for i in range(0, len(ids), 200):
                client.table("events").update({"category": cat}).in_("id", ids[i:i + 200]).execute()
    return {"seen": seen, "changed": total}
