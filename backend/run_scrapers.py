#!/usr/bin/env python3
"""
Standalone scraper runner — runs all scrapers and upserts results into Supabase.
Designed to be called from GitHub Actions cron, or manually.

Usage:
    python run_scrapers.py                     # run all scrapers, all cities
    python run_scrapers.py --source allevents  # run only AllEvents scraper
    python run_scrapers.py --city mumbai       # only scrape Mumbai
    python run_scrapers.py --dry-run           # scrape but don't upsert
    python run_scrapers.py --enrich-only       # fetch descriptions + ticket tiers
    python run_scrapers.py --images-only       # pictures for events whose source sends none

Environment variables required:
    SUPABASE_URL
    SUPABASE_KEY
    SUPABASE_SERVICE_ROLE_KEY  (recommended for bypassing RLS)
"""

import argparse
import asyncio
import glob
import logging
import os
import sys
import time

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.scrapers.allevents import AllEventsScraper
from app.scrapers.district import DistrictScraper
from app.scrapers.meetup import MeetupScraper
from app.scrapers.ticketmaster import TicketmasterScraper
from app.scrapers.seatgeek import SeatGeekScraper
from app.scrapers.eventfinda import EventfindaScraper
from app.scrapers.paris_opendata import ParisOpenDataScraper
from app.scrapers.ics_feeds import IcsFeedsScraper
from app.scrapers.football import FootballScraper
from app.models.event import EventCategory, EventCreate
from app.services.categorize import categorize
from app.services.dedupe import dedupe

