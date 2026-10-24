#!/usr/bin/env python3
"""
Standalone scraper runner — runs all scrapers and upserts results into Supabase.
Designed to be called from GitHub Actions cron, or manually.

Usage:
    python run_scrapers.py                     # run all scrapers, all cities
    python run_scrapers.py --source allevents  # run only AllEvents scraper
    python run_scrapers.py --city mumbai       # only scrape Mumbai
    python run_scrapers.py --dry-run           # scrape but don't upsert

Environment variables required:
    SUPABASE_URL
    SUPABASE_KEY
    SUPABASE_SERVICE_ROLE_KEY  (recommended for bypassing RLS)
"""

import argparse
import asyncio
import logging
import os
import sys
import time

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.scrapers.allevents import AllEventsScraper
from app.scrapers.insider import InsiderScraper
from app.scrapers.meetup import MeetupScraper

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("scraper_runner")


async def run_scraper(scraper, city=None):
    """Run a single scraper and return events."""
    logger.info(f"Starting {scraper.name} scraper...")
    start = time.time()
    events = await scraper.scrape(city=city)
    elapsed = time.time() - start
    logger.info(f"{scraper.name}: scraped {len(events)} events in {elapsed:.1f}s")
    return events


async def main():
    parser = argparse.ArgumentParser(description="Run event scrapers")
    parser.add_argument("--source", choices=["allevents", "insider", "meetup", "all"],
                        default="all", help="Which scraper to run")
    parser.add_argument("--city", default=None, help="Scrape only this city")
    parser.add_argument("--dry-run", action="store_true",
                        help="Scrape but don't upsert to database")
    args = parser.parse_args()

    # Build scrapers based on selection
    scrapers = []
    if args.source in ("all", "allevents"):
        scrapers.append(AllEventsScraper(delay=1.0, categories=["all"]))
    if args.source in ("all", "insider"):
        scrapers.append(InsiderScraper(delay=1.5))
    if args.source in ("all", "meetup"):
        scrapers.append(MeetupScraper(delay=2.0))

    # Run all selected scrapers
    all_events = []
    results = {}
    for scraper in scrapers:
        try:
            events = await run_scraper(scraper, city=args.city)
            all_events.extend(events)
            results[scraper.name] = len(events)
        except Exception as e:
            logger.error(f"Scraper {scraper.name} failed: {e}")
            results[scraper.name] = 0

    logger.info(f"Total scraped: {len(all_events)} events")
    logger.info(f"Per-scraper: {results}")

    if args.dry_run:
        logger.info("DRY RUN — skipping database upsert")
        # Print a sample
        for event in all_events[:5]:
            logger.info(f"  {event.source}: {event.title} @ {event.city} ({event.start_time})")
        return

    # Upsert to Supabase
    if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_KEY"):
        logger.error("SUPABASE_URL and SUPABASE_KEY environment variables required")
        sys.exit(1)

    from app.database import get_supabase_service
    from app.services.event_service import EventService

    event_service = EventService(get_supabase_service())
    upserted = event_service.upsert_events(all_events)
    logger.info(f"Upserted {upserted} events to Supabase")

    # Print summary for GitHub Actions
    print(f"::notice::Scraped {len(all_events)} events, upserted {upserted}")
    for name, count in results.items():
        print(f"::notice::{name}: {count} events")


if __name__ == "__main__":
    asyncio.run(main())
