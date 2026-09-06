import httpx
from datetime import datetime, timezone

from app.models.event import EventCreate, EventCategory
from app.scrapers.base import BaseScraper

# Eventbrite category_id → our category
CATEGORY_MAP: dict[str, EventCategory] = {
    "101": EventCategory.BUSINESS,
    "102": EventCategory.TECH,
    "103": EventCategory.MUSIC,
    "104": EventCategory.ARTS,
    "105": EventCategory.SPORTS,
    "106": EventCategory.HEALTH,
    "107": EventCategory.EDUCATION,
    "108": EventCategory.FOOD,
    "109": EventCategory.COMMUNITY,
    "110": EventCategory.FAMILY,
    "113": EventCategory.OUTDOOR,
    "114": EventCategory.NIGHTLIFE,
}

BASE_URL = "https://www.eventbriteapi.com/v3"


class EventbriteScraper(BaseScraper):
    name = "eventbrite"

    def __init__(self, token: str):
        self.token = token

    async def scrape(
        self, city: str | None = None, **kwargs
    ) -> list[EventCreate]:
        self._log(f"Scraping events for city={city}")
        events: list[EventCreate] = []

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{BASE_URL}/events/search/",
                    params={
                        "location.address": city or "Mumbai",
                        "expand": "venue",
                        "token": self.token,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as e:
            self._log(f"HTTP error: {e}")
            return []

        for raw in data.get("events", []):
            try:
                events.append(self._parse_event(raw))
            except Exception as e:
                self._log(f"Failed to parse event {raw.get('id')}: {e}")
                continue

        self._log(f"Scraped {len(events)} events")
        return events

    def _parse_event(self, raw: dict) -> EventCreate:
        venue = raw.get("venue") or {}
        address_info = venue.get("address", {})
        logo = raw.get("logo") or {}

        lat_str = address_info.get("latitude")
        lng_str = address_info.get("longitude")

        cat_id = raw.get("category_id", "")
        category = CATEGORY_MAP.get(cat_id, EventCategory.OTHER)

        return EventCreate(
            title=raw["name"]["text"],
            description=(raw.get("description") or {}).get("text"),
            category=category,
            start_time=datetime.fromisoformat(
                raw["start"]["utc"].replace("Z", "+00:00")
            ),
            end_time=datetime.fromisoformat(
                raw["end"]["utc"].replace("Z", "+00:00")
            ) if raw.get("end", {}).get("utc") else None,
            location_name=venue.get("name"),
            address=address_info.get("localized_address_display"),
            city=address_info.get("city"),
            country=address_info.get("country", "US"),
            lat=float(lat_str) if lat_str else None,
            lng=float(lng_str) if lng_str else None,
            image_url=logo.get("url"),
            url=raw.get("url"),
            is_free=raw.get("is_free", False),
            source="eventbrite",
            source_id=str(raw["id"]),
            raw_data=raw,
        )
