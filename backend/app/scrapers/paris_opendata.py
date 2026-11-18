"""
"Que faire à Paris" — the City of Paris's open events agenda (concerts,
exhibitions, workshops, walks, kids' activities, many of them free).

Open data under the ODbL: no key needed, but we must credit the source
("Que faire à Paris, Ville de Paris, ODbL") wherever these events show,
and keep the rows identifiable (source = "paris-opendata") so the derived
data can be shared under the same licence if ever redistributed.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.models.event import EventCategory, EventCreate
from app.scrapers.base import BaseScraper
from app.scrapers.world import cities_for, get_json, new_client, parse_iso, strip_html, to_float

logger = logging.getLogger(__name__)

API = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records"
PAGE = 100
MAX_ROWS = 3000
ATTRIBUTION = "Que faire à Paris, Ville de Paris (ODbL)"

TAGS: List[Tuple[str, EventCategory]] = [
    ("concert", EventCategory.MUSIC), ("musique", EventCategory.MUSIC),
    ("clubbing", EventCategory.NIGHTLIFE), ("soirée", EventCategory.NIGHTLIFE),
    ("enfant", EventCategory.FAMILY), ("famille", EventCategory.FAMILY),
    ("sport", EventCategory.SPORTS),
    ("atelier", EventCategory.EDUCATION), ("conférence", EventCategory.EDUCATION), ("cours", EventCategory.EDUCATION),
    ("balade", EventCategory.OUTDOOR), ("nature", EventCategory.OUTDOOR), ("jardin", EventCategory.OUTDOOR),
    ("gourmand", EventCategory.FOOD), ("gastronomie", EventCategory.FOOD), ("marché", EventCategory.FOOD),
    ("expo", EventCategory.ARTS), ("théâtre", EventCategory.ARTS), ("cinéma", EventCategory.ARTS),
    ("danse", EventCategory.ARTS), ("humour", EventCategory.ARTS), ("art", EventCategory.ARTS),
    ("littérature", EventCategory.ARTS), ("spectacle", EventCategory.ARTS),
    ("solidarité", EventCategory.COMMUNITY), ("citoyen", EventCategory.COMMUNITY), ("fête", EventCategory.COMMUNITY),
    ("bien-être", EventCategory.HEALTH), ("santé", EventCategory.HEALTH),
]


def _category(rec: Dict[str, Any]) -> EventCategory:
    tags = rec.get("qfap_tags") or ""
    if isinstance(tags, list):
        tags = ";".join(str(t) for t in tags)
    text = f"{tags} {rec.get('category') or ''}".lower()
    for word, c in TAGS:
        if word in text:
            return c
    return EventCategory.OTHER


def next_slot(rec: Dict[str, Any], now: datetime) -> Optional[Tuple[datetime, Optional[datetime]]]:
    """The next upcoming occurrence. Many records run for weeks with daily
    slots ("start_end;start_end;..."); a long exhibition with no slots keeps
    its own span, so it still shows while it's on."""
    occ = rec.get("occurrences") or ""
    best: Optional[Tuple[datetime, Optional[datetime]]] = None
    for part in str(occ).split(";"):
        a, _, b = part.partition("_")
        s, e = parse_iso(a), parse_iso(b)
        if s is None:
            continue
        if (e or s) >= now and (best is None or s < best[0]):
            best = (s, e)
    if best:
        return best
    s, e = parse_iso(rec.get("date_start")), parse_iso(rec.get("date_end"))
    if s is None or (e or s) < now:
        return None
    return s, e


def normalize(rec: Dict[str, Any], now: Optional[datetime] = None) -> Optional[EventCreate]:
    now = now or datetime.now(timezone.utc)
    title = (rec.get("title") or "").strip()
    slot = next_slot(rec, now)
    if not title or not slot:
        return None
    start, end = slot
    ll = rec.get("lat_lon") or {}
    lat, lng = to_float(ll.get("lat")), to_float(ll.get("lon"))
    price = str(rec.get("price_type") or "").lower()
    addr = ", ".join(
        x for x in [rec.get("address_street"), rec.get("address_zipcode"), rec.get("address_city")] if x
    ) or None
    about = strip_html(rec.get("lead_text")) or strip_html(rec.get("description"))
    paris = cities_for("paris")[0]
    return EventCreate(
        title=title,
        description=about,
        category=_category(rec),
        start_time=start,
        end_time=end if end and end > start else None,
        location_name=rec.get("address_name"),
        address=addr,
        city="Paris",
        country="FR",
        lat=lat if lat is not None else paris.lat,
        lng=lng if lng is not None else paris.lng,
        image_url=rec.get("cover_url"),
        url=rec.get("url"),
        is_free=price.startswith("gratuit"),
        source="paris-opendata",
        source_id=str(rec.get("id") or rec.get("event_id") or rec.get("url")),
        raw_data={"timezone": "Europe/Paris", "currency": "EUR", "attribution": ATTRIBUTION, "license": "ODbL-1.0"},
    )


class ParisOpenDataScraper(BaseScraper):
    name = "paris"

    async def scrape(self, city: Optional[str] = None, **kwargs) -> List[EventCreate]:
        if city and city.strip().lower() != "paris":
            return []
        now = datetime.now(timezone.utc)
        out: Dict[str, EventCreate] = {}
        async with new_client() as client:
            for offset in range(0, MAX_ROWS, PAGE):
                data = await get_json(
                    client,
                    API,
                    {
                        "where": "date_end >= now()",
                        "order_by": "date_start",
                        "limit": PAGE,
                        "offset": offset,
                    },
                    pause=0.3,
                )
                rows = (data or {}).get("results") or []
                for rec in rows:
                    e = normalize(rec, now)
                    if e:
                        out.setdefault(e.source_id, e)
                if len(rows) < PAGE:
                    break
        self._log(f"Paris: {len(out)} events")
        return list(out.values())
