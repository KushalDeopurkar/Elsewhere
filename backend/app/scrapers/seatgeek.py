"""
SeatGeek Platform API: concerts, sports and theatre in the US and Canada,
including smaller venues and minor-league games Ticketmaster misses.

Free client id from seatgeek.com/account/develop (SEATGEEK_CLIENT_ID).
Events link back to SeatGeek's event page.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.models.event import EventCategory, EventCreate
from app.scrapers.base import BaseScraper
from app.scrapers.world import WorldCity, cities_for, get_json, new_client, parse_iso, to_float, to_utc

logger = logging.getLogger(__name__)

API = "https://api.seatgeek.com/2/events"
PER_PAGE = 100
MAX_PAGES = 5

SPORTS = {
    "sports", "nba", "nfl", "mlb", "nhl", "mls", "ncaa_football", "ncaa_basketball", "minor_league_baseball",
    "baseball", "basketball", "football", "hockey", "soccer", "wnba", "tennis", "golf", "boxing", "mma",
    "wrestling", "racing", "auto_racing", "horse_racing", "rodeo", "monster_truck",
}


def _category(ev: Dict[str, Any]) -> EventCategory:
    kinds = {str(ev.get("type") or "").lower()} | {
        str(t.get("name") or "").lower() for t in ev.get("taxonomies") or []
    }
    if kinds & {"concert", "concerts", "music_festival"}:
        return EventCategory.MUSIC
    if kinds & SPORTS:
        return EventCategory.SPORTS
    if kinds & {"comedy", "theater", "broadway_tickets_national", "classical", "dance_performance_tour", "cirque_du_soleil", "film"}:
        return EventCategory.ARTS
    if kinds & {"family"}:
        return EventCategory.FAMILY
    if any("sport" in k or k.startswith("ncaa") for k in kinds):
        return EventCategory.SPORTS
    return EventCategory.OTHER


def _image(ev: Dict[str, Any]) -> Optional[str]:
    for p in ev.get("performers") or []:
        imgs = p.get("images") or {}
        url = imgs.get("huge") or p.get("image")
        if url:
            return url
    return None


def normalize(ev: Dict[str, Any], city: WorldCity) -> Optional[EventCreate]:
    venue = ev.get("venue") or {}
    tz = venue.get("timezone") or city.tz
    if ev.get("datetime_tbd") or ev.get("date_tbd"):
        return None
    if ev.get("time_tbd") and ev.get("datetime_local"):
        try:
            day = datetime.fromisoformat(ev["datetime_local"][:10])
            when = to_utc(day, tz)
        except ValueError:
            return None
    else:
        when = parse_iso(ev.get("datetime_utc"))
    title = (ev.get("title") or ev.get("short_title") or "").strip()
    if when is None or not title:
        return None
    loc = venue.get("location") or {}
    lat, lng = to_float(loc.get("lat")), to_float(loc.get("lon"))
    stats = ev.get("stats") or {}
    lo = to_float(stats.get("lowest_price"))
    hi = to_float(stats.get("highest_price"))
    addr = ", ".join(x for x in [venue.get("address"), venue.get("extended_address")] if x) or None
    return EventCreate(
        title=title,
        description=None,
        category=_category(ev),
        start_time=when,
        location_name=venue.get("name"),
        address=addr,
        city=city.name,
        country=(venue.get("country") or city.country)[:2].upper(),
        lat=lat if lat is not None else city.lat,
        lng=lng if lng is not None else city.lng,
        image_url=_image(ev),
        url=ev.get("url"),
        price_min=lo,
        price_max=hi if hi is not None and lo is not None and hi > lo else None,
        is_free=False,
        source="seatgeek",
        source_id=str(ev.get("id")),
        raw_data={"timezone": tz, "currency": "USD" if city.country == "US" else "CAD"},
    )


class SeatGeekScraper(BaseScraper):
    name = "seatgeek"

    def __init__(self, client_id: Optional[str] = None, radius_mi: int = 25):
        self.client_id = client_id or os.environ.get("SEATGEEK_CLIENT_ID", "")
        self.radius_mi = radius_mi

    async def scrape(self, city: Optional[str] = None, **kwargs) -> List[EventCreate]:
        if not self.client_id:
            self._log("SEATGEEK_CLIENT_ID not set; skipping")
            return []
        since = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        out: Dict[str, EventCreate] = {}
        async with new_client() as client:
            for c in cities_for("seatgeek", city):
                got = 0
                for page in range(1, MAX_PAGES + 1):
                    data = await get_json(
                        client,
                        API,
                        {
                            "client_id": self.client_id,
                            "lat": c.lat,
                            "lon": c.lng,
                            "range": f"{self.radius_mi}mi",
                            "per_page": PER_PAGE,
                            "page": page,
                            "sort": "datetime_utc.asc",
                            "datetime_utc.gte": since,
                        },
                    )
                    if not data:
                        break
                    events = data.get("events") or []
                    for ev in events:
                        e = normalize(ev, c)
                        if e:
                            out.setdefault(e.source_id, e)
                            got += 1
                    if len(events) < PER_PAGE:
                        break
                self._log(f"{c.name}: {got} events")
        return list(out.values())
