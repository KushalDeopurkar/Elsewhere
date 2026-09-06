# Event Discovery Engine — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack event discovery platform that aggregates events from APIs and web scraping, normalizes them into a geo-enabled database, and surfaces them through search, filtering, and an interactive map.

**Architecture:** FastAPI backend handles data ingestion via pluggable scrapers (Eventbrite API + generic web scraper), normalizes events into a Supabase PostgreSQL database with PostGIS for geo queries. REST endpoints expose search, filtering, and geo-bounded queries. Next.js frontend provides a search/browse UI with category filters and an interactive Leaflet map for spatial discovery. APScheduler runs periodic ingestion jobs.

**Tech Stack:** Python 3.11+ · FastAPI · httpx · BeautifulSoup4 · APScheduler · Supabase (PostgreSQL + PostGIS) · Next.js 15 (App Router) · Tailwind CSS 4 · Leaflet · TypeScript

## Global Constraints

- Python 3.11+ required
- Node 20+ required
- All secrets via `.env` files, never hardcoded
- UTC timestamps in the backend; frontend converts to user's local timezone
- Supabase project required (free tier works)
- No paid map APIs — Leaflet + OpenStreetMap tiles only
- All scraper HTTP calls use `httpx.AsyncClient` with timeouts and retries
- Every endpoint returns JSON with consistent `{data, error, meta}` envelope

---

## File Structure

```
event-discovery-engine/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app, lifespan, CORS
│   │   ├── config.py                  # Settings via pydantic-settings
│   │   ├── database.py                # Supabase client singleton
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── event.py               # Event Pydantic models
│   │   │   └── schemas.py             # API response envelopes
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── events.py              # Event endpoints
│   │   ├── scrapers/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                # Abstract base scraper
│   │   │   ├── eventbrite.py          # Eventbrite API scraper
│   │   │   └── web_scraper.py         # Generic web scraper
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── event_service.py       # Event CRUD + search logic
│   │       └── ingestion_service.py   # Orchestrates scraper runs
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py                # Shared fixtures
│   │   ├── test_models.py
│   │   ├── test_scrapers.py
│   │   ├── test_event_service.py
│   │   └── test_api.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               # Home — search + browse
│   │   │   ├── map/
│   │   │   │   └── page.tsx           # Map discovery page
│   │   │   └── events/
│   │   │       └── [id]/
│   │   │           └── page.tsx       # Event detail
│   │   ├── components/
│   │   │   ├── EventCard.tsx
│   │   │   ├── EventList.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── CategoryFilter.tsx
│   │   │   ├── EventMap.tsx
│   │   │   └── MapMarker.tsx
│   │   ├── lib/
│   │   │   ├── api.ts                 # API client
│   │   │   └── types.ts              # TypeScript types
│   │   └── hooks/
│   │       └── useEvents.ts           # Data fetching hook
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── next.config.ts
├── supabase/
│   └── migrations/
│       └── 001_create_events.sql      # Schema + PostGIS
├── docker-compose.yml                 # Local dev (optional)
├── .env.example
└── README.md
```

---

### Task 1: Project Scaffolding + Database Schema

**Files:**
- Create: `backend/app/__init__.py`, `backend/app/main.py`, `backend/app/config.py`, `backend/app/database.py`
- Create: `backend/requirements.txt`, `backend/.env.example`
- Create: `supabase/migrations/001_create_events.sql`
- Create: `backend/tests/__init__.py`, `backend/tests/conftest.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `Settings` config class, `get_supabase()` client factory, database schema

- [ ] **Step 1: Create backend directory structure**

```bash
mkdir -p backend/app/models backend/app/api backend/app/scrapers backend/app/services
mkdir -p backend/tests
mkdir -p supabase/migrations
mkdir -p frontend
touch backend/app/__init__.py backend/app/models/__init__.py
touch backend/app/api/__init__.py backend/app/scrapers/__init__.py
touch backend/app/services/__init__.py backend/tests/__init__.py
```

- [ ] **Step 2: Write requirements.txt**

Create `backend/requirements.txt`:

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
httpx==0.28.1
beautifulsoup4==4.12.3
lxml==5.3.0
pydantic==2.10.4
pydantic-settings==2.7.1
supabase==2.11.0
apscheduler==3.10.4
python-dotenv==1.0.1
pytest==8.3.4
pytest-asyncio==0.25.0
pytest-httpx==0.35.0
```

- [ ] **Step 3: Install dependencies**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 4: Write config.py**

Create `backend/app/config.py`:

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    eventbrite_token: str = ""
    scrape_interval_minutes: int = 60
    default_search_radius_km: float = 25.0
    max_events_per_page: int = 50
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: Write database.py**

Create `backend/app/database.py`:

```python
from supabase import create_client, Client
from app.config import get_settings

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        s = get_settings()
        _client = create_client(s.supabase_url, s.supabase_key)
    return _client
```

- [ ] **Step 6: Write the Supabase migration**

Create `supabase/migrations/001_create_events.sql`:

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Event categories enum
CREATE TYPE event_category AS ENUM (
    'music', 'tech', 'sports', 'arts', 'food',
    'business', 'health', 'education', 'community',
    'nightlife', 'family', 'outdoor', 'other'
);

-- Events table
CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category event_category NOT NULL DEFAULT 'other',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location_name TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'US',
    coords GEOGRAPHY(POINT, 4326),
    image_url TEXT,
    url TEXT,
    price_min NUMERIC(10, 2),
    price_max NUMERIC(10, 2),
    is_free BOOLEAN DEFAULT FALSE,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_source_event UNIQUE (source, source_id)
);

-- Indexes
CREATE INDEX idx_events_start_time ON events (start_time);
CREATE INDEX idx_events_category ON events (category);
CREATE INDEX idx_events_city ON events (city);
CREATE INDEX idx_events_coords ON events USING GIST (coords);
CREATE INDEX idx_events_source ON events (source);

-- Full-text search index
ALTER TABLE events ADD COLUMN search_vector TSVECTOR
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(location_name, '')), 'C')
    ) STORED;

