"""
Meetup.com scraper — extracts event data from __NEXT_DATA__ embedded in
city search result pages. No API key required.

Usage:
    from app.scrapers.meetup import MeetupScraper
    scraper = MeetupScraper()
    events = await scraper.scrape()               # every configured city
    events = await scraper.scrape(city="mumbai")  # one city
"""

from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict

import httpx

from app.models.event import EventCreate, EventCategory
from app.scrapers.base import BaseScraper

IST = timezone(timedelta(hours=5, minutes=30))

# Meetup city slugs for India
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

# Meetup topic category IDs
CATEGORY_IDS = [
    546,   # Technology
    242,   # Career & Business
    638,   # Sports & Fitness
    395,   # Health & Wellbeing
    436,   # Beliefs
    522,   # Games
    292,   # Music
    673,   # Arts & Culture
    434,   # Film
    482,   # Social Activities
    388,   # Book Clubs
    622,   # Education & Learning
    484,   # Science
    575,   # Photography
    563,   # Language & Culture
    618,   # Food & Drink
    466,   # Outdoors & Adventure
]

# Map Meetup categories to our categories
MEETUP_CATEGORY_MAP = {
    546: "tech",
    242: "tech",
    638: "sports",
    395: "health",
    522: "community",
    292: "music",
    673: "arts",
    434: "arts",
    482: "community",
    388: "education",
    622: "education",
    484: "education",
    575: "arts",
    563: "community",
    618: "food",
    466: "outdoor",
}

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

# Look up a city entry by its bare name, e.g. "mumbai" -> ("in--mumbai", ...).
MEETUP_CITY_INDEX = {
    slug.split("--")[-1]: (slug, lat, lng) for slug, lat, lng in MEETUP_CITIES
}


