"""
Pictures for events whose source sends none (iCal calendars such as Luma,
SeatGeek, football fixtures): open the event's own page and take the
picture the page itself shares, its og:image, JSON-LD image or Twitter
card. Nothing is made up: an event whose page has no picture keeps none.

Polite like the details pass: one request per host at a time with a delay,
a capped batch per run, and a host that starts refusing is left alone for
the rest of the run.

A page that loaded but had no picture is marked with an empty image_url, so
it is not fetched again every six hours; a page that failed to load stays
NULL and is tried again next run.
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from html import unescape
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urljoin

import httpx

from .enricher import UA

logger = logging.getLogger("images")

#: How far ahead to look for events without a picture.
HORIZON_DAYS = 30
#: Pages fetched per host per run, and refusals before a host is skipped.
PER_HOST = 80
REFUSALS = 5
#: The same picture on more pages than this in one run is the site's
#: default (a logo or banner), not this event's picture.
GENERIC_AFTER = 3

_META = re.compile(r"<meta\b[^>]*>", re.I)
_LINK = re.compile(r"<link\b[^>]*>", re.I)
_ATTR = re.compile(r'([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|\'([^\']*)\')')
_LD = re.compile(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.I | re.S)


def _attrs(tag: str) -> Dict[str, str]:
    return {m.group(1).lower(): unescape(m.group(3) if m.group(3) is not None else m.group(4)) for m in _ATTR.finditer(tag)}


def _ld_image(value: Any) -> Optional[str]:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        for v in value:
            got = _ld_image(v)
            if got:
                return got
    if isinstance(value, dict):
        return _ld_image(value.get("url") or value.get("contentUrl"))
    return None


def _ld_blocks(html: str) -> Iterable[Dict[str, Any]]:
    for raw in _LD.findall(html):
        try:
            data = json.loads(raw.strip())
        except ValueError:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            item = stack.pop(0)
            if isinstance(item, dict):
                if "@graph" in item and isinstance(item["@graph"], list):
                    stack.extend(item["@graph"])
                yield item


def image_from_html(html: str, page_url: str) -> Optional[str]:
    """The picture a page shares for itself, as an absolute http(s) URL, or None."""
    found: Optional[str] = None
    # 1. The page's structured data for the event itself.
    for block in _ld_blocks(html):
        types = block.get("@type")
        types = types if isinstance(types, list) else [types]
        if any(isinstance(t, str) and t.endswith("Event") for t in types):
            found = _ld_image(block.get("image"))
            if found:
                break
    # 2. Open Graph and Twitter cards, then <link rel="image_src">.
    if not found:
        metas = [_attrs(t) for t in _META.findall(html)]
        for key in ("og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"):
            for m in metas:
                if (m.get("property") or m.get("name") or "").lower() == key and m.get("content"):
                    found = m["content"]
                    break
            if found:
                break
    if not found:
        for t in _LINK.findall(html):
            a = _attrs(t)
            if (a.get("rel") or "").lower() == "image_src" and a.get("href"):
                found = a["href"]
                break
    if not found:
        return None
    url = urljoin(page_url, found.strip())
    if not url.lower().startswith(("http://", "https://")):
        return None
    # Tracking pixels and favicons are not pictures of the event.
    if re.search(r"(favicon|/pixel|1x1|spacer)\.?", url, re.I) or url.lower().endswith(".ico"):
        return None
    return url


def generic_images(found: Dict[str, Optional[str]]) -> set[str]:
    """Pictures seen on more than GENERIC_AFTER pages this run: site defaults."""
    counts = Counter(v for v in found.values() if v)
    return {img for img, n in counts.items() if n > GENERIC_AFTER}


def pick_batch(db, limit: int) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    return (
        db.table("events")
        .select("id,url,source,start_time")
        .gte("start_time", (now - timedelta(hours=6)).isoformat())
        .lte("start_time", (now + timedelta(days=HORIZON_DAYS)).isoformat())
        .is_("image_url", "null")
        .not_.is_("url", "null")
        .order("start_time")
        .limit(limit)
        .execute()
        .data
        or []
    )


async def find_images(db, limit: int = 600, delay: float = 0.8) -> Dict[str, Any]:
    rows = pick_batch(db, limit)
    stats: Dict[str, Any] = {"picked": len(rows), "found": 0, "none": 0, "failed": 0, "generic": 0, "by_host": {}}
    if not rows:
        return stats

    by_host: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        try:
            host = httpx.URL(r["url"]).host
        except Exception:  # noqa: BLE001 - a malformed URL is skipped, not fatal
            continue
        by_host.setdefault(host, []).append(r)

    found: Dict[str, Optional[str]] = {}
    loaded: set[str] = set()

    async with httpx.AsyncClient(
        headers={"User-Agent": UA, "Accept-Language": "en;q=0.9"}, follow_redirects=True, timeout=20
    ) as http:

        async def run_host(host: str, items: List[Dict[str, Any]]) -> None:
            refusals = 0
            tally = stats["by_host"].setdefault(host.replace("www.", ""), Counter())
            for r in items[:PER_HOST]:
                if refusals >= REFUSALS:
                    tally["skipped"] += 1
                    continue
                try:
                    resp = await http.get(r["url"])
                except httpx.HTTPError:
                    tally["error"] += 1
                    await asyncio.sleep(delay)
                    continue
                if resp.status_code in (401, 403, 429) or resp.status_code >= 500:
                    refusals += 1
                    tally[f"HTTP {resp.status_code}"] += 1
                elif resp.status_code == 200 and "html" in resp.headers.get("content-type", ""):
                    refusals = 0
                    loaded.add(r["id"])
                    found[r["id"]] = image_from_html(resp.text, str(resp.url))
                    tally["ok"] += 1
                else:
                    tally[f"HTTP {resp.status_code}"] += 1
                await asyncio.sleep(delay + random.random() * 0.4)

        await asyncio.gather(*(run_host(h, v) for h, v in by_host.items()))

    generic = generic_images(found)
    for r in rows:
        if r["id"] not in loaded:
            stats["failed"] += 1
            continue  # stays NULL: tried again next run
        img = found.get(r["id"])
        if img and img in generic:
            stats["generic"] += 1
            img = None
        # An empty string means "looked, the page has no picture of its own".
        db.table("events").update({"image_url": img or ""}).eq("id", r["id"]).execute()
        stats["found" if img else "none"] += 1
    stats["by_host"] = {h: dict(c) for h, c in stats["by_host"].items()}
    return stats