CREATE INDEX idx_events_search ON events USING GIN (search_vector);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC: search events by text + geo bounding box
CREATE OR REPLACE FUNCTION search_events(
    query TEXT DEFAULT NULL,
    category_filter event_category DEFAULT NULL,
    lat DOUBLE PRECISION DEFAULT NULL,
    lng DOUBLE PRECISION DEFAULT NULL,
    radius_km DOUBLE PRECISION DEFAULT 25.0,
    from_time TIMESTAMPTZ DEFAULT NOW(),
    to_time TIMESTAMPTZ DEFAULT NULL,
    page_limit INT DEFAULT 50,
    page_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    category event_category,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    location_name TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    image_url TEXT,
    url TEXT,
    price_min NUMERIC,
    price_max NUMERIC,
    is_free BOOLEAN,
    source TEXT,
    distance_km DOUBLE PRECISION,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.title, e.description, e.category,
        e.start_time, e.end_time, e.location_name,
        e.address, e.city, e.country,
        ST_Y(e.coords::geometry) AS lat,
        ST_X(e.coords::geometry) AS lng,
        e.image_url, e.url, e.price_min, e.price_max,
        e.is_free, e.source,
        CASE
            WHEN search_events.lat IS NOT NULL AND e.coords IS NOT NULL
            THEN ST_Distance(
                e.coords,
                ST_SetSRID(ST_MakePoint(search_events.lng, search_events.lat), 4326)::geography
            ) / 1000.0
            ELSE NULL
        END AS distance_km,
        CASE
            WHEN search_events.query IS NOT NULL
            THEN ts_rank(e.search_vector, plainto_tsquery('english', search_events.query))
            ELSE 0
        END AS relevance
    FROM events e
    WHERE
        (search_events.query IS NULL OR e.search_vector @@ plainto_tsquery('english', search_events.query))
        AND (search_events.category_filter IS NULL OR e.category = search_events.category_filter)
        AND e.start_time >= search_events.from_time
        AND (search_events.to_time IS NULL OR e.start_time <= search_events.to_time)
        AND (
            search_events.lat IS NULL
            OR e.coords IS NULL
            OR ST_DWithin(
                e.coords,
                ST_SetSRID(ST_MakePoint(search_events.lng, search_events.lat), 4326)::geography,
                search_events.radius_km * 1000
            )
        )
    ORDER BY
        CASE WHEN search_events.query IS NOT NULL
            THEN ts_rank(e.search_vector, plainto_tsquery('english', search_events.query))
            ELSE 0
        END DESC,
        e.start_time ASC
    LIMIT search_events.page_limit
    OFFSET search_events.page_offset;
END;
$$ LANGUAGE plpgsql;

-- RPC: get events within a map bounding box
CREATE OR REPLACE FUNCTION events_in_bounds(
    south DOUBLE PRECISION,
    west DOUBLE PRECISION,
    north DOUBLE PRECISION,
    east DOUBLE PRECISION,
    from_time TIMESTAMPTZ DEFAULT NOW(),
    category_filter event_category DEFAULT NULL,
    max_results INT DEFAULT 200
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    category event_category,
    start_time TIMESTAMPTZ,
    location_name TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    is_free BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.title, e.category, e.start_time,
        e.location_name,
        ST_Y(e.coords::geometry) AS lat,
        ST_X(e.coords::geometry) AS lng,
        e.is_free
    FROM events e
    WHERE
        e.coords IS NOT NULL
        AND ST_Intersects(
            e.coords::geometry,
            ST_MakeEnvelope(
                events_in_bounds.west, events_in_bounds.south,
                events_in_bounds.east, events_in_bounds.north,
                4326
            )
        )
        AND e.start_time >= events_in_bounds.from_time
        AND (events_in_bounds.category_filter IS NULL OR e.category = events_in_bounds.category_filter)
    ORDER BY e.start_time ASC
    LIMIT events_in_bounds.max_results;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 7: Write Event Pydantic models**

Create `backend/app/models/event.py`:

```python
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
```

- [ ] **Step 8: Write response envelope schemas**

Create `backend/app/models/schemas.py`:

```python
from typing import Any, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class Meta(BaseModel):
    total: int | None = None
    limit: int | None = None
    offset: int | None = None


class ApiResponse(BaseModel, Generic[T]):
    data: T | None = None
    error: str | None = None
    meta: Meta | None = None
```

- [ ] **Step 9: Write FastAPI app entry point**

Create `backend/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.events import router as events_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: could start scheduler here later
    yield
    # Shutdown: cleanup


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Event Discovery Engine",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(events_router, prefix="/api/events", tags=["events"])
    return app


app = create_app()
```

- [ ] **Step 10: Write .env.example**

Create `backend/.env.example`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
EVENTBRITE_TOKEN=your-eventbrite-private-token
SCRAPE_INTERVAL_MINUTES=60
DEFAULT_SEARCH_RADIUS_KM=25
CORS_ORIGINS=["http://localhost:3000"]
```

- [ ] **Step 11: Write test fixtures**

Create `backend/tests/conftest.py`:

```python
import pytest
from datetime import datetime, timezone


@pytest.fixture
def sample_event_data() -> dict:
    return {
        "title": "Mumbai Tech Meetup",
        "description": "Monthly tech meetup in Mumbai",
        "category": "tech",
        "start_time": datetime(2026, 9, 15, 18, 0, tzinfo=timezone.utc),
        "end_time": datetime(2026, 9, 15, 21, 0, tzinfo=timezone.utc),
        "location_name": "WeWork BKC",
        "address": "Bandra Kurla Complex",
        "city": "Mumbai",
        "country": "IN",
        "lat": 19.0596,
        "lng": 72.8656,
        "url": "https://example.com/event/123",
        "is_free": True,
        "source": "test",
        "source_id": "test-123",
    }
```

- [ ] **Step 12: Write model tests**

Create `backend/tests/test_models.py`:

```python
from datetime import datetime, timezone
from app.models.event import EventCreate, EventCategory, EventResponse


def test_event_create_to_db_row(sample_event_data):
    event = EventCreate(**sample_event_data)
    row = event.to_db_row()

    assert row["title"] == "Mumbai Tech Meetup"
    assert row["coords"] == "POINT(72.8656 19.0596)"
    assert row["source"] == "test"
    assert row["source_id"] == "test-123"
    assert "lat" not in row
    assert "lng" not in row


def test_event_create_no_coords(sample_event_data):
    sample_event_data.pop("lat")
    sample_event_data.pop("lng")
    event = EventCreate(**sample_event_data)
    row = event.to_db_row()

    assert row["coords"] is None


def test_event_category_values():
    assert EventCategory.TECH == "tech"
    assert EventCategory.MUSIC == "music"


def test_event_create_defaults():
    event = EventCreate(
        title="Minimal Event",
        start_time=datetime(2026, 10, 1, tzinfo=timezone.utc),
        source="test",
        source_id="min-1",
    )
    assert event.category == EventCategory.OTHER
    assert event.is_free is False
    assert event.country == "US"
```

- [ ] **Step 13: Run tests to verify**

```bash
cd backend
source .venv/bin/activate
pytest tests/test_models.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 14: Run the migration in Supabase**

Go to your Supabase project → SQL Editor → paste and run `supabase/migrations/001_create_events.sql`.

Or via CLI:
```bash
# If using Supabase CLI
supabase db push
```

- [ ] **Step 15: Commit**

```bash
git init
echo ".venv/\n__pycache__/\n.env\n*.pyc\nnode_modules/\n.next/" > .gitignore
git add .
git commit -m "feat: project scaffolding, database schema with PostGIS, event models"
```

---

### Task 2: Eventbrite API Scraper

**Files:**
- Create: `backend/app/scrapers/base.py`
- Create: `backend/app/scrapers/eventbrite.py`
- Test: `backend/tests/test_scrapers.py`

**Interfaces:**
- Consumes: `EventCreate` model from Task 1, `Settings.eventbrite_token`
- Produces: `BaseScraper` abstract class with `async scrape() -> list[EventCreate]`, `EventbriteScraper` concrete implementation

- [ ] **Step 1: Write the base scraper abstract class**

Create `backend/app/scrapers/base.py`:

```python
from abc import ABC, abstractmethod
import logging

from app.models.event import EventCreate

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """Abstract base for all event scrapers."""

    name: str = "base"

    @abstractmethod
    async def scrape(
        self, city: str | None = None, **kwargs
    ) -> list[EventCreate]:
        """Fetch and normalize events from this source.

        Args:
            city: Optional city name to filter events.

        Returns:
            List of normalized EventCreate objects.
        """
        ...

    def _log(self, msg: str) -> None:
        logger.info(f"[{self.name}] {msg}")
```

- [ ] **Step 2: Write failing scraper test**

Create `backend/tests/test_scrapers.py`:

```python
import pytest
from datetime import datetime, timezone
from app.scrapers.eventbrite import EventbriteScraper


MOCK_EVENTBRITE_RESPONSE = {
    "events": [
        {
            "id": "123456",
            "name": {"text": "AI Workshop Mumbai"},
            "description": {"text": "Learn about latest AI trends"},
            "start": {"utc": "2026-09-20T10:00:00Z"},
            "end": {"utc": "2026-09-20T17:00:00Z"},
            "venue": {
                "name": "Tech Hub",
                "address": {
                    "localized_address_display": "Andheri East, Mumbai",
                    "city": "Mumbai",
                    "country": "IN",
                    "latitude": "19.1136",
                    "longitude": "72.8697",
                },
            },
            "logo": {"url": "https://img.example.com/logo.jpg"},
            "url": "https://eventbrite.com/e/123456",
            "is_free": True,
            "category_id": "102",
        },
        {
            "id": "789012",
            "name": {"text": "Startup Networking Night"},
            "description": {"text": "Meet fellow founders"},
            "start": {"utc": "2026-09-25T18:00:00Z"},
            "end": {"utc": "2026-09-25T21:00:00Z"},
            "venue": None,
            "logo": None,
            "url": "https://eventbrite.com/e/789012",
            "is_free": False,
            "category_id": "101",
        },
    ],
    "pagination": {"has_more_items": False},
}


@pytest.mark.asyncio
async def test_eventbrite_scraper_parses_events(httpx_mock):
    httpx_mock.add_response(
        url="https://www.eventbriteapi.com/v3/events/search/?location.address=Mumbai&expand=venue&token=test-token",
        json=MOCK_EVENTBRITE_RESPONSE,
    )

    scraper = EventbriteScraper(token="test-token")
    events = await scraper.scrape(city="Mumbai")

    assert len(events) == 2

    # First event — full venue data
    e1 = events[0]
    assert e1.title == "AI Workshop Mumbai"
    assert e1.source == "eventbrite"
    assert e1.source_id == "123456"
    assert e1.lat == pytest.approx(19.1136)
    assert e1.lng == pytest.approx(72.8697)
    assert e1.city == "Mumbai"
    assert e1.is_free is True

    # Second event — no venue
    e2 = events[1]
    assert e2.title == "Startup Networking Night"
    assert e2.lat is None
    assert e2.lng is None


@pytest.mark.asyncio
async def test_eventbrite_scraper_handles_empty_response(httpx_mock):
    httpx_mock.add_response(
        url="https://www.eventbriteapi.com/v3/events/search/?location.address=Mumbai&expand=venue&token=test-token",
        json={"events": [], "pagination": {"has_more_items": False}},
    )

    scraper = EventbriteScraper(token="test-token")
    events = await scraper.scrape(city="Mumbai")

    assert events == []


@pytest.mark.asyncio
async def test_eventbrite_scraper_handles_api_error(httpx_mock):
    httpx_mock.add_response(
        url="https://www.eventbriteapi.com/v3/events/search/?location.address=Mumbai&expand=venue&token=test-token",
        status_code=401,
    )

    scraper = EventbriteScraper(token="test-token")
    events = await scraper.scrape(city="Mumbai")

    assert events == []
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/test_scrapers.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.scrapers.eventbrite'` or `ImportError`.

- [ ] **Step 4: Implement EventbriteScraper**

Create `backend/app/scrapers/eventbrite.py`:

```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_scrapers.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/scrapers/ backend/tests/test_scrapers.py
git commit -m "feat: add base scraper + Eventbrite API scraper with tests"
```

---

### Task 3: Generic Web Scraper

**Files:**
- Create: `backend/app/scrapers/web_scraper.py`
- Modify: `backend/tests/test_scrapers.py` (add web scraper tests)

**Interfaces:**
- Consumes: `BaseScraper`, `EventCreate`
- Produces: `WebScraper` class that extracts events from arbitrary HTML pages via CSS selectors config

- [ ] **Step 1: Write failing web scraper test**

Append to `backend/tests/test_scrapers.py`:

```python
from app.scrapers.web_scraper import WebScraper, ScraperConfig

MOCK_HTML = """
<html>
<body>
<div class="event-list">
  <div class="event-card">
    <h2 class="event-title">Pune Comedy Night</h2>
    <p class="event-desc">Stand-up comedy showcase</p>
    <span class="event-date">2026-10-05T19:00:00</span>
    <span class="event-venue">Blue Frog, Pune</span>
    <a class="event-link" href="/events/comedy-night-pune">Details</a>
  </div>
  <div class="event-card">
    <h2 class="event-title">Yoga in the Park</h2>
    <p class="event-desc">Morning yoga session</p>
    <span class="event-date">2026-10-06T06:30:00</span>
    <span class="event-venue">Shivaji Park, Mumbai</span>
    <a class="event-link" href="/events/yoga-park">Details</a>
  </div>
</div>
</body>
</html>
"""


@pytest.mark.asyncio
async def test_web_scraper_extracts_events(httpx_mock):
    httpx_mock.add_response(
        url="https://localevents.example.com/mumbai",
        text=MOCK_HTML,
    )

    config = ScraperConfig(
        name="local-events",
        url="https://localevents.example.com/mumbai",
        container_selector=".event-card",
        title_selector=".event-title",
        description_selector=".event-desc",
        date_selector=".event-date",
        venue_selector=".event-venue",
        link_selector=".event-link",
        link_attr="href",
        base_url="https://localevents.example.com",
        default_category="community",
    )

    scraper = WebScraper(config)
    events = await scraper.scrape()

    assert len(events) == 2
    assert events[0].title == "Pune Comedy Night"
    assert events[0].source == "local-events"
    assert events[0].url == "https://localevents.example.com/events/comedy-night-pune"
    assert events[1].title == "Yoga in the Park"


@pytest.mark.asyncio
async def test_web_scraper_handles_missing_fields(httpx_mock):
    html = """
    <html><body>
    <div class="event-card">
      <h2 class="event-title">Bare Event</h2>
      <span class="event-date">2026-11-01T10:00:00</span>
    </div>
    </body></html>
    """
    httpx_mock.add_response(url="https://example.com/events", text=html)

    config = ScraperConfig(
        name="bare",
        url="https://example.com/events",
        container_selector=".event-card",
        title_selector=".event-title",
        date_selector=".event-date",
    )
    scraper = WebScraper(config)
    events = await scraper.scrape()

    assert len(events) == 1
    assert events[0].title == "Bare Event"
    assert events[0].description is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_scrapers.py::test_web_scraper_extracts_events -v
```

Expected: FAIL — `ImportError`.

- [ ] **Step 3: Implement WebScraper**

Create `backend/app/scrapers/web_scraper.py`:

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import md5

import httpx
from bs4 import BeautifulSoup

from app.models.event import EventCreate, EventCategory
from app.scrapers.base import BaseScraper


@dataclass
class ScraperConfig:
    """CSS-selector-driven config for a generic web scraper."""
    name: str
    url: str
    container_selector: str
    title_selector: str
    date_selector: str
    description_selector: str | None = None
    venue_selector: str | None = None
    link_selector: str | None = None
    link_attr: str = "href"
    image_selector: str | None = None
    image_attr: str = "src"
    base_url: str = ""
    default_category: str = "other"
    default_city: str | None = None


class WebScraper(BaseScraper):
    """Scrapes events from any page using CSS selectors."""

    def __init__(self, config: ScraperConfig):
        self.config = config
        self.name = config.name

    async def scrape(self, city: str | None = None, **kwargs) -> list[EventCreate]:
        self._log(f"Scraping {self.config.url}")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(self.config.url)
                resp.raise_for_status()
                html = resp.text
        except httpx.HTTPError as e:
            self._log(f"HTTP error: {e}")
            return []

        return self._parse_html(html)

    def _parse_html(self, html: str) -> list[EventCreate]:
        soup = BeautifulSoup(html, "lxml")
        containers = soup.select(self.config.container_selector)
        events: list[EventCreate] = []

        for container in containers:
            try:
                events.append(self._parse_container(container))
            except Exception as e:
                self._log(f"Failed to parse container: {e}")
                continue

        self._log(f"Extracted {len(events)} events")
        return events

    def _parse_container(self, el) -> EventCreate:
        cfg = self.config

        title = el.select_one(cfg.title_selector).get_text(strip=True)
        date_str = el.select_one(cfg.date_selector).get_text(strip=True)

        description = None
        if cfg.description_selector:
            desc_el = el.select_one(cfg.description_selector)
            if desc_el:
                description = desc_el.get_text(strip=True)

        venue = None
        if cfg.venue_selector:
            venue_el = el.select_one(cfg.venue_selector)
            if venue_el:
                venue = venue_el.get_text(strip=True)

        url = None
        if cfg.link_selector:
            link_el = el.select_one(cfg.link_selector)
            if link_el:
                href = link_el.get(cfg.link_attr, "")
                url = href if href.startswith("http") else f"{cfg.base_url}{href}"

        image_url = None
        if cfg.image_selector:
            img_el = el.select_one(cfg.image_selector)
            if img_el:
                src = img_el.get(cfg.image_attr, "")
                image_url = src if src.startswith("http") else f"{cfg.base_url}{src}"

        # Parse date — try ISO format first
        try:
            start_time = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
        except ValueError:
            start_time = datetime.now(timezone.utc)

        source_id = md5(f"{title}-{date_str}".encode()).hexdigest()

        category = EventCategory(cfg.default_category)

        return EventCreate(
            title=title,
            description=description,
            category=category,
            start_time=start_time,
            location_name=venue,
            city=cfg.default_city,
            url=url,
            image_url=image_url,
            is_free=False,
            source=cfg.name,
            source_id=source_id,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_scrapers.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scrapers/web_scraper.py backend/tests/test_scrapers.py
git commit -m "feat: add generic CSS-selector web scraper with tests"
```

---

### Task 4: Event Service + Ingestion Pipeline

**Files:**
- Create: `backend/app/services/event_service.py`
- Create: `backend/app/services/ingestion_service.py`
- Test: `backend/tests/test_event_service.py`

**Interfaces:**
- Consumes: `get_supabase()`, `EventCreate`, `EventSearchParams`, `BaseScraper`
- Produces: `EventService.upsert_events(events: list[EventCreate]) -> int`, `EventService.search(params: EventSearchParams) -> list[dict]`, `EventService.get_by_id(id: str) -> dict | None`, `EventService.get_in_bounds(south, west, north, east, ...) -> list[dict]`, `IngestionService.run_all() -> dict[str, int]`

- [ ] **Step 1: Write failing event service test**

Create `backend/tests/test_event_service.py`:

```python
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

from app.models.event import EventCreate, EventSearchParams
from app.services.event_service import EventService


@pytest.fixture
def mock_supabase():
    client = MagicMock()
    # Mock the table().upsert().execute() chain
    mock_execute = MagicMock()
    mock_execute.data = [{"id": "uuid-1"}]
    client.table.return_value.upsert.return_value.execute.return_value = mock_execute
    return client


@pytest.fixture
def service(mock_supabase):
    return EventService(mock_supabase)


def test_upsert_events_calls_supabase(service, mock_supabase, sample_event_data):
    events = [EventCreate(**sample_event_data)]
    count = service.upsert_events(events)

    assert count == 1
    mock_supabase.table.assert_called_with("events")
    call_args = mock_supabase.table().upsert.call_args
    rows = call_args[0][0]
    assert len(rows) == 1
    assert rows[0]["title"] == "Mumbai Tech Meetup"


def test_upsert_events_empty_list(service):
    count = service.upsert_events([])
    assert count == 0


def test_search_calls_rpc(service, mock_supabase):
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = [
        {"id": "uuid-1", "title": "Test Event", "distance_km": 5.2}
    ]
    mock_supabase.rpc.return_value = mock_rpc

    params = EventSearchParams(q="tech", lat=19.07, lng=72.87)
    results = service.search(params)

    assert len(results) == 1
    assert results[0]["title"] == "Test Event"
    mock_supabase.rpc.assert_called_once_with(
        "search_events",
        {
            "query": "tech",
            "category_filter": None,
            "lat": 19.07,
            "lng": 72.87,
            "radius_km": 25.0,
            "from_time": params.from_time.isoformat() if params.from_time else None,
            "to_time": None,
            "page_limit": 50,
            "page_offset": 0,
        },
    )


def test_get_in_bounds(service, mock_supabase):
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = [
        {"id": "uuid-1", "title": "Nearby Event", "lat": 19.08, "lng": 72.88}
    ]
    mock_supabase.rpc.return_value = mock_rpc

    results = service.get_in_bounds(
        south=19.0, west=72.8, north=19.2, east=73.0
    )

    assert len(results) == 1
    mock_supabase.rpc.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_event_service.py -v
```

Expected: FAIL — `ImportError`.

- [ ] **Step 3: Implement EventService**

Create `backend/app/services/event_service.py`:

```python
import logging
from datetime import datetime, timezone

from supabase import Client

from app.models.event import EventCreate, EventSearchParams

logger = logging.getLogger(__name__)


class EventService:
    def __init__(self, client: Client):
        self.client = client

    def upsert_events(self, events: list[EventCreate]) -> int:
        """Insert or update events. Returns count of upserted rows."""
        if not events:
            return 0

        rows = [e.to_db_row() for e in events]

        result = (
            self.client.table("events")
            .upsert(rows, on_conflict="source,source_id")
            .execute()
        )

        count = len(result.data) if result.data else 0
        logger.info(f"Upserted {count} events")
        return count

    def search(self, params: EventSearchParams) -> list[dict]:
        """Full-text + geo search via the search_events RPC."""
        rpc_params = {
            "query": params.q,
            "category_filter": params.category.value if params.category else None,
            "lat": params.lat,
            "lng": params.lng,
            "radius_km": params.radius_km,
            "from_time": params.from_time.isoformat() if params.from_time else None,
            "to_time": params.to_time.isoformat() if params.to_time else None,
            "page_limit": params.limit,
            "page_offset": params.offset,
        }

        result = self.client.rpc("search_events", rpc_params).execute()
        return result.data or []

    def get_by_id(self, event_id: str) -> dict | None:
        """Get single event by UUID."""
        result = (
            self.client.table("events")
            .select("*, ST_Y(coords::geometry) as lat, ST_X(coords::geometry) as lng")
            .eq("id", event_id)
            .single()
            .execute()
        )
        return result.data

    def get_in_bounds(
        self,
        south: float,
        west: float,
        north: float,
        east: float,
        from_time: datetime | None = None,
        category: str | None = None,
        max_results: int = 200,
    ) -> list[dict]:
        """Get events within a map bounding box via events_in_bounds RPC."""
        result = self.client.rpc(
            "events_in_bounds",
            {
                "south": south,
                "west": west,
                "north": north,
                "east": east,
                "from_time": (from_time or datetime.now(timezone.utc)).isoformat(),
                "category_filter": category,
                "max_results": max_results,
            },
        ).execute()
        return result.data or []
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_event_service.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Implement IngestionService**

Create `backend/app/services/ingestion_service.py`:

```python
import logging
from app.scrapers.base import BaseScraper
from app.services.event_service import EventService

logger = logging.getLogger(__name__)


class IngestionService:
    """Orchestrates running all scrapers and upserting results."""

    def __init__(
        self, event_service: EventService, scrapers: list[BaseScraper]
    ):
        self.event_service = event_service
        self.scrapers = scrapers

    async def run_all(self, city: str | None = None) -> dict[str, int]:
        """Run every registered scraper, upsert results.

        Returns:
            Dict mapping scraper name → count of upserted events.
        """
        results: dict[str, int] = {}

        for scraper in self.scrapers:
            try:
                logger.info(f"Running scraper: {scraper.name}")
                events = await scraper.scrape(city=city)
                count = self.event_service.upsert_events(events)
                results[scraper.name] = count
            except Exception as e:
                logger.error(f"Scraper {scraper.name} failed: {e}")
                results[scraper.name] = 0

        return results
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ backend/tests/test_event_service.py
git commit -m "feat: add event service (CRUD + search) and ingestion pipeline"
```

---

### Task 5: REST API Endpoints

**Files:**
- Create: `backend/app/api/events.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `EventService`, `EventSearchParams`, `EventResponse`, `ApiResponse`
- Produces: `GET /api/events/search`, `GET /api/events/{id}`, `GET /api/events/map`, `POST /api/events/ingest` (trigger manual ingestion)

- [ ] **Step 1: Write failing API test**

Create `backend/tests/test_api.py`:

```python
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def mock_event_service():
    with patch("app.api.events.get_event_service") as mock:
        service = MagicMock()
        mock.return_value = service
        yield service


@pytest.fixture
def client():
    return TestClient(app)


def test_search_events(client, mock_event_service):
    mock_event_service.search.return_value = [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Tech Meetup",
            "description": "A meetup",
            "category": "tech",
            "start_time": "2026-09-15T18:00:00+00:00",
            "end_time": None,
            "location_name": "WeWork",
            "address": "BKC",
            "city": "Mumbai",
            "country": "IN",
            "lat": 19.06,
            "lng": 72.87,
            "image_url": None,
            "url": "https://example.com",
            "price_min": None,
            "price_max": None,
            "is_free": True,
            "source": "eventbrite",
            "distance_km": 2.5,
            "relevance": 0.8,
        }
    ]

    resp = client.get("/api/events/search?q=tech&lat=19.07&lng=72.87")
    assert resp.status_code == 200

    body = resp.json()
    assert body["error"] is None
    assert len(body["data"]) == 1
    assert body["data"][0]["title"] == "Tech Meetup"


def test_search_events_no_results(client, mock_event_service):
    mock_event_service.search.return_value = []

    resp = client.get("/api/events/search?q=nonexistent")
    assert resp.status_code == 200
    assert resp.json()["data"] == []


def test_get_event_by_id(client, mock_event_service):
    mock_event_service.get_by_id.return_value = {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Tech Meetup",
        "description": "A meetup",
        "category": "tech",
        "start_time": "2026-09-15T18:00:00+00:00",
        "end_time": None,
        "location_name": "WeWork",
        "address": "BKC",
        "city": "Mumbai",
        "country": "IN",
        "lat": 19.06,
        "lng": 72.87,
        "image_url": None,
        "url": "https://example.com",
        "price_min": None,
        "price_max": None,
        "is_free": True,
        "source": "eventbrite",
    }

    resp = client.get("/api/events/550e8400-e29b-41d4-a716-446655440000")
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == "Tech Meetup"


def test_get_event_not_found(client, mock_event_service):
    mock_event_service.get_by_id.return_value = None

    resp = client.get("/api/events/550e8400-e29b-41d4-a716-446655440000")
    assert resp.status_code == 404


def test_map_events(client, mock_event_service):
    mock_event_service.get_in_bounds.return_value = [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Nearby Event",
            "category": "music",
            "start_time": "2026-09-20T19:00:00+00:00",
            "location_name": "Venue",
            "lat": 19.08,
            "lng": 72.88,
            "is_free": False,
        }
    ]

    resp = client.get("/api/events/map?south=19.0&west=72.8&north=19.2&east=73.0")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_api.py -v
```

Expected: FAIL — `ImportError: cannot import name 'get_event_service'`.

- [ ] **Step 3: Implement the events API router**

Create `backend/app/api/events.py`:

```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_supabase
from app.models.event import EventCategory, EventSearchParams
from app.models.schemas import ApiResponse, Meta
from app.services.event_service import EventService

router = APIRouter()


def get_event_service() -> EventService:
    return EventService(get_supabase())


@router.get("/search")
def search_events(
    q: str | None = None,
    category: EventCategory | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 25.0,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: EventService = Depends(get_event_service),
):
    params = EventSearchParams(
        q=q,
        category=category,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        from_time=from_time or datetime.now(timezone.utc),
        to_time=to_time,
        limit=limit,
        offset=offset,
    )
    results = service.search(params)
    return ApiResponse(
        data=results,
        meta=Meta(limit=limit, offset=offset),
    )


@router.get("/map")
def map_events(
    south: float = Query(...),
    west: float = Query(...),
    north: float = Query(...),
    east: float = Query(...),
    from_time: datetime | None = None,
    category: EventCategory | None = None,
    max_results: int = Query(default=200, ge=1, le=500),
    service: EventService = Depends(get_event_service),
):
    results = service.get_in_bounds(
        south=south,
        west=west,
        north=north,
        east=east,
        from_time=from_time,
        category=category.value if category else None,
        max_results=max_results,
    )
    return ApiResponse(data=results)


@router.get("/{event_id}")
def get_event(
    event_id: str,
    service: EventService = Depends(get_event_service),
):
    event = service.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return ApiResponse(data=event)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_api.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Verify the app starts**

```bash
cd backend
SUPABASE_URL=https://placeholder.supabase.co SUPABASE_KEY=placeholder \
uvicorn app.main:app --port 8000 &
sleep 2
curl http://localhost:8000/docs
kill %1
```

Expected: FastAPI docs page loads (HTML response). The server starts without import errors.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/events.py backend/tests/test_api.py
git commit -m "feat: add REST API endpoints — search, map bounds, event detail"
```

---

### Task 6: Frontend — Layout, Search & Browse

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.ts`, `frontend/tailwind.config.ts`
- Create: `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useEvents.ts`
- Create: `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`
- Create: `frontend/src/components/SearchBar.tsx`, `frontend/src/components/CategoryFilter.tsx`, `frontend/src/components/EventCard.tsx`, `frontend/src/components/EventList.tsx`
- Create: `frontend/src/app/events/[id]/page.tsx`

**Interfaces:**
- Consumes: Backend `GET /api/events/search`, `GET /api/events/{id}`
- Produces: Working search/browse UI at `http://localhost:3000`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

When prompted, accept defaults.

- [ ] **Step 2: Write TypeScript types**

Create `frontend/src/lib/types.ts`:

```typescript
export interface Event {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  url: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  source: string;
  distance_km: number | null;
  relevance: number | null;
}

export type EventCategory =
  | "music"
  | "tech"
  | "sports"
  | "arts"
  | "food"
  | "business"
  | "health"
  | "education"
  | "community"
  | "nightlife"
  | "family"
  | "outdoor"
  | "other";

export const CATEGORIES: { value: EventCategory; label: string; emoji: string }[] = [
  { value: "music", label: "Music", emoji: "🎵" },
  { value: "tech", label: "Tech", emoji: "💻" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "arts", label: "Arts", emoji: "🎨" },
  { value: "food", label: "Food", emoji: "🍕" },
  { value: "business", label: "Business", emoji: "💼" },
  { value: "health", label: "Health", emoji: "🏥" },
  { value: "education", label: "Education", emoji: "📚" },
  { value: "community", label: "Community", emoji: "🏘️" },
  { value: "nightlife", label: "Nightlife", emoji: "🌙" },
  { value: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { value: "outdoor", label: "Outdoor", emoji: "🌲" },
  { value: "other", label: "Other", emoji: "📌" },
];

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  meta: { total?: number; limit?: number; offset?: number } | null;
}

export interface SearchParams {
  q?: string;
  category?: EventCategory;
  lat?: number;
  lng?: number;
  radius_km?: number;
  limit?: number;
  offset?: number;
}
```

- [ ] **Step 3: Write API client**

Create `frontend/src/lib/api.ts`:

```typescript
import { ApiResponse, Event, SearchParams } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function searchEvents(params: SearchParams): Promise<Event[]> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.category) searchParams.set("category", params.category);
  if (params.lat) searchParams.set("lat", String(params.lat));
  if (params.lng) searchParams.set("lng", String(params.lng));
  if (params.radius_km) searchParams.set("radius_km", String(params.radius_km));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  const res = await fetch(`${API_BASE}/events/search?${searchParams}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);

  const json: ApiResponse<Event[]> = await res.json();
  return json.data || [];
}

