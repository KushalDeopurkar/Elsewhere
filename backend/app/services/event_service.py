from __future__ import annotations
from typing import Optional, List, Dict

import html
import logging
from datetime import datetime, timedelta, timezone

from supabase import Client

from app.models.event import EventCreate, EventSearchParams

logger = logging.getLogger(__name__)


_TEXT_FIELDS = ("title", "description", "location_name", "address")


def _unescape_row(row: Dict) -> Dict:
    """Scraped pages sometimes double-encode ("Finance &amp; Tech"). Decode
    HTML entities in text fields before storing; repeat once for &amp;amp;."""
    for k in _TEXT_FIELDS:
        v = row.get(k)
        if isinstance(v, str) and "&" in v:
            row[k] = html.unescape(html.unescape(v))
    return row


class EventService:
    def __init__(self, client: Client):
        self.client = client

    def upsert_events(self, events: List[EventCreate]) -> int:
        """Insert or update events. Returns count of upserted rows."""
        if not events:
            return 0

        rows = [_unescape_row(e.to_db_row()) for e in events]

        result = (
            self.client.table("events")
            .upsert(rows, on_conflict="source,source_id")
            .execute()
        )

        count = len(result.data) if result.data else 0
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

        result = self.client.rpc("search_events", rpc_params).execute()
        # Cards need the tier count and range, not the long details.
        return self._with_details(result.data or [], "tickets")

    def get_by_id(self, event_id: str) -> Optional[Dict]:
        """Get single event by UUID via RPC (extracts lat/lng from coords)."""
        result = self.client.rpc(
            "get_event_by_id", {"p_id": event_id}
        ).execute()
        rows = self._with_details(result.data or [], "tickets,details")
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

    _DETAIL_COLUMNS = "id,image_url,end_time,price_min,price_max,is_free,url,address,city,source"

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
