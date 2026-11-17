"""
Enrich pass: open each upcoming event's own page and store its full
description, ticket tiers and details. Runs after the scrape in GitHub
Actions. Polite: one request per host at a time with a delay, a capped
batch per run, and a 3-day refresh so pages are not re-fetched every 6 h.
"""
from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import httpx

from .detail_parser import parse_detail

logger = logging.getLogger("enricher")

SUPPORTED = {"district", "allevents", "meetup"}
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
)


def pick_batch(client, limit: int) -> List[Dict[str, Any]]:
    """Upcoming events never enriched, then the stalest, soonest first."""
    now = datetime.now(timezone.utc)
    stale = (now - timedelta(days=3)).isoformat()
    cols = "id,title,url,source,start_time,price_min,price_max,is_free"
    base = (
        client.table("events")
        .select(cols)
        .gte("start_time", (now - timedelta(hours=6)).isoformat())
        .in_("source", sorted(SUPPORTED))
        .not_.is_("url", "null")
    )
    fresh = base.is_("details_fetched_at", "null").order("start_time").limit(limit).execute().data or []
    if len(fresh) >= limit:
        return fresh
    older = (
        client.table("events")
        .select(cols)
        .gte("start_time", now.isoformat())
        .in_("source", sorted(SUPPORTED))
        .lt("details_fetched_at", stale)
        .order("start_time")
        .limit(limit - len(fresh))
        .execute()
        .data
        or []
    )
    return fresh + older


def price_update(row: Dict[str, Any], tickets: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Keep the listing's price columns in step with the real tiers, so
    cards, the Free filter and budget planning use the same numbers."""
    prices = [t["price"] for t in tickets if t.get("price") is not None and (t.get("currency") or "INR") == "INR"]
    if not prices:
        return {}
    lo, hi = min(prices), max(prices)
    out: Dict[str, Any] = {}
    if row.get("price_min") is None or abs((row.get("price_min") or 0) - lo) > 0.5:
        out["price_min"] = lo
    if hi > lo and (row.get("price_max") is None or abs((row.get("price_max") or 0) - hi) > 0.5):
        out["price_max"] = hi
    if hi == 0 and not row.get("is_free"):
        out["is_free"] = True
    return out


async def _fetch(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        r = await client.get(url, timeout=20)
        if r.status_code == 200 and "text/html" in r.headers.get("content-type", ""):
            return r.text
        logger.info("skip %s: HTTP %s", url, r.status_code)
    except httpx.HTTPError as e:
        logger.info("skip %s: %s", url, e)
    return None


async def enrich(db, limit: int = 150, delay: float = 1.2) -> Dict[str, int]:
    rows = pick_batch(db, limit)
    stats = {"picked": len(rows), "enriched": 0, "with_tiers": 0, "failed": 0}
    if not rows:
        return stats

    by_host: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        by_host.setdefault(httpx.URL(r["url"]).host, []).append(r)

    async with httpx.AsyncClient(headers={"User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9"}, follow_redirects=True) as http:

        async def run_host(items: List[Dict[str, Any]]) -> None:
            for r in items:
                html = await _fetch(http, r["url"])
                now = datetime.now(timezone.utc).isoformat()
                if not html:
                    stats["failed"] += 1
                    # Mark as tried so a dead page is retried in 3 days, not every run.
                    db.table("events").update({"details_fetched_at": now}).eq("id", r["id"]).execute()
                else:
                    parsed = parse_detail(html, r["source"], r.get("title") or "")
                    update: Dict[str, Any] = {
                        "tickets": parsed["tickets"] or None,
                        "details": parsed["details"] or None,
                        "details_fetched_at": now,
                        **price_update(r, parsed["tickets"]),
                    }
                    db.table("events").update(update).eq("id", r["id"]).execute()
                    stats["enriched"] += 1
                    if parsed["tickets"]:
                        stats["with_tiers"] += 1
                await asyncio.sleep(delay + random.random() * 0.6)

        await asyncio.gather(*(run_host(v) for v in by_host.values()))
    return stats
