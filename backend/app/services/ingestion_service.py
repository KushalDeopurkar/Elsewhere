from __future__ import annotations
from typing import List, Dict, Optional

import logging

from app.scrapers.base import BaseScraper
from app.services.event_service import EventService

logger = logging.getLogger(__name__)


class IngestionService:
    """Orchestrates running all scrapers and upserting results."""

    def __init__(
        self, event_service: EventService, scrapers: List[BaseScraper]
    ):
        self.event_service = event_service
        self.scrapers = scrapers

    async def run_all(self, city: Optional[str] = None) -> Dict[str, int]:
        """Run every registered scraper, upsert results.

        Returns:
            Dict mapping scraper name -> count of upserted events.
        """
        results: Dict[str, int] = {}

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
