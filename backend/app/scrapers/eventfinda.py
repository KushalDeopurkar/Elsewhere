"""
Eventfinda API v2: arts, community, festival and family events in New
Zealand, Australia and Singapore. Commercial use is allowed.

Sign up at eventfinda.co.nz/api/v2/index for a username and password
(EVENTFINDA_USERNAME / EVENTFINDA_PASSWORD; HTTP Basic). Standard access
trims descriptions to about 220 characters; full access (on request) adds
the rest. Events link back to their Eventfinda page.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.models.event import EventCategory, EventCreate
from app.scrapers.base import BaseScraper
from app.scrapers.world import WorldCity, cities_for, get_json, new_client, strip_html, to_float, to_utc

logger = logging.getLogger(__name__)

HOSTS = {"NZ": "api.eventfinda.co.nz", "AU": "api.eventfinda.com.au", "SG": "api.eventfinda.sg"}
CURRENCY = {"NZ": "NZD", "AU": "AUD", "SG": "SGD"}
ROWS = 20  # the API's page size limit
MAX_PAGES = 10

CATEGORY_WORDS = [
    ("concert", EventCategory.MUSIC), ("gig", EventCategory.MUSIC), ("music", EventCategory.MUSIC),
    ("festival", EventCategory.COMMUNITY), ("market", EventCategory.COMMUNITY), ("community", EventCategory.COMMUNITY),
    ("sport", EventCategory.SPORTS), ("fitness", EventCategory.HEALTH), ("wellbeing", EventCategory.HEALTH),
    ("kids", EventCategory.FAMILY), ("family", EventCategory.FAMILY),
    ("food", EventCategory.FOOD), ("wine", EventCategory.FOOD), ("drink", EventCategory.FOOD),
    ("workshop", EventCategory.EDUCATION), ("class", EventCategory.EDUCATION), ("talk", EventCategory.EDUCATION),
    ("lecture", EventCategory.EDUCATION), ("business", EventCategory.BUSINESS), ("networking", EventCategory.BUSINESS),
    ("tech", EventCategory.TECH), ("comedy", EventCategory.ARTS), ("theatre", EventCategory.ARTS),
    ("exhibition", EventCategory.ARTS), ("art", EventCategory.ARTS), ("film", EventCategory.ARTS),
    ("dance", EventCategory.ARTS), ("club", EventCategory.NIGHTLIFE), ("nightlife", EventCategory.NIGHTLIFE),
    ("outdoor", EventCategory.OUTDOOR), ("walk", EventCategory.OUTDOOR), ("tour", EventCategory.OUTDOOR),
]


def _category(ev: Dict[str, Any]) -> EventCategory:
    cat = ev.get("category") or {}
    text = f"{cat.get('name') or ''} {cat.get('url_slug') or ''}".lower()
    for word, c in CATEGORY_WORDS:
        if word in text:
            return c
    return EventCategory.OTHER


def _image(ev: Dict[str, Any]) -> Optional[str]:
    imgs = ((ev.get("images") or {}).get("images")) or []
    best, best_w = None, -1
    for img in imgs:
        for t in ((img.get("transforms") or {}).get("transforms")) or []:
            w = int(t.get("width") or 0)
            if t.get("url") and w > best_w and w <= 1600:
                best, best_w = t["url"], w
    return best


def _local(s: Optional[str], tz: str):
    if not s:
        return None
    try:
        return to_utc(datetime.fromisoformat(s.strip().replace(" ", "T", 1)), tz)
    except ValueError:
        return None


def normalize(ev: Dict[str, Any], city: WorldCity) -> Optional[EventCreate]:
    start = _local(ev.get("datetime_start"), city.tz)
    title = (ev.get("name") or "").strip()
    if start is None or not title:
        return None
    end = _local(ev.get("datetime_end"), city.tz)
    point = ev.get("point") or {}
    lat, lng = to_float(point.get("lat")), to_float(point.get("lng"))
    loc = ev.get("location") or {}
    prices = [
        p for p in (to_float(t.get("price")) for t in ((ev.get("ticket_types") or {}).get("ticket_types")) or [])
        if p is not None
    ]
    free = bool(ev.get("is_free")) or (bool(prices) and max(prices) == 0)
    paid = [p for p in prices if p > 0]
    return EventCreate(
        title=title,
        description=strip_html(ev.get("description")),
        category=_category(ev),
        start_time=start,
        end_time=end if end and end > start else None,
        location_name=loc.get("name") or ev.get("location_summary"),
        address=ev.get("address") or loc.get("summary") or ev.get("location_summary"),
        city=city.name,
        country=city.country,
        lat=lat if lat is not None else city.lat,
        lng=lng if lng is not None else city.lng,
        image_url=_image(ev),
        url=ev.get("url"),
        price_min=min(paid) if paid and not free else None,
        price_max=max(paid) if len(paid) > 1 and not free else None,
        is_free=free,
        source="eventfinda",
        source_id=f"{city.country.lower()}-{ev.get('id')}",
        raw_data={"timezone": city.tz, "currency": CURRENCY.get(city.country)},
    )


class EventfindaScraper(BaseScraper):
    name = "eventfinda"

    def __init__(self, username: Optional[str] = None, password: Optional[str] = None, radius_km: int = 30):
        self.username = username or os.environ.get("EVENTFINDA_USERNAME", "")
        self.password = password or os.environ.get("EVENTFINDA_PASSWORD", "")
        self.radius_km = radius_km

    async def scrape(self, city: Optional[str] = None, **kwargs) -> List[EventCreate]:
        if not (self.username and self.password):
            self._log("EVENTFINDA_USERNAME / EVENTFINDA_PASSWORD not set; skipping")
            return []
        out: Dict[str, EventCreate] = {}
        async with new_client(auth=(self.username, self.password)) as client:
            for c in cities_for("eventfinda", city):
                host = HOSTS.get(c.country)
                if not host:
                    continue
                got = 0
                for page in range(MAX_PAGES):
                    data = await get_json(
                        client,
                        f"https://{host}/v2/events.json",
                        {
                            "point": f"{c.lat},{c.lng}",
                            "radius": self.radius_km,
                            "rows": ROWS,
                            "offset": page * ROWS,
                            "order": "date",
                        },
                        pause=0.5,
                    )
                    if not data:
                        break
                    events = data.get("events") or []
                    for ev in events:
                        e = normalize(ev, c)
                        if e:
                            out.setdefault(e.source_id, e)
                            got += 1
                    if len(events) < ROWS:
                        break
                self._log(f"{c.name}: {got} events")
        return list(out.values())
