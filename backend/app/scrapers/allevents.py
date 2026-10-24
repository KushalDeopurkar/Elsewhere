"""
AllEvents.in scraper — extracts structured event data from Schema.org LD+JSON
embedded in city pages. No API key required.

Usage:
    from app.scrapers.allevents import AllEventsScraper
    scraper = AllEventsScraper()
    events = await scraper.scrape()              # every configured city
    events = await scraper.scrape(city="pune")   # one city
"""

from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone
from typing import List, Optional, Dict
from hashlib import md5

import httpx

from app.models.event import EventCreate, EventCategory
from app.scrapers.base import BaseScraper
from app.scrapers.classify import classify

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

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}


class AllEventsScraper(BaseScraper):
    """Scrapes allevents.in city pages for Schema.org Event markup."""

    name = "allevents"

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self._seen_urls: set = set()

    async def scrape(
        self, city: Optional[str] = None, **kwargs
    ) -> List[EventCreate]:
        """Scrape one city, or every configured city when city is None.

        Accepts an optional `categories` keyword; defaults to ["all"], the
        broadest listing page.
        """
        cities = [self._normalize_city(city)] if city else list(INDIAN_CITIES)
        categories = kwargs.get("categories") or ["all"]

        # Reset per run so a reused instance does not dedup itself to nothing.
        self._seen_urls = set()
        all_events: List[EventCreate] = []

        async with httpx.AsyncClient(
            timeout=30.0,
            headers=HEADERS,
            follow_redirects=True,
            transport=httpx.AsyncHTTPTransport(retries=3),
        ) as client:
            for c in cities:
                try:
                    all_events.extend(
                        await self._scrape_city(client, c, categories)
                    )
                except Exception as e:
                    self._log(f"Error scraping {c}: {e}")
                    continue

        self._log(f"Scraped {len(all_events)} events from {len(cities)} cities")
        return all_events

    @staticmethod
    def _normalize_city(city: str) -> str:
        """Turn a display name like 'Navi Mumbai' into an URL slug."""
        return city.strip().lower().replace(" ", "-")

    async def _scrape_city(
        self, client: httpx.AsyncClient, city: str, categories: List[str]
    ) -> List[EventCreate]:
        """Scrape events for a single city across categories."""
        events: List[EventCreate] = []
        for cat in categories:
            url = f"https://allevents.in/{city}/{cat}"
            self._log(f"Scraping {url}")

            html = await self._fetch(client, url)
            if not html:
                continue

            raw_events = self._extract_ld_json_events(html)
            self._log(f"Found {len(raw_events)} events in {city}/{cat}")

            for raw in raw_events:
                event = self._parse_event(raw, category_hint=cat)
                if event:
                    events.append(event)

            await asyncio.sleep(self.delay)

        self._log(f"Total for {city}: {len(events)} events")
        return events

    async def _fetch(
        self, client: httpx.AsyncClient, url: str
    ) -> Optional[str]:
        """Fetch a URL and return the HTML content."""
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text
        except httpx.HTTPError as e:
            self._log(f"Failed to fetch {url}: {e}")
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

            # The crawl path is usually "all", which says nothing about the
            # event, so the category comes from the event's own words and the
            # path is only a tie-breaker.
            hinted = CATEGORY_MAP.get(category_hint)
            category = classify(
                name,
                str(raw.get("description") or ""),
                fallback=EventCategory.COMMUNITY,
                hint=EventCategory(hinted) if hinted else None,
            )

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
                category=category,
                is_free=is_free,
                price_min=price_min,
                price_max=price_max,
                country="IN",
                url=url,
                image_url=image,
            )
        except Exception as e:
            self._log(f"Failed to parse event: {e}")
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