INDIA_SOURCES = ["allevents", "district", "meetup"]
GLOBAL_SOURCES = ["ticketmaster", "seatgeek", "eventfinda", "paris", "ics", "football"]

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
    parser.add_argument("--source", choices=[*INDIA_SOURCES, "insider", *GLOBAL_SOURCES, "india", "global", "all"],
                        default="all", help="Which scraper to run (india / global run a whole group)")
    parser.add_argument("--city", default=None, help="Scrape only this city")
    parser.add_argument("--dry-run", action="store_true",
                        help="Scrape but don't upsert to database")
    parser.add_argument("--enrich-only", action="store_true",
                        help="Skip scraping; fetch event pages for descriptions and ticket tiers")
    parser.add_argument("--limit", type=int, default=150,
                        help="Max event pages to enrich per run")
    parser.add_argument("--images-only", action="store_true",
                        help="Skip scraping; find pictures on the pages of events that have none")
    parser.add_argument("--recategorize", action="store_true",
                        help="Re-decide the category of upcoming events already saved, then exit")
    parser.add_argument("--out", default=None,
                        help="Write scraped events to this JSON-lines file instead of saving them")
    parser.add_argument("--load", default=None,
                        help="Skip scraping; read every *.jsonl file in this folder, de-duplicate and save")
    parser.add_argument("--budget-min", type=float, default=None,
                        help="Stop a scraper after this many minutes (keeps the run inside its time limit)")
    parser.add_argument("--retry-failed", action="store_true",
                        help="Enrich: also retry events tried before that got no details")
    args = parser.parse_args()

    if args.images_only:
        if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_KEY"):
            logger.error("SUPABASE_URL and SUPABASE_KEY environment variables required")
            sys.exit(1)
        from app.database import get_supabase_service
        from app.enrich.images import find_images

        stats = await find_images(get_supabase_service(), limit=args.limit)
        logger.info(f"Images: {stats}")
        print(f"::notice::Pictures: {stats['found']} found, {stats['none']} pages without one, "
              f"{stats['generic']} site defaults ignored, {stats['failed']} not loaded, of {stats['picked']}")
        for host, outcomes in stats["by_host"].items():
            print(f"::notice::{host}: " + ", ".join(f"{k} x{v}" for k, v in sorted(outcomes.items())))
        return

    if args.recategorize:
        from app.database import get_supabase_service
        from app.services.recategorize import recategorize
        stats = recategorize(get_supabase_service(), dry_run=args.dry_run)
        print(f"::notice::Recategorized {stats['changed']} of {stats['seen']} upcoming events")
        return

    if args.enrich_only:
        if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_KEY"):
            logger.error("SUPABASE_URL and SUPABASE_KEY environment variables required")
            sys.exit(1)
        from app.database import get_supabase_service
        from app.enrich.enricher import enrich

        sources = None if args.source == "all" else [args.source]
        stats = await enrich(get_supabase_service(), limit=args.limit, sources=sources,
                             retry_failed=args.retry_failed)
        logger.info(f"Enrich: {stats}")
        print(f"::notice::Enriched {stats['enriched']} of {stats['picked']} event pages "
              f"({stats['with_tiers']} with ticket tiers, {stats['failed']} failed)")
        for host, outcomes in stats["by_host"].items():
            print(f"::notice::{host}: " + ", ".join(f"{k} x{v}" for k, v in sorted(outcomes.items())))
        return

    # Build scrapers based on selection
    def wanted(name):
        group = INDIA_SOURCES if name in INDIA_SOURCES else GLOBAL_SOURCES
        return args.source in ("all", name) or (args.source == "india" and group is INDIA_SOURCES) or (
            args.source == "global" and group is GLOBAL_SOURCES
        )

    scrapers = []
    if wanted("allevents"):
        scrapers.append(AllEventsScraper(delay=1.0, categories=["all"]))
    if wanted("district"):
        scrapers.append(DistrictScraper(delay=1.5))
    if wanted("meetup"):
        scrapers.append(MeetupScraper(delay=2.0))
    # Global sources skip themselves (with a log line) when their key isn't set.
    if wanted("ticketmaster"):
        scrapers.append(TicketmasterScraper())
    if wanted("seatgeek"):
        scrapers.append(SeatGeekScraper())
    if wanted("eventfinda"):
        scrapers.append(EventfindaScraper())
    if wanted("paris"):
        scrapers.append(ParisOpenDataScraper())
    if wanted("ics"):
        scrapers.append(IcsFeedsScraper())
    if wanted("football"):
        scrapers.append(FootballScraper())

    all_events = []
    results = {}
    if args.load:
        # The save step of a split run: each source scraped in its own job
        # and left a file; de-duplicate across all of them, then save once.
        files = sorted(glob.glob(os.path.join(args.load, "**", "*.jsonl"), recursive=True))
        for path in files:
            with open(path, encoding="utf-8") as fh:
                rows = [EventCreate.model_validate_json(line) for line in fh if line.strip()]
            all_events.extend(rows)
            results[os.path.splitext(os.path.basename(path))[0]] = len(rows)
        logger.info(f"Loaded {len(all_events)} events from {len(files)} files")
        scrapers = []

    # Run the selected scrapers side by side: each one mostly waits on the
    # network, so running them together takes as long as the slowest one.
    async def guarded(scraper):
        try:
            coro = run_scraper(scraper, city=args.city)
            if args.budget_min:
                return scraper.name, await asyncio.wait_for(coro, timeout=args.budget_min * 60)
            return scraper.name, await coro
        except asyncio.TimeoutError:
            logger.error(f"Scraper {scraper.name} ran past {args.budget_min} min; skipped this run")
            print(f"::warning::{scraper.name} ran past its {args.budget_min}-minute budget")
        except Exception as e:
            logger.error(f"Scraper {scraper.name} failed: {e}")
        return scraper.name, []

    for name, events in await asyncio.gather(*(guarded(s) for s in scrapers)):
        all_events.extend(events)
        results[name] = len(events)

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as fh:
            for event in all_events:
                fh.write(event.model_dump_json() + "\n")
        logger.info(f"Wrote {len(all_events)} events to {args.out}")
        print(f"::notice::{', '.join(f'{k}: {v}' for k, v in results.items())} events scraped")
        return

    before = len(all_events)
    # One category per event, decided by the same rules for every source;
    # the scraper's own label only counts as a hint.
    for e in all_events:
        e.category = EventCategory(categorize(e.title, e.description, getattr(e.category, "value", e.category), e.source))

    all_events = dedupe(all_events)
    if before != len(all_events):
        logger.info(f"Dropped {before - len(all_events)} duplicates listed by more than one source")
    logger.info(f"Total scraped: {len(all_events)} events")
    logger.info(f"Per-scraper: {results}")

    if args.dry_run:
        logger.info("DRY RUN — skipping database upsert")
        # Print a sample
        for event in all_events[:5]:
            logger.info(f"  {event.source}: {event.title} [{event.category.value}] @ {event.city} ({event.start_time})")
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
