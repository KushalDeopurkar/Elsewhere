from __future__ import annotations
from typing import Optional, List, Dict

import logging
from datetime import datetime, timezone

from supabase import Client

from app.models.event import EventCreate, EventSearchParams

logger = logging.getLogger(__name__)


class EventService:
    def __init__(self, client: Client):
        self.client = client

    def upsert_events(self, events: List[EventCreate]) -> int:
        """Insert or update events. Returns count of upserted rows."""
        if not events:
            return 0

        rows = [e.to_db_row() for e in events]

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
            "free_only": params.free_only,
            "online_only": params.online_only,
            "sort_by": params.sort_by.value,
            "page_limit": params.limit,
            "page_offset": params.offset,
        }

        result = self.client.rpc("search_events", rpc_params).execute()
        return result.data or []

    def get_by_id(self, event_id: str) -> Optional[Dict]:
        """Get single event by UUID via RPC (extracts lat/lng from coords)."""
        result = self.client.rpc(
            "get_event_by_id", {"p_id": event_id}
        ).execute()
        rows = result.data or []
        return rows[0] if rows else None

    def get_in_bounds(
        self,
        south: float,
        west: float,
        north: float,
        east: float,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        category: Optional[str] = None,
        q: Optional[str] = None,
        max_results: int = 200,
    ) -> List[Dict]:
        """Get events within a map bounding box via events_in_bounds RPC."""
        result = self.client.rpc(
            "events_in_bounds",
            {
                "south": south,
                "west": west,
                "north": north,
                "east": east,
                "from_time": (from_time or datetime.now(timezone.utc)).isoformat(),
                "to_time": to_time.isoformat() if to_time else None,
                "category_filter": category,
                "query": q,
                "max_results": max_results,
            },
        ).execute()
        return result.data or []