class MeetupScraper(BaseScraper):
    """Scrapes meetup.com search pages via their embedded Apollo cache."""

    name = "meetup"

    def __init__(self, delay: float = 2.0):
        self.delay = delay
        self._seen_ids: set = set()

    async def scrape(
        self, city: Optional[str] = None, **kwargs
    ) -> List[EventCreate]:
        """Scrape one city, or every configured city when city is None.

        Accepts an optional `category_ids` keyword; defaults to the top
        categories used by _scrape_city.
        """
        cities = self._resolve_cities(city)
        category_ids = kwargs.get("category_ids")

        # Reset per run so a reused instance does not dedup itself to nothing.
        self._seen_ids = set()
        all_events: List[EventCreate] = []

        async with httpx.AsyncClient(
            timeout=30.0,
            headers=HEADERS,
            follow_redirects=True,
            transport=httpx.AsyncHTTPTransport(retries=3),
        ) as client:
            for city_slug, lat, lng in cities:
                try:
                    all_events.extend(
                        await self._scrape_city(
                            client, city_slug, lat, lng, category_ids
                        )
                    )
                except Exception as e:
                    self._log(f"Error scraping {city_slug}: {e}")
                    continue

        self._log(f"Scraped {len(all_events)} events from {len(cities)} cities")
        return all_events

    def _resolve_cities(self, city: Optional[str]) -> List[tuple]:
        """Map a city name onto configured (slug, lat, lng) entries."""
        if not city:
            return list(MEETUP_CITIES)
        key = city.strip().lower().replace(" ", "-")
        if key.startswith("in--"):
            key = key[len("in--"):]
        entry = MEETUP_CITY_INDEX.get(key)
        if entry is None:
            self._log(f"No Meetup city slug configured for {city!r} — skipping")
            return []
        return [entry]

    async def _fetch(
        self, client: httpx.AsyncClient, url: str
    ) -> Optional[str]:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text
        except httpx.HTTPError as e:
            self._log(f"Failed to fetch {url}: {e}")
            return None

    def _extract_apollo_events(self, html: str) -> List[Dict]:
        """Extract events from Meetup's __NEXT_DATA__ Apollo cache."""
        events = []
        match = re.search(
            r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',
            html,
            re.DOTALL,
        )
        if not match:
            # Try alternate pattern
            idx = html.find('__NEXT_DATA__')
            if idx == -1:
                return []
            json_start = html.index('{', idx)
            depth = 0
            for i in range(json_start, min(json_start + 600000, len(html))):
                if html[i] == '{': depth += 1
                elif html[i] == '}': depth -= 1
                if depth == 0:
                    try:
                        data = json.loads(html[json_start:i+1])
                    except json.JSONDecodeError:
                        return []
                    break
            else:
                return []
        else:
            try:
                data = json.loads(match.group(1))
            except json.JSONDecodeError:
                return []

        # Navigate Apollo state
        apollo = (
            data.get("props", {})
            .get("pageProps", {})
            .get("__APOLLO_STATE__", {})
        )

        if not apollo:
            return []

        # Collect all Event entities
        for key, value in apollo.items():
            if key.startswith("Event:") and isinstance(value, dict):
                # Resolve group reference
                group_ref = value.get("group", {})
                if isinstance(group_ref, dict) and "__ref" in group_ref:
                    group_data = apollo.get(group_ref["__ref"], {})
                    value["_group"] = group_data

                # Resolve venue reference
                venue_ref = value.get("venue", {})
                if isinstance(venue_ref, dict) and "__ref" in venue_ref:
                    venue_data = apollo.get(venue_ref["__ref"], {})
                    value["_venue"] = venue_data

                # Resolve photo reference
                photo_ref = value.get("featuredEventPhoto", {})
                if isinstance(photo_ref, dict) and "__ref" in photo_ref:
                    photo_data = apollo.get(photo_ref["__ref"], {})
                    value["_photo"] = photo_data

                events.append(value)

        return events

    def _parse_event(
        self, raw: Dict, city_lat: float, city_lng: float, category_id: int = 546
    ) -> Optional[EventCreate]:
        """Convert a Meetup Apollo Event to EventCreate."""
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
            start_time = None
            if date_str:
                try:
                    start_time = datetime.fromisoformat(date_str)
                except ValueError:
                    return None
            if not start_time:
                return None

            # Venue & coordinates
            venue = raw.get("_venue", {})
            venue_name = venue.get("name", "")
            lat = venue.get("lat") or city_lat
            lng = venue.get("lng") or city_lng
            address = venue.get("address", "")
            city = venue.get("city", "")

            if not venue_name:
                group = raw.get("_group", {})
                venue_name = group.get("name", "Meetup Event")

            # URL
            url = raw.get("eventUrl", "")

            # Description (truncate for DB)
            description = raw.get("description", "")
            if len(description) > 2000:
                description = description[:1997] + "..."

            # Price — Meetup events are usually free
            fee = raw.get("feeSettings")
            is_free = fee is None
            price_min = None
            if isinstance(fee, dict):
                price_min = fee.get("amount")

            # Image
            photo = raw.get("_photo", {})
            image_url = photo.get("highResUrl") or photo.get("baseUrl") or ""

            # Category
            category = MEETUP_CATEGORY_MAP.get(category_id, "community")

            # Event type
            event_type = raw.get("eventType", "PHYSICAL")
            if event_type == "ONLINE":
                return None  # Skip online events for a local discovery app

            return EventCreate(
                source="meetup",
                source_id=f"mu-{event_id}",
                title=title,
                description=description,
                start_time=start_time,
                end_time=None,
                location_name=venue_name,
                address=f"{address}, {city}".strip(", ") if address else city,
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
            self._log(f"Failed to parse meetup event: {e}")
            return None

    async def _scrape_city(
        self, client: httpx.AsyncClient, city_slug: str, city_lat: float,
        city_lng: float, category_ids: List[int] = None,
    ) -> List[EventCreate]:
        """Scrape events for one city across category IDs."""
        if category_ids is None:
            category_ids = [546, 292, 638, 618, 466, 622]  # Top categories

        events = []
        for cat_id in category_ids:
            url = (
                f"https://www.meetup.com/find/"
                f"?location={city_slug}&source=EVENTS"
                f"&categoryId={cat_id}&distance=fiftyMiles"
            )
            self._log(f"Scraping {url}")

            html = await self._fetch(client, url)
            if not html:
                continue

            raw_events = self._extract_apollo_events(html)
            self._log(f"  Found {len(raw_events)} events for {city_slug} cat={cat_id}")

            for raw in raw_events:
                event = self._parse_event(raw, city_lat, city_lng, cat_id)
                if event:
                    events.append(event)

            await asyncio.sleep(self.delay)

        self._log(f"Total for {city_slug}: {len(events)} events")
        return events
