"""
Public iCal (.ics) calendars: venues, universities, libraries, councils,
and Meetup or Luma groups that publish a feed. A publisher offering a feed
is inviting syndication, so this is the cleanest way to pick up tech and
community events the big platforms keep behind their own walls.

Feeds are listed in backend/feeds.json:

    [
      {"url": "https://example.org/events.ics", "name": "Example Hall",
       "city": "London", "country": "GB", "lat": 51.5, "lng": -0.12,
       "tz": "Europe/London", "category": "community"}
    ]

`lat`/`lng` place events that carry no GEO of their own; `category` is a
fallback when the feed's own CATEGORIES don't say.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.models.event import EventCategory, EventCreate
from app.scrapers.base import BaseScraper
from app.scrapers.world import new_client, strip_html, to_utc

logger = logging.getLogger(__name__)

FEEDS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "feeds.json")
HORIZON_DAYS = 90

WORDS = [
    ("hackathon", EventCategory.TECH), ("meetup", EventCategory.TECH), ("developer", EventCategory.TECH),
    ("ai ", EventCategory.TECH), ("startup", EventCategory.BUSINESS), ("founder", EventCategory.BUSINESS),
    ("networking", EventCategory.BUSINESS), ("workshop", EventCategory.EDUCATION), ("lecture", EventCategory.EDUCATION),
    ("talk", EventCategory.EDUCATION), ("concert", EventCategory.MUSIC), ("gig", EventCategory.MUSIC),
    ("exhibition", EventCategory.ARTS), ("film", EventCategory.ARTS), ("run", EventCategory.SPORTS),
]


def load_feeds(path: str = FEEDS_FILE) -> List[Dict[str, Any]]:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return []
    except (OSError, ValueError) as e:
        logger.warning(f"feeds.json unreadable: {e}")
        return []
    return [f for f in data if isinstance(f, dict) and f.get("url")]


def _as_utc(v: Any, tz: str) -> Optional[datetime]:
    if isinstance(v, datetime):
        return to_utc(v, tz) if v.tzinfo is None else v.astimezone(timezone.utc)
    if isinstance(v, date):
        return to_utc(datetime(v.year, v.month, v.day), tz)
    return None


def _category(text: str, fallback: Optional[str]) -> EventCategory:
    t = f" {text.lower()} "
    for w, c in WORDS:
        if w in t:
            return c
    try:
        return EventCategory(fallback) if fallback else EventCategory.OTHER
    except ValueError:
        return EventCategory.OTHER


def parse_feed(text: str, feed: Dict[str, Any], now: Optional[datetime] = None) -> List[EventCreate]:
    from icalendar import Calendar  # optional dependency, imported only when feeds exist

    now = now or datetime.now(timezone.utc)
    until = now + timedelta(days=HORIZON_DAYS)
    tz = feed.get("tz") or "UTC"
    try:
        cal = Calendar.from_ical(text)
    except ValueError as e:
        logger.warning(f"[ics] {feed.get('url')}: not a calendar ({e})")
        return []
    out: List[EventCreate] = []
    for comp in cal.walk("VEVENT"):
        title = str(comp.get("SUMMARY") or "").strip()
        start = _as_utc(getattr(comp.get("DTSTART"), "dt", None), tz)
        if not title or start is None or start > until:
            continue
        end = _as_utc(getattr(comp.get("DTEND"), "dt", None), tz)
        if (end or start) < now:
            continue
        status = str(comp.get("STATUS") or "").upper()
        if status == "CANCELLED":
            continue
        geo = comp.get("GEO")
        lat = getattr(geo, "latitude", None) if geo else None
        lng = getattr(geo, "longitude", None) if geo else None
        cats = comp.get("CATEGORIES")
        cat_text = ""
        if cats is not None:
            items = cats if isinstance(cats, list) else [cats]
            cat_text = " ".join(str(c) for item in items for c in getattr(item, "cats", [item]))
        uid = str(comp.get("UID") or f"{title}|{start.isoformat()}")
        desc = strip_html(str(comp.get("DESCRIPTION") or "")) or None
        out.append(
            EventCreate(
                title=title,
                description=desc,
                category=_category(f"{cat_text} {title}", feed.get("category")),
                start_time=start,
                end_time=end if end and end > start else None,
                location_name=str(comp.get("LOCATION") or "") or feed.get("name"),
                city=feed.get("city"),
                country=(feed.get("country") or "US").upper(),
                lat=lat if lat is not None else feed.get("lat"),
                lng=lng if lng is not None else feed.get("lng"),
                url=str(comp.get("URL") or "") or feed.get("link") or None,
                is_free=bool(feed.get("free")),
                source="ics",
                source_id=hashlib.sha1(f"{feed['url']}|{uid}".encode()).hexdigest()[:24],
                raw_data={"timezone": tz, "feed": feed.get("name") or feed["url"]},
            )
        )
    return out


class IcsFeedsScraper(BaseScraper):
    name = "ics"

    def __init__(self, feeds: Optional[List[Dict[str, Any]]] = None):
        self.feeds = feeds if feeds is not None else load_feeds()

    async def scrape(self, city: Optional[str] = None, **kwargs) -> List[EventCreate]:
        feeds = [f for f in self.feeds if not city or (f.get("city") or "").lower() == city.lower()]
        if not feeds:
            self._log("no feeds configured in feeds.json")
            return []
        out: List[EventCreate] = []
        async with new_client(headers={"Accept": "text/calendar, */*"}) as client:
            for feed in feeds:
                try:
                    r = await client.get(feed["url"])
                    r.raise_for_status()
                except Exception as e:  # noqa: BLE001 - one bad feed shouldn't stop the rest
                    logger.warning(f"[ics] {feed['url']}: {e}")
                    continue
                got = parse_feed(r.text, feed)
                self._log(f"{feed.get('name') or feed['url']}: {len(got)} events")
                out.extend(got)
        return out
