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
