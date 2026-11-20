from __future__ import annotations
from typing import Optional, List, Dict

import html
import logging
import time
from datetime import datetime, timedelta, timezone

from postgrest import APIError
from postgrest.types import ReturnMethod
from supabase import Client

from app.models.event import EventCategory, EventCreate, EventSearchParams
from app.scrapers.classify import is_junk_title

logger = logging.getLogger(__name__)

# Rows per write. Small enough to stay well inside the statement timeout;
# a chunk that still times out is split in half until it fits (MIN_BATCH).
UPSERT_BATCH = 200
MIN_BATCH = 10


_TEXT_FIELDS = ("title", "description", "location_name", "address")


def _unescape_row(row: Dict) -> Dict:
    """Scraped pages sometimes double-encode ("Finance &amp; Tech"). Decode
    HTML entities in text fields before storing; repeat once for &amp;amp;."""
    for k in _TEXT_FIELDS:
        v = row.get(k)
        if isinstance(v, str) and "&" in v:
            row[k] = html.unescape(html.unescape(v))
    return row


def split_by_image(rows: List[Dict]) -> List[List[Dict]]:
    """Rows with a picture as they are; rows without one minus the image_url
    key (a bulk upsert needs the same keys in every row of a request)."""
    with_img = [r for r in rows if r.get("image_url")]
    without = [{k: v for k, v in r.items() if k != "image_url"} for r in rows if not r.get("image_url")]
    return [b for b in (with_img, without) if b]


