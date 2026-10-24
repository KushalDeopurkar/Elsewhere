"""
Insider.in (Paytm Insider) scraper — uses the public JSON API at
api.insider.in to fetch events across major Indian cities.
No API key required.

Usage:
    from app.scrapers.insider import InsiderScraper
    scraper = InsiderScraper()
    events = await scraper.scrape()
"""

from __future__ import annotations

import asyncio
import json
import logging
import ssl
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict

from app.models.event import EventCreate, EventCategory
from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))

# Insider.in city slugs
INSIDER_CITIES = [
    "mumbai", "delhi", "bengaluru", "hyderabad", "chennai",
    "kolkata", "pune", "ahmedabad", "jaipur", "lucknow",
    "chandigarh", "kochi", "goa", "indore",
    "guwahati", "thiruvananthapuram", "coimbatore",
    "nagpur", "vadodara", "bhopal", "noida",
]

# Insider category groups to our categories
INSIDER_CATEGORY_MAP: Dict[str, str] = {
    "music": "music",
    "comedy": "arts",
    "performing-arts": "arts",
    "art": "arts",
    "workshops": "education",
    "talks": "education",
    "food-and-drinks": "food",
    "sports": "sports",
    "fitness": "health",
    "wellness": "health",
    "nightlife": "nightlife",
    "kids": "family",
    "outdoor": "outdoor",
    "screening": "arts",
    "exhibition": "arts",
    "meetup": "community",
    "conference": "tech",
    "hackathon": "tech",
    "tech": "tech",
    "business": "business",
}

# Fallback city coordinates
CITY_COORDS: Dict[str, tuple] = {
    "mumbai": (19.076, 72.878), "delhi": (28.614, 77.209),
    "bengaluru": (12.972, 77.595), "hyderabad": (17.385, 78.487),
    "chennai": (13.083, 80.271), "kolkata": (22.573, 88.364),
    "pune": (18.520, 73.857), "ahmedabad": (23.023, 72.571),
    "jaipur": (26.912, 75.787), "lucknow": (26.847, 80.947),
    "chandigarh": (30.733, 76.779), "kochi": (9.932, 76.267),
    "goa": (15.300, 73.914), "indore": (22.720, 75.858),
    "bhopal": (23.260, 77.413), "nagpur": (21.146, 79.089),
    "vadodara": (22.310, 73.192), "coimbatore": (11.017, 76.956),
    "thiruvananthapuram": (8.525, 76.936),
    "guwahati": (26.144, 91.736), "noida": (28.535, 77.391),
}

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


