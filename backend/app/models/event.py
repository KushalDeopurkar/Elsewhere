from __future__ import annotations
from typing import Optional, Dict

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
    description: Optional[str] = None
    category: EventCategory = EventCategory.OTHER
    start_time: datetime
    end_time: Optional[datetime] = None
    location_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "US"
    lat: Optional[float] = None
    lng: Optional[float] = None
    image_url: Optional[str] = None
    url: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    is_free: bool = False
    source: str
    source_id: str
    raw_data: Optional[Dict] = None

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
    """Returned by list/search API endpoints. Excludes internal columns."""
    id: UUID
    title: str
    description: Optional[str] = None
    category: EventCategory
    start_time: datetime
    end_time: Optional[datetime] = None
    location_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    image_url: Optional[str] = None
    url: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    is_free: bool = False
    source: Optional[str] = None
    distance_km: Optional[float] = None
    relevance: Optional[float] = None


class EventDetailResponse(EventResponse):
    """Returned by get-by-id endpoint. Adds timestamps."""
    source_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class EventSearchParams(BaseModel):
    """Query parameters for event search."""
    q: Optional[str] = None
    category: Optional[EventCategory] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: float = 25.0
    from_time: Optional[datetime] = None
    to_time: Optional[datetime] = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
