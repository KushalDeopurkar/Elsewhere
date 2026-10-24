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
            # Resolved outside the try: reading it inside the handler would let
            # a scraper missing the attribute abort the whole run instead of
            # just its own turn.
            name = getattr(scraper, "name", type(scraper).__name__)
            try:
                logger.info(f"Running scraper: {name}")
                events = await scraper.scrape(city=city)
                count = self.event_service.upsert_events(events)
                results[name] = count
            except Exception as e:
                logger.error(f"Scraper {name} failed: {e}")
                results[name] = 0

        return results
