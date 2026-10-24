"""
AllEvents.in scraper — extracts structured event data from Schema.org LD+JSON
embedded in city pages. No API key required.

Usage:
    from app.scrapers.allevents import AllEventsScraper
    scraper = AllEventsScraper()
    events = scraper.scrape_all_cities()  # returns list of EventCreate
"""

from __future__ import annotations

import json
import logging
import re
import ssl
import time
import urllib.request
from datetime import datetime, timezone
from typing import List, Optional, Dict
from hashlib import md5

from app.models.event import EventCreate, EventCategory

logger = logging.getLogger(__name__)

# Major Indian cities for scraping
INDIAN_CITIES = [
    "mumbai", "delhi", "bangalore", "hyderabad", "chennai",
    "kolkata", "pune", "ahmedabad", "jaipur", "lucknow",
    "chandigarh", "kochi", "goa", "indore", "bhopal",
    "nagpur", "vadodara", "coimbatore", "visakhapatnam", "thiruvananthapuram",
    "guwahati", "dehradun", "mysore", "udaipur", "jodhpur",
    "noida", "gurgaon", "navi-mumbai", "thane",
]

# Category paths to try on AllEvents.in
CATEGORY_PATHS = [
    "all",          # default — mixed events
    "music",
    "comedy",
    "food-and-drink",
    "arts",
    "sports",
    "workshops",
    "business",
    "health-and-wellness",
    "nightlife",
    "kids",
    "outdoor",
]

# Map AllEvents categories to our categories
CATEGORY_MAP = {
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
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


class AllEventsScraper:
    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.ctx = ssl.create_default_context()
        self._seen_urls: set = set()

    def _fetch(self, url: str) -> Optional[str]:
        """Fetch a URL and return the HTML content."""
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        }
        try:
            req = urllib.request.Request(url, headers=headers)
            resp = urllib.request.urlopen(req, context=self.ctx, timeout=20)
            return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return None

    def _extract_ld_json_events(self, html: str) -> List[Dict]:
        """Extract Event objects from Schema.org LD+JSON blocks."""
        events = []
        blocks = re.findall(
            r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
            html,
            re.DOTALL,
        )
        for block in blocks:
            try:
                data = json.loads(block)
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and item.get("@type") == "Event":
                            events.append(item)
                elif isinstance(data, dict):
                    if data.get("@type") == "Event":
                        events.append(data)
            except json.JSONDecodeError:
                continue
        return events

    def _parse_event(self, raw: Dict, category_hint: str = "all") -> Optional[EventCreate]:
        """Convert a Schema.org Event dict to our EventCreate model."""
        try:
            name = raw.get("name", "").strip()
            if not name:
                return None

            url = raw.get("url", "")
            if url in self._seen_urls:
                return None
            self._seen_urls.add(url)

            # Source ID from URL or hash
            source_id = url.split("/")[-1] if url else md5(name.encode()).hexdigest()[:16]

            # Location
            location = raw.get("location", {})
            venue = location.get("name", "") if isinstance(location, dict) else ""
            address_obj = location.get("address", {}) if isinstance(location, dict) else {}
            address = address_obj.get("streetAddress", "") if isinstance(address_obj, dict) else ""
            city = address_obj.get("addressLocality", "") if isinstance(address_obj, dict) else ""

            # Coordinates
            geo = location.get("geo", {}) if isinstance(location, dict) else {}
            lat = float(geo.get("latitude", 0)) if geo.get("latitude") else None
            lng = float(geo.get("longitude", 0)) if geo.get("longitude") else None

            if not lat or not lng:
                return None  # Skip events without coordinates

            # Dates
            start_str = raw.get("startDate", "")
            end_str = raw.get("endDate", "")

            start_time = self._parse_date(start_str)
            end_time = self._parse_date(end_str) if end_str else None

            if not start_time:
                return None

            # Skip past events
            if start_time < datetime.now(timezone.utc):
                pass  # Keep them — they might be today

            # Price
            offers = raw.get("offers", [])
            if isinstance(offers, dict):
                offers = [offers]

            price_min = None
            price_max = None
            is_free = True

            for offer in (offers or []):
                if isinstance(offer, dict):
                    low = offer.get("lowPrice")
                    high = offer.get("highPrice")
                    if low and str(low) != "free":
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

            # Category mapping
            category = CATEGORY_MAP.get(category_hint, "community")

            # Image
            image = raw.get("image", "")
            if isinstance(image, list):
                image = image[0] if image else ""
            if isinstance(image, dict):
                image = image.get("url", "")

            return EventCreate(
                source="allevents",
                source_id=f"ae-{source_id}",
                title=name,
                description="",  # Not in LD+JSON; could fetch detail page later
                start_time=start_time,
                end_time=end_time,
                location_name=venue,
                address=f"{address}, {city}".strip(", ") if address else city,
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
            logger.warning(f"Failed to parse event: {e}")
            return None

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse various date formats from AllEvents."""
        if not date_str:
            return None
        # Try common formats
        for fmt in [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M%z",
            "%Y-%m-%d",
        ]:
            try:
                dt = datetime.strptime(date_str[:len("2026-01-01T00:00:00+05:30")], fmt)
                if dt.tzinfo is None:
                    # Assume IST
                    from datetime import timedelta
                    dt = dt.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
                return dt
            except ValueError:
                continue
        return None

    def scrape_city(self, city: str, categories: List[str] = None) -> List[EventCreate]:
        """Scrape events for a single city across categories."""
        if categories is None:
            categories = ["all"]  # Start with 'all' to get the broadest coverage

        events = []
        for cat in categories:
            url = f"https://allevents.in/{city}/{cat}"
            logger.info(f"Scraping {url}")

            html = self._fetch(url)
            if not html:
                continue

            raw_events = self._extract_ld_json_events(html)
            logger.info(f"  Found {len(raw_events)} events in {city}/{cat}")

            for raw in raw_events:
                event = self._parse_event(raw, category_hint=cat)
                if event:
                    events.append(event)

            time.sleep(self.delay)

        logger.info(f"Total for {city}: {len(events)} events")
        return events

    def scrape_all_cities(self, cities: List[str] = None, categories: List[str] = None) -> List[EventCreate]:
        """Scrape all configured Indian cities."""
        if cities is None:
            cities = INDIAN_CITIES
        if categories is None:
            categories = ["all"]  # Use 'all' for initial scrape

        all_events = []
        for city in cities:
            try:
                city_events = self.scrape_city(city, categories)
                all_events.extend(city_events)
                logger.info(f"Running total: {len(all_events)} events")
            except Exception as e:
                logger.error(f"Error scraping {city}: {e}")
                continue

        logger.info(f"Grand total: {len(all_events)} events from {len(cities)} cities")
        return all_events
