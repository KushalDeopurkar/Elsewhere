from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.events import router as events_router
from app.database import get_supabase_service
from app.scrapers.eventbrite import EventbriteScraper
from app.services.event_service import EventService
from app.services.ingestion_service import IngestionService

logger = logging.getLogger(__name__)


async def scheduled_ingest() -> None:
    """Background job: run all scrapers and upsert results."""
    try:
        event_service = EventService(get_supabase_service())
        settings = get_settings()
        scrapers = [EventbriteScraper(token=settings.eventbrite_token)]
        ingestion = IngestionService(event_service=event_service, scrapers=scrapers)
        results = await ingestion.run_all()
        total = sum(results.values())
        logger.info(f"Scheduled ingest complete: {total} events ({results})")
    except Exception:
        logger.exception("Scheduled ingest failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        scheduled_ingest,
        "interval",
        minutes=settings.scrape_interval_minutes,
        id="event_ingest",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        f"Scheduler started — ingesting every {settings.scrape_interval_minutes}m"
    )

    # Run an initial ingest on startup (fire-and-forget so the app starts immediately)
    asyncio.create_task(scheduled_ingest())

    yield

    scheduler.shutdown(wait=False)
    logger.info("Scheduler shut down")


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
