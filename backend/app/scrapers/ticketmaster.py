"""
Ticketmaster Discovery API v2: concerts, sports, theatre and family events
across North America, the UK and Ireland, Europe, Australia and NZ.

Free key from developer.ticketmaster.com (TICKETMASTER_API_KEY). Default
quota is 5,000 calls a day at 5 a second; a full run here is roughly
cities x pages (36 x up to 5) calls, so four runs a day fit comfortably.
Ticketmaster asks apps to link back to its event page, which `url` does.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.models.event import EventCategory, EventCreate
from app.scrapers.base import BaseScraper
from app.scrapers.world import WorldCity, cities_for, geohash, get_json, new_client, parse_iso, to_float, to_utc

logger = logging.getLogger(__name__)

API = "https://app.ticketmaster.com/discovery/v2/events.json"
PAGE_SIZE = 200
MAX_PAGES = 5  # the API serves only the first 1,000 results of a query

SEGMENTS: Dict[str, EventCategory] = {
    "music": EventCategory.MUSIC,
    "sports": EventCategory.SPORTS,
    "arts & theatre": EventCategory.ARTS,
    "film": EventCategory.ARTS,
    "family": EventCategory.FAMILY,
}
GENRES: Dict[str, EventCategory] = {
    "comedy": EventCategory.ARTS,
    "dance/electronic": EventCategory.NIGHTLIFE,
    "children's theatre": EventCategory.FAMILY,
    "fairs & festivals": EventCategory.COMMUNITY,
    "food & drink": EventCategory.FOOD,
    "lecture/seminar": EventCategory.EDUCATION,
    "fitness": EventCategory.HEALTH,
}


def _category(ev: Dict[str, Any]) -> EventCategory:
    for c in ev.get("classifications") or []:
        genre = ((c.get("genre") or {}).get("name") or "").lower()
        if genre in GENRES:
            return GENRES[genre]
        seg = ((c.get("segment") or {}).get("name") or "").lower()
        if seg in SEGMENTS:
            return SEGMENTS[seg]
    return EventCategory.OTHER


def _image(ev: Dict[str, Any]) -> Optional[str]:
    imgs = [i for i in ev.get("images") or [] if i.get("url")]
    if not imgs:
        return None
    # Prefer a wide image around 1024 px rather than the largest original.
    wide = [i for i in imgs if i.get("ratio") == "16_9"] or imgs
    wide.sort(key=lambda i: abs((i.get("width") or 0) - 1024))
    return wide[0]["url"]


def normalize(ev: Dict[str, Any], city: WorldCity) -> Optional[EventCreate]:
    dates = ev.get("dates") or {}
    status = ((dates.get("status") or {}).get("code") or "").lower()
    if status in ("cancelled", "canceled", "postponed"):
        return None
    start = dates.get("start") or {}
    tz = dates.get("timezone") or city.tz
    when = parse_iso(start.get("dateTime"))
    if when is None and start.get("localDate"):
        # Date only (time to be announced): local midnight, which the site
        # shows as "time on listing".
        try:
            when = to_utc(datetime.fromisoformat(start["localDate"]), tz)
        except ValueError:
            when = None
    if when is None or not ev.get("name"):
        return None
    end = parse_iso(((dates.get("end") or {}).get("dateTime")))

    venue = ((ev.get("_embedded") or {}).get("venues") or [{}])[0] or {}
    loc = venue.get("location") or {}
    lat, lng = to_float(loc.get("latitude")), to_float(loc.get("longitude"))
    addr = ", ".join(
        x for x in [((venue.get("address") or {}).get("line1")), ((venue.get("city") or {}).get("name"))] if x
    ) or None

    prices = ev.get("priceRanges") or []
    lo = min((p["min"] for p in prices if isinstance(p.get("min"), (int, float))), default=None)
    hi = max((p["max"] for p in prices if isinstance(p.get("max"), (int, float))), default=None)

    about = " ".join(x for x in [ev.get("info"), ev.get("pleaseNote")] if x) or None
    return EventCreate(
        title=ev["name"].strip(),
        description=about[:4000] if about else None,
        category=_category(ev),
        start_time=when,
        end_time=end if end and end > when else None,
        location_name=venue.get("name"),
        address=addr,
        city=city.name,
        country=((venue.get("country") or {}).get("countryCode")) or city.country,
        lat=lat if lat is not None else city.lat,
        lng=lng if lng is not None else city.lng,
        image_url=_image(ev),
        url=ev.get("url"),
        price_min=lo,
        price_max=hi if hi is not None and lo is not None and hi > lo else None,
        is_free=lo == 0 and (hi or 0) == 0 if lo is not None else False,
        source="ticketmaster",
        source_id=str(ev.get("id")),
        raw_data={"timezone": tz, "currency": (prices[0].get("currency") if prices else None)},
    )


class TicketmasterScraper(BaseScraper):
    name = "ticketmaster"

    def __init__(self, api_key: Optional[str] = None, days: int = 60, radius_km: int = 40):
        self.api_key = api_key or os.environ.get("TICKETMASTER_API_KEY", "")
        self.days = days
        self.radius_km = radius_km

    async def scrape(self, city: Optional[str] = None, **kwargs) -> List[EventCreate]:
        if not self.api_key:
            self._log("TICKETMASTER_API_KEY not set; skipping")
            return []
        now = datetime.now(timezone.utc).replace(microsecond=0)
        window = {
            "startDateTime": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "endDateTime": (now + timedelta(days=self.days)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        out: Dict[str, EventCreate] = {}
        async with new_client() as client:
            for c in cities_for("ticketmaster", city):
                got = 0
                for page in range(MAX_PAGES):
                    data = await get_json(
                        client,
                        API,
                        {
                            "apikey": self.api_key,
                            "geoPoint": geohash(c.lat, c.lng, 7),
                            "radius": self.radius_km,
                            "unit": "km",
                            "size": PAGE_SIZE,
                            "page": page,
                            "sort": "date,asc",
                            **window,
                        },
                        pause=0.22,  # stays under 5 requests a second
                    )
                    if not data:
                        break
                    events = (data.get("_embedded") or {}).get("events") or []
                    for ev in events:
                        e = normalize(ev, c)
                        if e:
                            out.setdefault(e.source_id, e)
                            got += 1
                    total_pages = (data.get("page") or {}).get("totalPages") or 0
                    if page + 1 >= total_pages or len(events) < PAGE_SIZE:
                        break
                self._log(f"{c.name}: {got} events")
        return list(out.values())
