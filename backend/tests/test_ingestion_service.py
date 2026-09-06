import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.ingestion_service import IngestionService


def make_scraper(name: str, events=None, raise_exc: Exception | None = None):
    scraper = MagicMock()
    scraper.name = name
    if raise_exc is not None:
        scraper.scrape = AsyncMock(side_effect=raise_exc)
    else:
        scraper.scrape = AsyncMock(return_value=events or [])
    return scraper


@pytest.fixture
def event_service():
    service = MagicMock()
    service.upsert_events.return_value = 2
    return service


@pytest.mark.asyncio
async def test_run_all_runs_each_scraper_and_upserts(event_service):
    scraper_a = make_scraper("scraper-a", events=["event1", "event2"])
    scraper_b = make_scraper("scraper-b", events=["event3"])

    service = IngestionService(event_service, [scraper_a, scraper_b])
    results = await service.run_all(city="Mumbai")

    assert results == {"scraper-a": 2, "scraper-b": 2}
    scraper_a.scrape.assert_awaited_once_with(city="Mumbai")
    scraper_b.scrape.assert_awaited_once_with(city="Mumbai")
    assert event_service.upsert_events.call_count == 2


@pytest.mark.asyncio
async def test_run_all_continues_after_scraper_failure(event_service):
    failing_scraper = make_scraper("failing", raise_exc=RuntimeError("boom"))
    ok_scraper = make_scraper("ok", events=["event1"])

    service = IngestionService(event_service, [failing_scraper, ok_scraper])
    results = await service.run_all()

    assert results["failing"] == 0
    assert results["ok"] == 2
    ok_scraper.scrape.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_all_no_scrapers_returns_empty_dict(event_service):
    service = IngestionService(event_service, [])
    results = await service.run_all()

    assert results == {}
    event_service.upsert_events.assert_not_called()
