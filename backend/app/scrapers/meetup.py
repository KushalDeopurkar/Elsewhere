"""
Meetup.com scraper — extracts event data from __NEXT_DATA__ embedded in
city search result pages. No API key required.

Usage:
    from app.scrapers.meetup import MeetupScraper
    scraper = MeetupScraper()
    events = await scraper.scrape()
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import ssl
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict

from app.models.event import EventCreate, EventCategory
from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))

# Meetup city slugs with coordinates
MEETUP_CITIES = [
    ("in--mumbai", 19.076, 72.878),
    ("in--delhi", 28.614, 77.209),
    ("in--bengaluru", 12.972, 77.595),
    ("in--hyderabad", 17.385, 78.487),
    ("in--chennai", 13.083, 80.271),
    ("in--kolkata", 22.573, 88.364),
    ("in--pune", 18.520, 73.857),
    ("in--ahmedabad", 23.023, 72.571),
    ("in--jaipur", 26.912, 75.787),
    ("in--kochi", 9.932, 76.267),
    ("in--goa", 15.300, 73.914),
    ("in--chandigarh", 30.733, 76.779),
    ("in--indore", 22.720, 75.858),
    ("in--lucknow", 26.847, 80.947),
    ("in--gurgaon", 28.459, 77.027),
    ("in--noida", 28.535, 77.391),
    ("in--thiruvananthapuram", 8.525, 76.936),
    ("in--coimbatore", 11.017, 76.956),
    ("in--guwahati", 26.144, 91.736),
]

# Top Meetup category IDs
DEFAULT_CATEGORY_IDS = [546, 292, 638, 618, 466, 622, 242, 673, 482]

MEETUP_CATEGORY_MAP: Dict[int, str] = {
    546: "tech", 242: "tech", 638: "sports", 395: "health",
    522: "community", 292: "music", 673: "arts", 434: "arts",
    482: "community", 388: "education", 622: "education",
    484: "education", 575: "arts", 563: "community",
    618: "food", 466: "outdoor",
}

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


class MeetupScraper(BaseScraper):
    """Scrapes Meetup.com using __NEXT_DATA__ Apollo cache in HTML pages."""

    name = "meetup"

    def __init__(self, delay: float = 2.0, category_ids: List[int] = None):
        self.delay = delay
        self.category_ids = category_ids or DEFAULT_CATEGORY_IDS
        self.ctx = ssl.create_default_context()
        self._seen_ids: set = set()

    async def scrape(self, city: Optional[str] = None, **kwargs) -> List[EventCreate]:
        if city:
            # Find matching city tuple
            matched = [(s, la, ln) for s, la, ln in MEETUP_CITIES if city.lower() in s]
            cities = matched if matched else MEETUP_CITIES
        else:
            cities = MEETUP_CITIES

        all_events: List[EventCreate] = []
        for city_slug, lat, lng in cities:
            try:
                city_events = await self._scrape_city(city_slug, lat, lng)
                all_events.extend(city_events)
                self._log(f"{city_slug}: {len(city_events)} events (total: {len(all_events)})")
            except Exception as e:
                self._log(f"Error scraping {city_slug}: {e}")
                continue

        self._log(f"Finished: {len(all_events)} events from {len(cities)} cities")
        return all_events

    async def _scrape_city(
        self, city_slug: str, city_lat: float, city_lng: float
    ) -> List[EventCreate]:
        events: List[EventCreate] = []
        for cat_id in self.category_ids:
            url = (
                f"https://www.meetup.com/find/"
                f"?location={city_slug}&source=EVENTS"
                f"&categoryId={cat_id}&distance=fiftyMiles"
            )

            html = await self._fetch(url)
            if not html:
                continue

            raw_events = self._extract_apollo_events(html)
            for raw in raw_events:
                event = self._parse_event(raw, city_lat, city_lng, cat_id)
                if event:
                    events.append(event)

            await asyncio.sleep(self.delay)
        return events

    async def _fetch(self, url: str) -> Optional[str]:
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        }
        try:
            req = urllib.request.Request(url, headers=headers)
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(
                None,
                lambda: urllib.request.urlopen(req, context=self.ctx, timeout=20),
            )
            return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return None

    def _extract_apollo_events(self, html: str) -> List[Dict]:
        events = []
        match = re.search(
            r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',
            html, re.DOTALL,
        )
        if not match:
            idx = html.find('__NEXT_DATA__')
            if idx == -1:
                return []
            try:
                json_start = html.index('{', idx)
            except ValueError:
                return []
            depth = 0
            data = None
            for i in range(json_start, min(json_start + 600000, len(html))):
                if html[i] == '{':
                    depth += 1
                elif html[i] == '}':
                    depth -= 1
                if depth == 0:
                    try:
                        data = json.loads(html[json_start:i + 1])
                    except json.JSONDecodeError:
                        return []
                    break
            if data is None:
                return []
        else:
            try:
                data = json.loads(match.group(1))
            except json.JSONDecodeError:
                return []

        apollo = (
            data.get("props", {})
            .get("pageProps", {})
            .get("__APOLLO_STATE__", {})
        )
        if not apollo:
            return []

        for key, value in apollo.items():
            if key.startswith("Event:") and isinstance(value, dict):
                for ref_field, dest_field in [
                    ("group", "_group"), ("venue", "_venue"), ("featuredEventPhoto", "_photo")
                ]:
                    ref = value.get(ref_field, {})
                    if isinstance(ref, dict) and "__ref" in ref:
                        value[dest_field] = apollo.get(ref["__ref"], {})
                events.append(value)

        return events

    def _parse_event(
        self, raw: Dict, city_lat: float, city_lng: float, category_id: int = 546
    ) -> Optional[EventCreate]:
        try:
            event_id = raw.get("id", "")
            if not event_id or event_id in self._seen_ids:
                return None
            self._seen_ids.add(event_id)

            title = raw.get("title", "").strip()
            if not title:
                return None

            # Date
            date_str = raw.get("dateTime", "")
            if not date_str:
                return None
            try:
                start_time = datetime.fromisoformat(date_str)
            except ValueError:
                return None

            # Venue
            venue = raw.get("_venue", {})
            venue_name = venue.get("name", "")
            lat = venue.get("lat") or city_lat
            lng = venue.get("lng") or city_lng
            address = venue.get("address", "")
            city = venue.get("city", "")

            if not venue_name:
                group = raw.get("_group", {})
                venue_name = group.get("name", "Meetup Event")

            url = raw.get("eventUrl", "")

            description = raw.get("description", "")
            if len(description) > 2000:
                description = description[:1997] + "..."

            # Price
            fee = raw.get("feeSettings")
            is_free = fee is None
            price_min = None
            if isinstance(fee, dict):
                price_min = fee.get("amount")

            # Image
            photo = raw.get("_photo", {})
            image_url = photo.get("highResUrl") or photo.get("baseUrl") or ""

            category = MEETUP_CATEGORY_MAP.get(category_id, "community")

            # Skip online events
            if raw.get("eventType") == "ONLINE":
                return None

            return EventCreate(
                source="meetup",
                source_id=f"mu-{event_id}",
                title=title,
                description=description,
                start_time=start_time,
                end_time=None,
                location_name=venue_name,
                address=f"{address}, {city}".strip(", ") if address else city,
                city=city.title() if city else None,
                lat=float(lat),
                lng=float(lng),
                category=EventCategory(category),
                is_free=is_free,
                price_min=price_min,
                price_max=None,
                country="IN",
                url=url,
                image_url=image_url,
            )
        except Exception as e:
            logger.warning(f"Failed to parse meetup event: {e}")
            return None