class InsiderScraper(BaseScraper):
    """Scrapes Insider.in (Paytm Insider) public API for events."""

    name = "insider"

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.ctx = ssl.create_default_context()
        self._seen_ids: set = set()

    async def scrape(self, city: Optional[str] = None, **kwargs) -> List[EventCreate]:
        cities = [city] if city else INSIDER_CITIES
        all_events: List[EventCreate] = []

        for c in cities:
            try:
                city_events = await self._scrape_city(c)
                all_events.extend(city_events)
                self._log(f"{c}: {len(city_events)} events (total: {len(all_events)})")
            except Exception as e:
                self._log(f"Error scraping {c}: {e}")
                continue

        self._log(f"Finished: {len(all_events)} events from {len(cities)} cities")
        return all_events

    async def _scrape_city(self, city: str) -> List[EventCreate]:
        """Fetch events for a city using Insider.in's homepage API."""
        events: List[EventCreate] = []

        # Method 1: Try the home API which returns categorized events
        home_events = await self._fetch_home_api(city)
        events.extend(home_events)

        # Method 2: Try the explore/list API
        list_events = await self._fetch_list_api(city)
        events.extend(list_events)

        await asyncio.sleep(self.delay)
        return events

    async def _fetch_home_api(self, city: str) -> List[EventCreate]:
        """Fetch from the home API endpoint."""
        url = f"https://api.insider.in/home?city={city}&filterBy=go-out"
        data = await self._fetch_json(url)
        if not data:
            return []

        events: List[EventCreate] = []

        # The home API returns sections with groups of events
        masters = data.get("masterList", {})
        if isinstance(masters, dict):
            for event_id, event_data in masters.items():
                event = self._parse_insider_event(event_data, city)
                if event:
                    events.append(event)

        return events

    async def _fetch_list_api(self, city: str) -> List[EventCreate]:
        """Fetch from the explore/list API endpoint."""
        url = f"https://api.insider.in/home?city={city}&filterBy=online"
        # Actually let's also try a different approach
        url2 = f"https://api.insider.in/home?city={city}"

        events: List[EventCreate] = []

        for api_url in [url2]:
            data = await self._fetch_json(api_url)
            if not data:
                continue

            masters = data.get("masterList", {})
            if isinstance(masters, dict):
                for event_id, event_data in masters.items():
                    event = self._parse_insider_event(event_data, city)
                    if event:
                        events.append(event)

        return events

    async def _fetch_json(self, url: str) -> Optional[Dict]:
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
        }
        try:
            req = urllib.request.Request(url, headers=headers)
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(
                None,
                lambda: urllib.request.urlopen(req, context=self.ctx, timeout=20),
            )
            body = resp.read().decode("utf-8", errors="replace")
            return json.loads(body)
        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return None

    def _parse_insider_event(self, raw: Dict, city_hint: str) -> Optional[EventCreate]:
        """Parse a single Insider.in event from the API response."""
        try:
            # Get unique ID
            event_id = raw.get("_id", "") or raw.get("slug", "")
            if not event_id or event_id in self._seen_ids:
                return None
            self._seen_ids.add(event_id)

            title = raw.get("name", "").strip()
            if not title:
                return None

            # Skip online-only events
            model = raw.get("model", "")
            is_online = raw.get("is_online", False)

            # Dates — Insider uses epoch milliseconds or ISO strings
            min_show_start = raw.get("min_show_start_time")
            max_show_end = raw.get("max_show_end_time")

            start_time = self._parse_insider_date(min_show_start)
            end_time = self._parse_insider_date(max_show_end)

            if not start_time:
                # Try alternative date fields
                date_str = raw.get("date_string", "")
                if date_str:
                    start_time = self._try_parse_date_string(date_str)

            if not start_time:
                return None

            # Location
            venue_data = raw.get("venue_name", "") or raw.get("venue", "")
            if isinstance(venue_data, dict):
                venue_name = venue_data.get("name", "")
            else:
                venue_name = str(venue_data)

            city_name = raw.get("city", city_hint)

            # Coordinates from venue
            venue_obj = raw.get("venue", {})
            lat, lng = None, None
            if isinstance(venue_obj, dict):
                geo = venue_obj.get("geoLocation", {}) or venue_obj.get("location", {})
                if isinstance(geo, dict):
                    lat = geo.get("lat") or geo.get("latitude")
                    lng = geo.get("lng") or geo.get("longitude")
                if not venue_name:
                    venue_name = venue_obj.get("name", "")

            # Fallback coordinates
            if not lat or not lng:
                coords = CITY_COORDS.get(city_hint.lower(), (19.076, 72.878))
                lat, lng = coords

            # URL
            slug = raw.get("slug", "")
            event_url = f"https://insider.in/{slug}" if slug else ""

            # Image
            image_url = ""
            horizontal_cover = raw.get("horizontal_cover_image", "")
            cover = raw.get("cover_image", "")
            if horizontal_cover:
                image_url = horizontal_cover
            elif cover:
                image_url = cover
            # Sometimes images are in group_data
            group = raw.get("group_data", {})
            if not image_url and isinstance(group, dict):
                image_url = group.get("cover_image", "") or group.get("horizontal_cover_image", "")

            # Category
            category_id = raw.get("category_id", {})
            group_name = ""
            if isinstance(category_id, dict):
                group_name = category_id.get("name", "").lower()
            elif isinstance(category_id, str):
                group_name = category_id.lower()

            tags = raw.get("tags", [])
            if isinstance(tags, list):
                tags_str = " ".join(str(t).lower() for t in tags)
            else:
                tags_str = ""

            category = self._map_category(group_name, tags_str)

            # Price
            price_min = raw.get("min_price")
            price_max = raw.get("max_price")
            is_free = False

            price_display = raw.get("price_display_string", "")
            if price_display and "free" in price_display.lower():
                is_free = True
            elif price_min is not None:
                try:
                    price_min = float(price_min)
                    is_free = price_min == 0
                except (ValueError, TypeError):
                    price_min = None

            if price_max is not None:
                try:
                    price_max = float(price_max)
                except (ValueError, TypeError):
                    price_max = None

            # Description
            description = raw.get("short_desc", "") or raw.get("description", "")
            if isinstance(description, str) and len(description) > 2000:
                description = description[:1997] + "..."

            return EventCreate(
                source="insider",
                source_id=f"in-{event_id}",
                title=title,
                description=description,
                start_time=start_time,
                end_time=end_time,
                location_name=venue_name,
                address=city_name,
                city=city_name.title() if city_name else None,
                lat=float(lat) if lat else None,
                lng=float(lng) if lng else None,
                category=EventCategory(category),
                is_free=is_free,
                price_min=price_min,
                price_max=price_max,
                country="IN",
                url=event_url,
                image_url=image_url,
            )
        except Exception as e:
            logger.warning(f"Failed to parse insider event: {e}")
            return None

    def _parse_insider_date(self, value) -> Optional[datetime]:
        """Parse Insider.in date — could be epoch ms, epoch s, or ISO string."""
        if not value:
            return None
        if isinstance(value, (int, float)):
            # Epoch milliseconds if > 1e12, otherwise seconds
            ts = value / 1000 if value > 1e12 else value
            try:
                return datetime.fromtimestamp(ts, tz=IST)
            except (OSError, ValueError):
                return None
        if isinstance(value, str):
            for fmt in [
                "%Y-%m-%dT%H:%M:%S.%f%z",
                "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d",
            ]:
                try:
                    dt = datetime.strptime(value[:30], fmt)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=IST)
                    return dt
                except ValueError:
                    continue
        return None

    def _try_parse_date_string(self, s: str) -> Optional[datetime]:
        """Best-effort parse of human-readable date strings like 'Oct 25, 2026'."""
        import re
        # Try common patterns
        for fmt in ["%b %d, %Y", "%B %d, %Y", "%d %b %Y", "%d %B %Y"]:
            try:
                dt = datetime.strptime(s.strip(), fmt)
                return dt.replace(tzinfo=IST)
            except ValueError:
                continue
        return None

    def _map_category(self, group_name: str, tags: str) -> str:
        """Map Insider category/tags to our EventCategory."""
        combined = f"{group_name} {tags}".lower()

        for key, cat in INSIDER_CATEGORY_MAP.items():
            if key in combined:
                return cat

        return "community"
