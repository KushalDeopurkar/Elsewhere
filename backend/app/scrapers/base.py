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