class EventService:
    def __init__(self, client: Client):
        self.client = client

    def _upsert_chunk(self, rows: List[dict]) -> int:
        """Write one chunk; on a database timeout, split it and try the halves.

        Each row fires the table's triggers (search text, geography), so a big
        chunk can pass Postgres's statement timeout. Halving until it fits
        keeps a run from failing outright; rows that still can't be written
        on their own are logged and skipped, never the whole run.
        """
        try:
            self.client.table("events").upsert(
                rows, on_conflict="source,source_id", returning=ReturnMethod.minimal
            ).execute()
            return len(rows)
        except APIError as e:
            if getattr(e, "code", None) != "57014" and "timeout" not in str(e).lower():
                raise
            if len(rows) <= MIN_BATCH:
                logger.error(f"Gave up on {len(rows)} rows after timeouts (first: {rows[0].get('source')}/{rows[0].get('source_id')})")
                return 0
            mid = len(rows) // 2
            logger.warning(f"Timeout writing {len(rows)} rows; retrying as {mid} + {len(rows) - mid}")
            time.sleep(1)
            return self._upsert_chunk(rows[:mid]) + self._upsert_chunk(rows[mid:])

    def upsert_events(self, events: List[EventCreate]) -> int:
        """Insert or update events. Returns count of upserted rows."""
        events = [e for e in events if not is_junk_title(e.title)]
        if not events:
            return 0

        # One row per (source, source_id), or Postgres rejects the batch.
        rows = list({(r["source"], r["source_id"]): r for r in (_unescape_row(e.to_db_row()) for e in events)}.values())

        # Global sources bring thousands of rows a run: send them in chunks
        # so no single request is too large. Rows whose source sent no
        # picture are sent without the column, so a picture found later on
        # the event's own page (app/enrich/images.py) is kept.
        count = 0
        for batch in split_by_image(rows):
            for i in range(0, len(batch), UPSERT_BATCH):
                count += self._upsert_chunk(batch[i : i + UPSERT_BATCH])
        logger.info(f"Upserted {count} events")
        return count

    def search(self, params: EventSearchParams) -> List[Dict]:
        """Full-text + geo search via the search_events RPC.

        NOTE: the search_events RPC's geo input parameters are named
        p_lat/p_lng (not lat/lng) to avoid a naming collision with the
        `events.lat`/`events.lng` columns inside the PL/pgSQL function
        body. The rpc_params dict below MUST use "p_lat"/"p_lng".
        """
        rpc_params = {
            "query": params.q,
            "category_filter": params.category.value if params.category else None,
            "p_lat": params.lat,
            "p_lng": params.lng,
            "radius_km": params.radius_km,
            "from_time": params.from_time.isoformat() if params.from_time else None,
            "to_time": params.to_time.isoformat() if params.to_time else None,
            "page_limit": params.limit,
            "page_offset": params.offset,
        }

        result = self._rpc_retry("search_events", rpc_params)
        # Cards need the tier count and range, not the long details.
        return self._with_details(result.data or [], "tickets")

    def _rpc_retry(self, fn: str, params: Dict):
        """Call an RPC, once more after a short pause if the first call fails.

        A cold start's first database call is the one that times out or
        drops; the second almost always succeeds. Retrying here turns that
        into a slower answer instead of a 500.
        """
        import time

        try:
            return self.client.rpc(fn, params).execute()
        except Exception as first:  # noqa: BLE001 - retried once, then raised
            logger.warning("rpc %s failed once (%s); retrying", fn, first)
            time.sleep(0.8)
            return self.client.rpc(fn, params).execute()

    def get_by_id(self, event_id: str) -> Optional[Dict]:
        """Get single event by UUID via RPC (extracts lat/lng from coords)."""
        result = self._rpc_retry("get_event_by_id", {"p_id": event_id})
        rows = self._with_details(result.data or [], "tickets,details,details_fetched_at")
        return rows[0] if rows else None

    def get_in_bounds(
        self,
        south: float,
        west: float,
        north: float,
        east: float,
        from_time: Optional[datetime] = None,
        category: Optional[str] = None,
        max_results: int = 200,
    ) -> List[Dict]:
        """Get events within a map bounding box via events_in_bounds RPC.

        The RPC returns a slim row (no image, price or end time). Rather than
        change the SQL function, the extra columns are fetched in one query by
        id and merged in, so map pins can show thumbnails and the peek card
        can show prices. Events that started up to 6 hours ago are included,
        so the map's timeline can show what is on right now.
        """
        since = from_time or (datetime.now(timezone.utc) - timedelta(hours=6))
        result = self.client.rpc(
            "events_in_bounds",
            {
                "south": south,
                "west": west,
                "north": north,
                "east": east,
                "from_time": since.isoformat(),
                "category_filter": category,
                "max_results": max_results,
            },
        ).execute()
        rows = result.data or []
        return self._with_details(rows)

    _DETAIL_COLUMNS = "id,image_url,end_time,price_min,price_max,is_free,url,address,city,country,source"

    def counts_near(self, lat: float, lng: float, radius_km: float = 40.0, max_rows: int = 5000) -> Dict:
        """Upcoming events per category within radius_km, in one query.

        Uses the events_in_bounds RPC (category and coordinates, nothing
        else) for the box around the circle, then keeps what is inside the
        circle. Returns every category, zero included, never null, plus the
        total and one picture per category for its tile.
        """
        import math

        dlat = radius_km / 111.0
        dlng = radius_km / (111.0 * max(0.1, math.cos(math.radians(lat))))
        rows = (
            self.client.rpc(
                "events_in_bounds",
                {
                    "south": lat - dlat,
                    "west": lng - dlng,
                    "north": lat + dlat,
                    "east": lng + dlng,
                    "from_time": datetime.now(timezone.utc).isoformat(),
                    "category_filter": None,
                    "max_results": max_rows,
                },
            ).execute().data
            or []
        )

        def km(a_lat: float, a_lng: float) -> float:
            p1, p2 = math.radians(lat), math.radians(a_lat)
            dp, dl = p2 - p1, math.radians(a_lng - lng)
            h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
            return 6371.0 * 2 * math.asin(math.sqrt(h))

        counts: Dict[str, int] = {c.value: 0 for c in EventCategory}
        first_ids: Dict[str, List[str]] = {}
        for r in rows:
            if r.get("lat") is None or r.get("lng") is None or km(r["lat"], r["lng"]) > radius_km:
                continue
            cat = r.get("category") or "other"
            counts[cat] = counts.get(cat, 0) + 1
            ids = first_ids.setdefault(cat, [])
            if len(ids) < 8:
                ids.append(r["id"])

        images: Dict[str, Optional[str]] = {c: None for c in counts}
        want = [i for ids in first_ids.values() for i in ids]
        if want:
            res = self.client.table("events").select("id,category,image_url").in_("id", want).execute()
            order = {i: n for n, i in enumerate(want)}
            for e in sorted(res.data or [], key=lambda e: order.get(e["id"], 0)):
                if e.get("image_url") and not images.get(e["category"]):
                    images[e["category"]] = e["image_url"]
        return {
            "total": sum(counts.values()),
            "capped": len(rows) >= max_rows,
            "categories": [{"value": c, "count": n, "image": images.get(c)} for c, n in counts.items()],
        }

    def _with_details(self, rows: List[Dict], extra: str = "") -> List[Dict]:
        """Merge columns the RPCs don't return, by id, in one query.

        `extra` asks for the enrich-pass columns (tickets, details). If the
        database hasn't had migration 008 yet those don't exist, so the
        query is retried without them rather than losing everything.
        """
        ids = [r["id"] for r in rows if r.get("id")]
        if not ids:
            return rows
        by_id: Dict[str, Dict] = {}
        for cols in ([f"{self._DETAIL_COLUMNS},{extra}"] if extra else []) + [self._DETAIL_COLUMNS]:
            try:
                res = self.client.table("events").select(cols).in_("id", ids).execute()
                by_id = {e["id"]: e for e in (res.data or []) if isinstance(e, dict) and e.get("id")}
                break
            except Exception:  # noqa: BLE001 - fall back to fewer columns, then to slim rows
                continue
        if not by_id:
            return rows
        return [{**r, **{k: v for k, v in by_id.get(r["id"], {}).items() if v is not None}} for r in rows]
