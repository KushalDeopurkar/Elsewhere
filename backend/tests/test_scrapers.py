import pytest
from app.scrapers.eventbrite import EventbriteScraper
from app.scrapers.web_scraper import WebScraper, ScraperConfig


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
            "online_event": True,
            "category_id": "101",
        },
    ],
    "pagination": {"has_more_items": False},
}


@pytest.mark.asyncio
async def test_eventbrite_scraper_parses_events(httpx_mock):
    httpx_mock.add_response(
        url="https://www.eventbriteapi.com/v3/events/search/?location.address=Mumbai&expand=venue",
        match_headers={"Authorization": "Bearer test-token"},
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

    # Delivery format comes from Eventbrite's own online_event flag;
    # an absent flag must read as in-person, not as unknown/online.
    assert e1.is_online is False
    assert e2.is_online is True


@pytest.mark.asyncio
async def test_eventbrite_scraper_handles_empty_response(httpx_mock):
    httpx_mock.add_response(
        url="https://www.eventbriteapi.com/v3/events/search/?location.address=Mumbai&expand=venue",
        match_headers={"Authorization": "Bearer test-token"},
        json={"events": [], "pagination": {"has_more_items": False}},
    )

    scraper = EventbriteScraper(token="test-token")
    events = await scraper.scrape(city="Mumbai")

    assert events == []


@pytest.mark.asyncio
async def test_eventbrite_scraper_handles_api_error(httpx_mock):
    httpx_mock.add_response(
        url="https://www.eventbriteapi.com/v3/events/search/?location.address=Mumbai&expand=venue",
        match_headers={"Authorization": "Bearer test-token"},
        status_code=401,
    )

    scraper = EventbriteScraper(token="test-token")
    events = await scraper.scrape(city="Mumbai")

    assert events == []


MOCK_HTML = """
<html>
<body>
<div class="event-list">
  <div class="event-card">
    <h2 class="event-title">Pune Comedy Night</h2>
    <p class="event-desc">Stand-up comedy showcase</p>
    <span class="event-date">2026-10-05T19:00:00</span>
    <span class="event-venue">Blue Frog, Pune</span>
    <a class="event-link" href="/events/comedy-night-pune">Details</a>
  </div>
  <div class="event-card">
    <h2 class="event-title">Yoga in the Park</h2>
    <p class="event-desc">Morning yoga session</p>
    <span class="event-date">2026-10-06T06:30:00</span>
    <span class="event-venue">Shivaji Park, Mumbai</span>
    <a class="event-link" href="/events/yoga-park">Details</a>
  </div>
</div>
</body>
</html>
"""


@pytest.mark.asyncio
async def test_web_scraper_extracts_events(httpx_mock):
    httpx_mock.add_response(
        url="https://localevents.example.com/mumbai",
        text=MOCK_HTML,
    )

    config = ScraperConfig(
        name="local-events",
        url="https://localevents.example.com/mumbai",
        container_selector=".event-card",
        title_selector=".event-title",
        description_selector=".event-desc",
        date_selector=".event-date",
        venue_selector=".event-venue",
        link_selector=".event-link",
        link_attr="href",
        base_url="https://localevents.example.com",
        default_category="community",
    )

    scraper = WebScraper(config)
    events = await scraper.scrape()

    assert len(events) == 2
    assert events[0].title == "Pune Comedy Night"
    assert events[0].source == "local-events"
    assert events[0].url == "https://localevents.example.com/events/comedy-night-pune"
    assert events[1].title == "Yoga in the Park"


@pytest.mark.asyncio
async def test_web_scraper_handles_missing_fields(httpx_mock):
    html = """
    <html><body>
    <div class="event-card">
      <h2 class="event-title">Bare Event</h2>
      <span class="event-date">2026-11-01T10:00:00</span>
    </div>
    </body></html>
    """
    httpx_mock.add_response(url="https://example.com/events", text=html)

    config = ScraperConfig(
        name="bare",
        url="https://example.com/events",
        container_selector=".event-card",
        title_selector=".event-title",
        date_selector=".event-date",
    )
    scraper = WebScraper(config)
    events = await scraper.scrape()

    assert len(events) == 1
    assert events[0].title == "Bare Event"
    assert events[0].description is None


@pytest.mark.asyncio
async def test_web_scraper_handles_http_error(httpx_mock):
    httpx_mock.add_response(
        url="https://example.com/down",
        status_code=500,
    )

    config = ScraperConfig(
        name="down-site",
        url="https://example.com/down",
        container_selector=".event-card",
        title_selector=".event-title",
        date_selector=".event-date",
    )
    scraper = WebScraper(config)
    events = await scraper.scrape()

    assert events == []


@pytest.mark.asyncio
async def test_web_scraper_skips_container_missing_required_fields(httpx_mock):
    html = """
    <html><body>
    <div class="event-card">
      <h2 class="event-title">No Date Event</h2>
    </div>
    <div class="event-card">
      <h2 class="event-title">Good Event</h2>
      <span class="event-date">2026-12-01T09:00:00</span>
    </div>
    </body></html>
    """
    httpx_mock.add_response(url="https://example.com/mixed", text=html)

    config = ScraperConfig(
        name="mixed",
        url="https://example.com/mixed",
        container_selector=".event-card",
        title_selector=".event-title",
        date_selector=".event-date",
    )
    scraper = WebScraper(config)
    events = await scraper.scrape()

    assert len(events) == 1
    assert events[0].title == "Good Event"
