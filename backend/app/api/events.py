from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_supabase, get_supabase_service
from app.models.event import (
    EventCategory,
    EventDetailResponse,
    EventResponse,
    EventSearchParams,
)
from app.models.schemas import ApiResponse, Meta
from app.scrapers.eventbrite import EventbriteScraper
from app.services.event_service import EventService
from app.services.ingestion_service import IngestionService

router = APIRouter()


def get_event_service() -> EventService:
    return EventService(get_supabase())


def get_ingestion_service() -> IngestionService:
    # Ingestion writes events, so use the service-role client to bypass RLS
    event_service = EventService(get_supabase_service())
    scrapers = [EventbriteScraper()]
    # WebScraper instances can be added here with ScraperConfig for each target site
    return IngestionService(event_service=event_service, scrapers=scrapers)


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
        data=[EventResponse.model_validate(r) for r in results],
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
    # Map events return a subset of fields; EventResponse handles missing fields via defaults
    return ApiResponse(data=[EventResponse.model_validate(r) for r in results])


@router.get("/{event_id}")
def get_event(
    event_id: str,
    service: EventService = Depends(get_event_service),
):
    event = service.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return ApiResponse(data=EventDetailResponse.model_validate(event))


@router.post("/ingest")
async def ingest_events(
    city: str | None = Query(default=None),
    service: IngestionService = Depends(get_ingestion_service),
):
    """Trigger a scrape-and-upsert run for all registered scrapers."""
    results = await service.run_all(city=city)
    total = sum(results.values())
    return ApiResponse(
        data={"scrapers": results, "total_upserted": total},
    )
