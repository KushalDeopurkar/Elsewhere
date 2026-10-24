"""
District.in (formerly Insider.in / Paytm Insider, now owned by Zomato) scraper.

District.in is a Next.js app that embeds schema.org JSON-LD structured data
in its HTML. We fetch category listing pages per city and parse the JSON-LD
ItemList to extract events. Each listing page yields ~12 events.

URL pattern:
  https://www.district.in/events/{category}-in-{city}-book-tickets

robots.txt: Allow: / (all user agents)

Usage:
    from app.scrapers.district import DistrictScraper
    scraper = DistrictScraper()
    events = await scraper.scrape()
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import ssl
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
from html import unescape
from typing import List, Optional, Dict, Tuple

from app.models.event import EventCreate, EventCategory
from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))

# ── District.in city slugs ──────────────────────────────────────────────────
# District uses lowercase slugs in URLs. Some cities use colloquial names
# (e.g. "bangalore" not "bengaluru", "gurgaon" not "gurugram").
DISTRICT_CITIES = [
    "mumbai", "delhi", "bangalore", "hyderabad", "chennai",
    "kolkata", "pune", "ahmedabad", "jaipur", "lucknow",
    "chandigarh", "kochi", "goa", "indore", "gurgaon",
    "noida", "coimbatore", "nagpur", "vadodara", "bhopal",
    "guwahati", "thiruvananthapuram",
]

# Canonical city name for display (District slug → display name)
CITY_DISPLAY: Dict[str, str] = {
    "bangalore": "Bengaluru",
    "gurgaon": "Gurugram",
    "delhi": "Delhi",
    "mumbai": "Mumbai",
}

# ── Category URL templates (slug patterns used by District.in) ─────────────
# Each entry: (url_slug, our EventCategory mapping)
CATEGORY_URLS: List[Tuple[str, str]] = [
    ("music",           "music"),
    ("comedy-shows",    "arts"),
    ("nightlife",       "nightlife"),
    ("sports-events",   "sports"),
    ("fests-fairs",     "community"),
    ("food-drinks",     "food"),
    ("conferences",     "business"),
    ("fitness-events",  "health"),
    ("openmics",        "arts"),
    ("screenings",      "arts"),
]

# Fallback city coordinates (same as old Insider scraper)
CITY_COORDS: Dict[str, Tuple[float, float]] = {
    "mumbai": (19.076, 72.878), "delhi": (28.614, 77.209),
    "bangalore": (12.972, 77.595), "hyderabad": (17.385, 78.487),
    "chennai": (13.083, 80.271), "kolkata": (22.573, 88.364),
    "pune": (18.520, 73.857), "ahmedabad": (23.023, 72.571),
    "jaipur": (26.912, 75.787), "lucknow": (26.847, 80.947),
    "chandigarh": (30.733, 76.779), "kochi": (9.932, 76.267),
    "goa": (15.300, 73.914), "indore": (22.720, 75.858),
    "gurgaon": (28.459, 77.027), "noida": (28.535, 77.391),
    "bhopal": (23.260, 77.413), "nagpur": (21.146, 79.089),
    "vadodara": (22.310, 73.192), "coimbatore": (11.017, 76.956),
    "thiruvananthapuram": (8.525, 76.936),
    "guwahati": (26.144, 91.736),
}

# Keywords from JSON-LD / URL / title → our category
CATEGORY_KEYWORDS: Dict[str, str] = {
    "music": "music",
    "concert": "music",
    "live band": "music",
    "dj": "nightlife",
    "nightlife": "nightlife",
    "party": "nightlife",
    "comedy": "arts",
    "standup": "arts",
    "stand-up": "arts",
    "theatre": "arts",
    "theater": "arts",
    "dance": "arts",
    "art": "arts",
    "workshop": "education",
    "talk": "education",
    "conference": "business",
    "summit": "business",
    "networking": "business",
    "food": "food",
    "drinks": "food",
    "brunch": "food",
    "sports": "sports",
    "marathon": "sports",
    "cricket": "sports",
    "fitness": "health",
    "yoga": "health",
    "wellness": "health",
    "kids": "family",
    "family": "family",
    "outdoor": "outdoor",
    "trek": "outdoor",
    "hike": "outdoor",
    "fest": "community",
    "fair": "community",
    "carnival": "community",
    "screening": "arts",
    "film": "arts",
    "open mic": "arts",
}

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

# Regex to extract JSON-LD blocks from raw HTML
_JSONLD_RE = re.compile(
    r'<script\s+type=["\']application/ld\+json["\']\s*>(.*?)</script>',
    re.DOTALL,
)


class DistrictScraper(BaseScraper):
    """Scrapes District.in (formerly Insider.in) via JSON-LD in listing pages."""

    name = "district"

    def __init__(self, delay: float = 1.5):
        self.delay = delay
        self.ctx = ssl.create_default_context()
        self._seen_ids: set = set()

    # ── public interface ────────────────────────────────────────────────────
    async def scrape(
        self, city: Optional[str] = None, **kwargs
    ) -> List[EventCreate]:
        cities = [self._normalise_city(city)] if city else DISTRICT_CITIES
        all_events: List[EventCreate] = []

        for c in cities:
            try:
                city_events = await self._scrape_city(c)
                all_events.extend(city_events)
                self._log(f"{c}: {len(city_events)} events (total: {len(all_events)})")
            except Exception as e:
                self._log(f"Error scraping {c}: {e}")
            await asyncio.sleep(self.delay)

        self._log(f"Finished: {len(all_events)} events from {len(cities)} cities")
        return all_events

    # ── per-city scraping ───────────────────────────────────────────────────
    async def _scrape_city(self, city: str) -> List[EventCreate]:
        """Fetch listing pages for multiple categories in one city."""
        events: List[EventCreate] = []

        for cat_slug, default_cat in CATEGORY_URLS:
            url = (
                f"https://www.district.in/events/"
                f"{cat_slug}-in-{city}-book-tickets"
            )
            try:
                page_events = await self._fetch_listing_page(url, city, default_cat)
                events.extend(page_events)
            except Exception as e:
                logger.debug(f"Category {cat_slug} in {city} failed: {e}")
            # Small delay between category fetches within a city
            await asyncio.sleep(0.5)

        return events

    async def _fetch_listing_page(
        self, url: str, city_hint: str, default_category: str
    ) -> List[EventCreate]:
        """Fetch a District.in listing page and parse JSON-LD events."""
        html = await self._fetch_html(url)
        if not html:
            return []

        events: List[EventCreate] = []

        # 1. Parse JSON-LD ItemList blocks
        for match in _JSONLD_RE.finditer(html):
            try:
                blob = json.loads(match.group(1))
            except json.JSONDecodeError:
                continue

            if blob.get("@type") == "ItemList":
                for item in blob.get("itemListElement", []):
                    ev_data = item.get("item", {})
                    if ev_data.get("@type") == "Event":
                        parsed = self._parse_jsonld_event(
                            ev_data, city_hint, default_category
                        )
                        if parsed:
                            events.append(parsed)

        # 2. Fallback: extract event links from HTML and build minimal events
        if not events:
            events = self._extract_events_from_html(html, city_hint, default_category)

        return events

    # ── JSON-LD parsing ─────────────────────────────────────────────────────
    def _parse_jsonld_event(
        self, data: Dict, city_hint: str, default_category: str
    ) -> Optional[EventCreate]:
        """Parse a schema.org Event from JSON-LD into EventCreate."""
        try:
            # Source ID from URL slug
            event_url = data.get("url", "")
            source_id = self._url_to_source_id(event_url)
            if not source_id or source_id in self._seen_ids:
                return None
            self._seen_ids.add(source_id)

            title = unescape(data.get("name", "")).strip()
            if not title:
                return None

            # Dates
            start_time = self._parse_iso_date(data.get("startDate"))
            if not start_time:
                return None
            end_time = self._parse_iso_date(data.get("endDate"))

            # Location
            location = data.get("location", {})
            venue_name = location.get("name", "") if isinstance(location, dict) else ""
            address_data = location.get("address", {}) if isinstance(location, dict) else {}
            geo = location.get("geo", {}) if isinstance(location, dict) else {}

            lat = geo.get("latitude") if isinstance(geo, dict) else None
            lng = geo.get("longitude") if isinstance(geo, dict) else None

            # Address string
            if isinstance(address_data, dict):
                address = address_data.get("addressLocality", city_hint.title())
                city_name = address_data.get("addressLocality", city_hint.title())
            elif isinstance(address_data, str):
                address = address_data
                city_name = city_hint.title()
            else:
                address = city_hint.title()
                city_name = city_hint.title()

            # Fallback coordinates
            if not lat or not lng:
                fallback = CITY_COORDS.get(city_hint, (19.076, 72.878))
                lat, lng = fallback

            # Display name for city
            city_display = CITY_DISPLAY.get(city_hint, city_name)

            # Image
            images = data.get("image", [])
            if isinstance(images, list):
                image_url = images[0] if images else ""
            elif isinstance(images, str):
                image_url = images
            else:
                image_url = ""

            # Price from offers
            offers = data.get("offers", {})
            price_min, price_max, is_free = self._parse_offers(offers)

            # Description (available on detail pages, not listing)
            description = unescape(data.get("description", "")).strip() or None
            if description:
                # Clean up HTML entities and tags
                description = re.sub(r"<[^>]+>", " ", description)
                description = re.sub(r"\s+", " ", description).strip()
                if len(description) > 2000:
                    description = description[:1997] + "..."

            # Category — infer from title, URL and default
            category = self._infer_category(title, event_url, default_category)

            return EventCreate(
                source="district",
                source_id=source_id,
                title=title,
                description=description,
                start_time=start_time,
                end_time=end_time,
                location_name=venue_name,
                address=address,
                city=city_display,
                lat=float(lat),
                lng=float(lng),
                category=EventCategory(category),
                is_free=is_free,
                price_min=price_min,
                price_max=price_max,
                country="IN",
                url=event_url,
                image_url=image_url,
            )
        except Exception as e:
            logger.warning(f"Failed to parse District.in JSON-LD event: {e}")
            return None

    # ── HTML fallback ───────────────────────────────────────────────────────
    def _extract_events_from_html(
        self, html: str, city_hint: str, default_category: str
    ) -> List[EventCreate]:
        """Extract event data from raw HTML links when JSON-LD is absent."""
        events: List[EventCreate] = []

        # Find event links: /events/{slug}-buy-tickets
        link_re = re.compile(
            r'href="(https://www\.district\.in/events/[^"]+?-buy-tickets)"'
        )
        seen_urls = set()
        for m in link_re.finditer(html):
            url = m.group(1)
            if url in seen_urls:
                continue
            seen_urls.add(url)

            source_id = self._url_to_source_id(url)
            if not source_id or source_id in self._seen_ids:
                continue
            self._seen_ids.add(source_id)

            # Derive title from slug
            slug = url.rsplit("/", 1)[-1].replace("-buy-tickets", "")
            # Remove trailing date patterns like -oct31-2026
            slug = re.sub(r"-[a-z]{3}\d{1,2}-\d{4}$", "", slug)
            title = slug.replace("-", " ").title()

            fallback = CITY_COORDS.get(city_hint, (19.076, 72.878))
            city_display = CITY_DISPLAY.get(city_hint, city_hint.title())

            events.append(EventCreate(
                source="district",
                source_id=source_id,
                title=title,
                description=None,
                start_time=datetime.now(IST),  # placeholder
                location_name=None,
                address=city_display,
                city=city_display,
                lat=fallback[0],
                lng=fallback[1],
                category=EventCategory(self._infer_category(title, url, default_category)),
                is_free=False,
                country="IN",
                url=url,
                image_url="",
            ))

        return events

    # ── helpers ─────────────────────────────────────────────────────────────
    async def _fetch_html(self, url: str) -> Optional[str]:
        """Fetch a URL and return raw HTML."""
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-IN,en;q=0.9",
        }
        try:
            req = urllib.request.Request(url, headers=headers)
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(
                None,
                lambda: urllib.request.urlopen(req, context=self.ctx, timeout=25),
            )
            return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return None

    def _parse_iso_date(self, value) -> Optional[datetime]:
        """Parse an ISO-8601 date string."""
        if not value or not isinstance(value, str):
            return None
        for fmt in [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
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

    def _parse_offers(self, offers) -> Tuple[Optional[float], Optional[float], bool]:
        """Extract price range from JSON-LD offers."""
        if not offers or not isinstance(offers, dict):
            return None, None, False

        # AggregateOffer has lowPrice/highPrice
        low = offers.get("lowPrice") or offers.get("price")
        high = offers.get("highPrice")

        price_min = self._to_float(low)
        price_max = self._to_float(high)

        is_free = (price_min is not None and price_min == 0) or (
            offers.get("availability", "").endswith("/Free")
        )

        return price_min, price_max, is_free

    @staticmethod
    def _to_float(v) -> Optional[float]:
        if v is None:
            return None
        try:
            return float(v)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _url_to_source_id(url: str) -> Optional[str]:
        """Derive a stable source ID from the event URL slug."""
        if not url:
            return None
        # https://www.district.in/events/some-event-slug-buy-tickets
        slug = url.rstrip("/").rsplit("/", 1)[-1]
        slug = slug.replace("-buy-tickets", "")
        if not slug or slug == "events":
            return None
        return f"dist-{slug}"

    @staticmethod
    def _normalise_city(city: str) -> str:
        """Normalise city name to District.in slug."""
        mapping = {
            "bengaluru": "bangalore",
            "gurugram": "gurgaon",
            "new delhi": "delhi",
            "thiruvananthapuram": "thiruvananthapuram",
        }
        lower = city.lower().strip()
        return mapping.get(lower, lower)

    @staticmethod
    def _infer_category(title: str, url: str, default: str) -> str:
        """Infer EventCategory from title and URL keywords."""
        combined = f"{title} {url}".lower()
        for keyword, cat in CATEGORY_KEYWORDS.items():
            if keyword in combined:
                return cat
        return default
