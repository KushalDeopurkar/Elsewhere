"""
AllEvents.in scraper — extracts structured event data from Schema.org LD+JSON
embedded in city pages. No API key required.

Usage:
    from app.scrapers.allevents import AllEventsScraper
    scraper = AllEventsScraper()
    events = await scraper.scrape()          # all cities, 'all' category
    events = await scraper.scrape(city="mumbai")
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
from hashlib import md5

from app.models.event import EventCreate, EventCategory
from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))

# Major Indian cities
INDIAN_CITIES = [
    "mumbai", "delhi", "bangalore", "hyderabad", "chennai",
    "kolkata", "pune", "ahmedabad", "jaipur", "lucknow",
    "chandigarh", "kochi", "goa", "indore", "bhopal",
    "nagpur", "vadodara", "coimbatore", "visakhapatnam", "thiruvananthapuram",
    "guwahati", "dehradun", "mysore", "udaipur", "jodhpur",
    "noida", "gurgaon", "navi-mumbai", "thane",
]

# Category paths on AllEvents.in
CATEGORY_PATHS = [
    "all", "music", "comedy", "food-and-drink", "arts",
    "sports", "workshops", "business", "health-and-wellness",
    "nightlife", "kids", "outdoor",
]

CATEGORY_MAP: Dict[str, str] = {
    "all": "community",
    "music": "music",
    "comedy": "arts",
    "food-and-drink": "food",
    "arts": "arts",
    "sports": "sports",
    "workshops": "education",
    "business": "tech",
    "health-and-wellness": "health",
    "nightlife": "nightlife",
    "kids": "family",
    "outdoor": "outdoor",
}

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


class AllEventsScraper(BaseScraper):
    """Scrapes AllEvents.in using Schema.org LD+JSON embedded in HTML pages."""

    name = "allevents"

    def __init__(self, delay: float = 1.0, categories: List[str] = None):
        self.delay = delay
        self.categories = categories or ["all"]
        self.ctx = ssl.create_default_context()
        self._seen_urls: set = set()

    async def scrape(self, city: Optional[str] = None, **kwargs) -> List[EventCreate]:
        """Scrape AllEvents.in for Indian cities."""
        cities = [city] if city else INDIAN_CITIES
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
        events: List[EventCreate] = []
        for cat in self.categories:
            url = f"https://allevents.in/{city}/{cat}"
            html = await self._fetch(url)
            if not html:
                continue

            raw_events = self._extract_ld_json_events(html)
            for raw in raw_events:
                event = self._parse_event(raw, city_hint=city, category_hint=cat)
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

    def _extract_ld_json_events(self, html: str) -> List[Dict]:
        events = []
        blocks = re.findall(
            r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
            html, re.DOTALL,
        )
        for block in blocks:
            try:
                data = json.loads(block)
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if isinstance(item, dict) and item.get("@type") == "Event":
                        events.append(item)
            except json.JSONDecodeError:
                continue
        return events

    def _parse_event(
        self, raw: Dict, city_hint: str = "", category_hint: str = "all"
    ) -> Optional[EventCreate]:
        try:
            name = raw.get("name", "").strip()
            if not name:
                return None

            url = raw.get("url", "")
            if url in self._seen_urls:
                return None
            self._seen_urls.add(url)

            source_id = url.split("/")[-1] if url else md5(name.encode()).hexdigest()[:16]

            # Location
            location = raw.get("location", {})
            if isinstance(location, str):
                location = {"name": location}
            venue = location.get("name", "") if isinstance(location, dict) else ""
            address_obj = location.get("address", {}) if isinstance(location, dict) else {}
            if isinstance(address_obj, str):
                address_obj = {"streetAddress": address_obj}
            address = address_obj.get("streetAddress", "") if isinstance(address_obj, dict) else ""
            city = address_obj.get("addressLocality", city_hint) if isinstance(address_obj, dict) else city_hint

            # Coordinates
            geo = location.get("geo", {}) if isinstance(location, dict) else {}
            lat = float(geo.get("latitude", 0)) if geo.get("latitude") else None
            lng = float(geo.get("longitude", 0)) if geo.get("longitude") else None

            # Don't skip events without coords — use city fallback
            if not lat or not lng:
                lat, lng = _city_coords(city_hint)

            # Dates
            start_time = self._parse_date(raw.get("startDate", ""))
            end_time = self._parse_date(raw.get("endDate", "")) if raw.get("endDate") else None
            if not start_time:
                return None

            # Price
            offers = raw.get("offers", [])
            if isinstance(offers, dict):
                offers = [offers]
            price_min, price_max, is_free = None, None, True
            for offer in (offers or []):
                if isinstance(offer, dict):
                    low = offer.get("lowPrice") or offer.get("price")
                    high = offer.get("highPrice")
                    if low and str(low).lower() not in ("free", "0"):
                        try:
                            price_min = float(low)
                            is_free = False
                        except (ValueError, TypeError):
                            pass
                    if high:
                        try:
                            price_max = float(high)
                            is_free = False
                        except (ValueError, TypeError):
                            pass

            # Category
            category = CATEGORY_MAP.get(category_hint, "community")

            # Image
            image = raw.get("image", "")
            if isinstance(image, list):
                image = image[0] if image else ""
            if isinstance(image, dict):
                image = image.get("url", "")

            # Description
            description = raw.get("description", "")
            if len(description) > 2000:
                description = description[:1997] + "..."

            return EventCreate(
                source="allevents",
                source_id=f"ae-{source_id}",
                title=name,
                description=description or "",
                start_time=start_time,
                end_time=end_time,
                location_name=venue,
                address=f"{address}, {city}".strip(", ") if address else (city or ""),
                city=city.title() if city else None,
                lat=lat,
                lng=lng,
                category=EventCategory(category),
                is_free=is_free,
                price_min=price_min,
                price_max=price_max,
                country="IN",
                url=url,
                image_url=image,
            )
        except Exception as e:
            logger.warning(f"Failed to parse allevents event: {e}")
            return None

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        if not date_str:
            return None
        for fmt in [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M%z",
            "%Y-%m-%d",
        ]:
            try:
                dt = datetime.strptime(date_str[:30], fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=IST)
                return dt
            except ValueError:
                continue
        return None


# Fallback city coordinates for events without geo data
_CITY_COORDS: Dict[str, tuple] = {
    "mumbai": (19.076, 72.878), "delhi": (28.614, 77.209),
    "bangalore": (12.972, 77.595), "hyderabad": (17.385, 78.487),
    "chennai": (13.083, 80.271), "kolkata": (22.573, 88.364),
    "pune": (18.520, 73.857), "ahmedabad": (23.023, 72.571),
    "jaipur": (26.912, 75.787), "lucknow": (26.847, 80.947),
    "chandigarh": (30.733, 76.779), "kochi": (9.932, 76.267),
    "goa": (15.300, 73.914), "indore": (22.720, 75.858),
    "bhopal": (23.260, 77.413), "nagpur": (21.146, 79.089),
    "vadodara": (22.310, 73.192), "coimbatore": (11.017, 76.956),
    "visakhapatnam": (17.687, 83.218), "thiruvananthapuram": (8.525, 76.936),
    "guwahati": (26.144, 91.736), "dehradun": (30.317, 78.032),
    "mysore": (12.296, 76.639), "udaipur": (24.586, 73.713),
    "jodhpur": (26.239, 73.025), "noida": (28.535, 77.391),
    "gurgaon": (28.459, 77.027), "navi-mumbai": (19.033, 73.030),
    "thane": (19.218, 72.978),
}


def _city_coords(city_slug: str) -> tuple:
    """Return (lat, lng) for a city slug, or Mumbai as default."""
    return _CITY_COORDS.get(city_slug.lower(), (19.076, 72.878))