export async function getEvent(id: string): Promise<Event | null> {
  const res = await fetch(`${API_BASE}/events/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

  const json: ApiResponse<Event> = await res.json();
  return json.data;
}

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export async function getMapEvents(bounds: MapBounds, category?: string): Promise<Event[]> {
  const params = new URLSearchParams({
    south: String(bounds.south),
    west: String(bounds.west),
    north: String(bounds.north),
    east: String(bounds.east),
  });
  if (category) params.set("category", category);

  const res = await fetch(`${API_BASE}/events/map?${params}`);
  if (!res.ok) throw new Error(`Map fetch failed: ${res.status}`);

  const json: ApiResponse<Event[]> = await res.json();
  return json.data || [];
}
```

- [ ] **Step 4: Write useEvents hook**

Create `frontend/src/hooks/useEvents.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { Event, SearchParams } from "@/lib/types";
import { searchEvents } from "@/lib/api";

export function useEvents(initialParams?: SearchParams) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<SearchParams>(initialParams || {});

  const fetchEvents = useCallback(async (searchParams: SearchParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchEvents(searchParams);
      setEvents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(params);
  }, [params, fetchEvents]);

  const search = useCallback((newParams: Partial<SearchParams>) => {
    setParams((prev) => ({ ...prev, ...newParams, offset: 0 }));
  }, []);

  const loadMore = useCallback(() => {
    setParams((prev) => ({
      ...prev,
      offset: (prev.offset || 0) + (prev.limit || 50),
    }));
  }, []);

  return { events, loading, error, search, loadMore, params };
}
```

- [ ] **Step 5: Write SearchBar component**

Create `frontend/src/components/SearchBar.tsx`:

```tsx
"use client";

import { useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
}

export default function SearchBar({ onSearch, initialQuery = "" }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events, venues, or keywords..."
          className="w-full px-5 py-3 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg"
        />
        <button
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: Write CategoryFilter component**

Create `frontend/src/components/CategoryFilter.tsx`:

```tsx
"use client";

import { CATEGORIES, EventCategory } from "@/lib/types";

interface CategoryFilterProps {
  selected: EventCategory | null;
  onSelect: (category: EventCategory | null) => void;
}

export default function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          selected === null
            ? "bg-blue-500 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
      >
        All
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onSelect(selected === cat.value ? null : cat.value)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selected === cat.value
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          {cat.emoji} {cat.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Write EventCard component**

Create `frontend/src/components/EventCard.tsx`:

```tsx
import Link from "next/link";
import { Event, CATEGORIES } from "@/lib/types";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EventCard({ event }: { event: Event }) {
  const cat = CATEGORIES.find((c) => c.value === event.category);

  return (
    <Link href={`/events/${event.id}`}>
      <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
        {event.image_url && (
          <div className="aspect-[2/1] overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
              {cat?.emoji} {cat?.label || event.category}
            </span>
            {event.is_free && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium">
                Free
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-500 transition-colors line-clamp-2">
            {event.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {formatDate(event.start_time)}
          </p>
          {event.location_name && (
            <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{event.location_name}</span>
            </p>
          )}
          {event.distance_km != null && (
            <p className="text-xs text-gray-400 mt-1">
              {event.distance_km.toFixed(1)} km away
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 8: Write EventList component**

Create `frontend/src/components/EventList.tsx`:

```tsx
import { Event } from "@/lib/types";
import EventCard from "./EventCard";

interface EventListProps {
  events: Event[];
  loading: boolean;
  error: string | null;
}

export default function EventList({ events, loading, error }: EventListProps) {
  if (loading && events.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse"
          >
            <div className="aspect-[2/1] bg-gray-200 dark:bg-gray-700" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-lg">No events found</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Try a different search or category</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Write the root layout**

Replace `frontend/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Event Discovery Engine",
  description: "Discover events happening around you",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900 min-h-screen`}>
        <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold text-gray-900 dark:text-white">
              EventEngine
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Browse
              </Link>
              <Link
                href="/map"
                className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Map
              </Link>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 10: Write the home page (search + browse)**

Replace `frontend/src/app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import CategoryFilter from "@/components/CategoryFilter";
import EventList from "@/components/EventList";
import { useEvents } from "@/hooks/useEvents";
import { EventCategory } from "@/lib/types";

export default function Home() {
  const { events, loading, error, search } = useEvents({ limit: 30 });
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | null>(null);

  const handleSearch = (query: string) => {
    search({ q: query || undefined });
  };

  const handleCategorySelect = (category: EventCategory | null) => {
    setSelectedCategory(category);
    search({ category: category || undefined });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Discover Events
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Find what's happening around you
        </p>
        <div className="flex justify-center mb-6">
          <SearchBar onSearch={handleSearch} />
        </div>
        <CategoryFilter selected={selectedCategory} onSelect={handleCategorySelect} />
      </div>

      <EventList events={events} loading={loading} error={error} />
    </div>
  );
}
```

- [ ] **Step 11: Write the event detail page**

Create `frontend/src/app/events/[id]/page.tsx`:

```tsx
import { getEvent } from "@/lib/api";
import { CATEGORIES } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) notFound();

  const cat = CATEGORIES.find((c) => c.value === event.category);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
      >
        &larr; Back to events
      </Link>

      {event.image_url && (
        <div className="aspect-[2/1] rounded-xl overflow-hidden mb-6">
          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
          {cat?.emoji} {cat?.label}
        </span>
        {event.is_free && (
          <span className="text-sm px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium">
            Free
          </span>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{event.title}</h1>

      <div className="space-y-3 mb-6 text-gray-600 dark:text-gray-300">
        <p className="flex items-center gap-2">
          <span className="font-medium">When:</span> {formatDateTime(event.start_time)}
          {event.end_time && ` — ${formatDateTime(event.end_time)}`}
        </p>
        {event.location_name && (
          <p className="flex items-center gap-2">
            <span className="font-medium">Where:</span> {event.location_name}
            {event.address && `, ${event.address}`}
          </p>
        )}
        {(event.price_min != null || event.price_max != null) && (
          <p className="flex items-center gap-2">
            <span className="font-medium">Price:</span>
            {event.is_free
              ? "Free"
              : `₹${event.price_min || 0} - ₹${event.price_max || "?"}`}
          </p>
        )}
      </div>

      {event.description && (
        <div className="prose dark:prose-invert max-w-none mb-8">
          <p className="whitespace-pre-line">{event.description}</p>
        </div>
      )}

      {event.url && (
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
        >
          View on {event.source}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 12: Add environment config**

Create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

- [ ] **Step 13: Run the frontend**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000` — verify the layout, search bar, and category filters render. (No data yet until backend + DB are connected.)

- [ ] **Step 14: Commit**

```bash
git add frontend/
git commit -m "feat: add Next.js frontend — search, browse, event detail pages"
```

---

### Task 7: Frontend — Map Discovery

**Files:**
- Create: `frontend/src/components/EventMap.tsx`
- Create: `frontend/src/app/map/page.tsx`

**Interfaces:**
- Consumes: `getMapEvents(bounds, category)` from `api.ts`, `Event` type
- Produces: `/map` page with interactive Leaflet map showing event markers

- [ ] **Step 1: Install Leaflet**

```bash
cd frontend
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

- [ ] **Step 2: Write EventMap component**

Create `frontend/src/components/EventMap.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Event, CATEGORIES, EventCategory } from "@/lib/types";
import { getMapEvents, MapBounds } from "@/lib/api";
import Link from "next/link";

// Fix Leaflet default icon issue in Next.js
const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MapEventHandler({ onBoundsChange }: { onBoundsChange: (bounds: MapBounds) => void }) {
  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      const b = map.getBounds();
      onBoundsChange({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    },
  });
  return null;
}

interface EventMapProps {
  center?: [number, number];
  zoom?: number;
  category?: EventCategory | null;
}

export default function EventMap({
  center = [19.076, 72.8777],  // Mumbai default
  zoom = 12,
  category = null,
}: EventMapProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async (bounds: MapBounds) => {
    setLoading(true);
    try {
      const data = await getMapEvents(bounds, category || undefined);
      setEvents(data);
    } catch (err) {
      console.error("Failed to fetch map events:", err);
    } finally {
      setLoading(false);
    }
  }, [category]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full z-0"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventHandler onBoundsChange={fetchEvents} />

        {events.map((event) =>
          event.lat != null && event.lng != null ? (
            <Marker key={event.id} position={[event.lat, event.lng]}>
              <Popup>
                <div className="min-w-[200px]">
                  <p className="text-xs text-blue-600 font-medium mb-1">
                    {CATEGORIES.find((c) => c.value === event.category)?.emoji}{" "}
                    {CATEGORIES.find((c) => c.value === event.category)?.label}
                  </p>
                  <p className="font-semibold text-sm mb-1">{event.title}</p>
                  <p className="text-xs text-gray-500 mb-1">{formatDate(event.start_time)}</p>
                  {event.location_name && (
                    <p className="text-xs text-gray-600">{event.location_name}</p>
                  )}
                  <Link
                    href={`/events/${event.id}`}
                    className="text-xs text-blue-500 hover:underline mt-2 block"
                  >
                    View details &rarr;
                  </Link>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>

      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg text-sm text-gray-600 dark:text-gray-300">
          Loading events...
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write the map page**

Create `frontend/src/app/map/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import CategoryFilter from "@/components/CategoryFilter";
import { EventCategory } from "@/lib/types";

// Dynamic import to avoid SSR issues with Leaflet
const EventMap = dynamic(() => import("@/components/EventMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
      <p className="text-gray-500">Loading map...</p>
    </div>
  ),
});

export default function MapPage() {
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | null>(null);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />
      </div>
      <div className="flex-1">
        <EventMap category={selectedCategory} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add Leaflet CSS import**

Add to `frontend/src/app/globals.css` (at the top, before Tailwind directives):

```css
@import "leaflet/dist/leaflet.css";
```

- [ ] **Step 5: Verify the map page loads**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/map` — verify the map renders with OpenStreetMap tiles, category filter bar shows above the map.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/EventMap.tsx frontend/src/app/map/
git commit -m "feat: add interactive map discovery page with Leaflet + event markers"
```

---

## Follow-Up Plans

This MVP plan covers the core engine: data ingestion, search/browse, and map discovery. Two follow-up plans should be written next:

**Plan 2: Intelligence Layer**
- AI-powered event categorization (auto-tag scraped events using LLM)
- Event embeddings via pgvector for semantic search
- User preference modeling + personalized feed endpoint
- "Similar events" recommendations

**Plan 3: Alerts & Notifications**
- User alert criteria model (category, location, keywords, frequency)
- Matching engine that runs after each ingestion cycle
- Email notifications via Resend or similar
- In-app notification feed
