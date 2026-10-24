import json

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.scrapers.allevents import AllEventsScraper
from app.scrapers.meetup import MeetupScraper
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


# ─── Real scrapers through the pipeline ────────────────────────────────────
# The tests above drive MagicMock scrapers, so they pass regardless of whether
# a scraper actually satisfies the BaseScraper contract. AllEventsScraper and
# MeetupScraper once did not — they were synchronous and exposed
# scrape_all_cities() rather than an awaitable scrape(city=...), so run_all()
# raised AttributeError and silently recorded zero events. This drives the real
# classes end to end so that regression cannot return unnoticed.

ALLEVENTS_PAGE = """
<html><script type="application/ld+json">
{
  "@type": "Event",
  "name": "Kala Ghoda Arts Festival",
  "url": "https://allevents.in/mumbai/kala-ghoda/90001",
  "startDate": "2026-12-05T11:00:00+05:30",
  "location": {
    "name": "Kala Ghoda",
    "address": {"streetAddress": "Rampart Row", "addressLocality": "Mumbai"},
    "geo": {"latitude": "18.9280", "longitude": "72.8320"}
  }
}
</script></html>
"""

MEETUP_PAGE = (
    '<html><script id="__NEXT_DATA__" type="application/json">'
    + json.dumps({
        "props": {"pageProps": {"__APOLLO_STATE__": {
            "Event:ev-9": {
                "id": "ev-9",
                "title": "Bombay Rust Meetup",
                "dateTime": "2026-12-06T18:00:00+05:30",
                "eventUrl": "https://www.meetup.com/rust/events/ev-9/",
                "eventType": "PHYSICAL",
                "venue": {"__ref": "Venue:v-9"},
            },
            "Venue:v-9": {
                "name": "91springboard",
                "lat": 19.1100,
                "lng": 72.8700,
                "address": "Andheri East",
                "city": "Mumbai",
            },
        }}}
    })
    + "</script></html>"
)

# MeetupScraper._scrape_city sweeps these category ids when none are given.
DEFAULT_MEETUP_CATEGORY_IDS = [546, 292, 638, 618, 466, 622]


@pytest.mark.asyncio
async def test_run_all_drives_the_real_scrapers(event_service, httpx_mock):
    httpx_mock.add_response(
        url="https://allevents.in/mumbai/all", text=ALLEVENTS_PAGE
    )
    for i, cat_id in enumerate(DEFAULT_MEETUP_CATEGORY_IDS):
        httpx_mock.add_response(
            url=(
                "https://www.meetup.com/find/?location=in--mumbai&source=EVENTS"
                f"&categoryId={cat_id}&distance=fiftyMiles"
            ),
            # Only the first category page carries an event; the rest are empty.
            text=MEETUP_PAGE if i == 0 else "<html></html>",
        )

    scrapers = [AllEventsScraper(delay=0), MeetupScraper(delay=0)]
    service = IngestionService(event_service, scrapers)
    results = await service.run_all(city="mumbai")

    # Both scrapers ran to completion — no swallowed AttributeError.
    assert set(results) == {"allevents", "meetup"}

    scraped = [
        call.args[0] for call in event_service.upsert_events.call_args_list
    ]
    assert [e.title for e in scraped[0]] == ["Kala Ghoda Arts Festival"]
    assert [e.title for e in scraped[1]] == ["Bombay Rust Meetup"]
    assert scraped[0][0].source == "allevents"
    assert scraped[1][0].source == "meetup"


@pytest.mark.asyncio
async def test_run_all_isolates_a_scraper_missing_its_name(event_service):
    """A malformed scraper must not abort the other scrapers' runs.

    The handler used to read scraper.name itself, so a scraper without one
    raised from inside the except block and took the whole run down with it.
    """
    class Nameless:
        async def scrape(self, city=None, **kwargs):
            raise RuntimeError("boom")

    ok_scraper = make_scraper("ok", events=["event1"])
    service = IngestionService(event_service, [Nameless(), ok_scraper])

    results = await service.run_all()

    assert results == {"Nameless": 0, "ok": 2}
    ok_scraper.scrape.assert_awaited_once()
