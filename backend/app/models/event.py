from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class EventCategory(str, Enum):
    MUSIC = "music"
    TECH = "tech"
    SPORTS = "sports"
    ARTS = "arts"
    FOOD = "food"
    BUSINESS = "business"
    HEALTH = "health"
    EDUCATION = "education"
    COMMUNITY = "community"
    NIGHTLIFE = "nightlife"
    FAMILY = "family"
    OUTDOOR = "outdoor"
    OTHER = "other"


class EventCreate(BaseModel):
    """Used by scrapers to insert new events."""
    title: str
    description: str | None = None
    category: EventCategory = EventCategory.OTHER
    start_time: datetime
    end_time: datetime | None = None
    location_name: str | None = None
    address: str | None = None
    city: str | None = None
    country: str = "US"
    lat: float | None = None
    lng: float | None = None
    image_url: str | None = None
    url: str | None = None
    price_min: float | None = None
    price_max: float | None = None
    is_free: bool = False
    source: str
    source_id: str
    raw_data: dict | None = None

    def to_db_row(self) -> dict:
        """Convert to dict for Supabase insert, building PostGIS point."""
        data = self.model_dump(exclude={"lat", "lng"})
        if self.lat is not None and self.lng is not None:
            data["coords"] = f"POINT({self.lng} {self.lat})"
        else:
            data["coords"] = None
        # Convert datetime to ISO string
        data["start_time"] = self.start_time.isoformat()
        if data["end_time"]:
            data["end_time"] = self.end_time.isoformat()
        return data


class EventResponse(BaseModel):
    """Returned by API endpoints."""
    id: UUID
    title: str
    description: str | None = None
    category: EventCategory
    start_time: datetime
    end_time: datetime | None = None
    location_name: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    image_url: str | None = None
    url: str | None = None
    price_min: float | None = None
    price_max: float | None = None
    is_free: bool = False
    source: str
    distance_km: float | None = None
    relevance: float | None = None


class EventSearchParams(BaseModel):
    """Query parameters for event search."""
    q: str | None = None
    category: EventCategory | None = None
    lat: float | None = None
    lng: float | None = None
    radius_km: float = 25.0
    from_time: datetime | None = None
    to_time: datetime | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
