import json

import pytest

from app.models.event import EventCategory
from app.scrapers.allevents import AllEventsScraper
from app.scrapers.eventbrite import EventbriteScraper
from app.scrapers.meetup import MeetupScraper
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

    # Delivery format comes from Eventbrite's own online_event flag; an
    # absent flag must read as in-person, not as unknown or online.
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


# ─── AllEvents.in ──────────────────────────────────────────────────────────

ALLEVENTS_HTML = """
<html><head>
<script type="application/ld+json">
{
  "@type": "Event",
  "name": "Sunburn Arena Mumbai",
  "url": "https://allevents.in/mumbai/sunburn-arena/80001",
  "startDate": "2026-11-15T19:00:00+05:30",
  "endDate": "2026-11-15T23:00:00+05:30",
  "location": {
    "name": "NSCI Dome",
    "address": {
      "streetAddress": "Lal Bahadur Shastri Marg",
      "addressLocality": "Mumbai"
    },
    "geo": {"latitude": "19.0330", "longitude": "72.8296"}
  },
  "offers": {"lowPrice": "999", "highPrice": "4999"},
  "image": "https://img.allevents.in/sunburn.jpg"
}
</script>
<script type="application/ld+json">
{
  "@type": "Event",
  "name": "Event With No Coordinates",
  "url": "https://allevents.in/mumbai/no-coords/80002",
  "startDate": "2026-11-16T10:00:00+05:30",
  "location": {"name": "Somewhere", "address": {"addressLocality": "Mumbai"}}
}
</script>
<script type="application/ld+json">
{"@type": "WebSite", "name": "Not an event"}
</script>
</head><body></body></html>
"""


@pytest.mark.asyncio
async def test_allevents_scraper_parses_events(httpx_mock):
    httpx_mock.add_response(
        url="https://allevents.in/mumbai/all",
        text=ALLEVENTS_HTML,
    )

    scraper = AllEventsScraper(delay=0)
    events = await scraper.scrape(city="mumbai")

    # The no-coordinates event and the non-Event block are both skipped.
    assert len(events) == 1

    e = events[0]
    assert e.title == "Sunburn Arena Mumbai"
    assert e.source == "allevents"
    assert e.source_id == "ae-80001"
    assert e.lat == pytest.approx(19.0330)
    assert e.lng == pytest.approx(72.8296)
    assert e.location_name == "NSCI Dome"
    assert e.address == "Lal Bahadur Shastri Marg, Mumbai"
    assert e.country == "IN"
    assert e.is_free is False
    assert e.price_min == pytest.approx(999.0)
    assert e.price_max == pytest.approx(4999.0)
    assert e.start_time.isoformat() == "2026-11-15T19:00:00+05:30"
    assert e.end_time.isoformat() == "2026-11-15T23:00:00+05:30"


@pytest.mark.asyncio
async def test_allevents_scraper_normalizes_city_name(httpx_mock):
    httpx_mock.add_response(
        url="https://allevents.in/navi-mumbai/all",
        text=ALLEVENTS_HTML,
    )

    scraper = AllEventsScraper(delay=0)
    events = await scraper.scrape(city="Navi Mumbai")

    assert len(events) == 1


@pytest.mark.asyncio
async def test_allevents_scraper_dedups_repeated_urls(httpx_mock):
    doubled = ALLEVENTS_HTML + ALLEVENTS_HTML
    httpx_mock.add_response(url="https://allevents.in/pune/all", text=doubled)

    scraper = AllEventsScraper(delay=0)
    events = await scraper.scrape(city="pune")

    assert len(events) == 1


@pytest.mark.asyncio
async def test_allevents_scraper_handles_page_without_markup(httpx_mock):
    httpx_mock.add_response(
        url="https://allevents.in/mumbai/all",
        text="<html><body>No structured data here</body></html>",
    )

    scraper = AllEventsScraper(delay=0)
    assert await scraper.scrape(city="mumbai") == []


@pytest.mark.asyncio
async def test_allevents_scraper_handles_http_error(httpx_mock):
    httpx_mock.add_response(url="https://allevents.in/mumbai/all", status_code=503)

    scraper = AllEventsScraper(delay=0)
    assert await scraper.scrape(city="mumbai") == []


# ─── Meetup.com ────────────────────────────────────────────────────────────

MEETUP_APOLLO_STATE = {
    "Event:ev-1": {
        "id": "ev-1",
        "title": "Mumbai Python Meetup",
        "dateTime": "2026-11-20T18:30:00+05:30",
        "eventUrl": "https://www.meetup.com/mumbai-python/events/ev-1/",
        "description": "Monthly Python talks",
        "eventType": "PHYSICAL",
        "venue": {"__ref": "Venue:v-1"},
        "featuredEventPhoto": {"__ref": "Photo:p-1"},
        "group": {"__ref": "Group:g-1"},
    },
    "Event:ev-2": {
        "id": "ev-2",
        "title": "Remote Only Session",
        "dateTime": "2026-11-21T18:30:00+05:30",
        "eventUrl": "https://www.meetup.com/mumbai-python/events/ev-2/",
        "eventType": "ONLINE",
    },
    "Venue:v-1": {
        "name": "WeWork BKC",
        "lat": 19.0650,
        "lng": 72.8690,
        "address": "Bandra Kurla Complex",
        "city": "Mumbai",
    },
    "Photo:p-1": {"highResUrl": "https://img.meetup.com/p1.jpg"},
    "Group:g-1": {"name": "Mumbai Python User Group"},
}

MEETUP_URL = (
    "https://www.meetup.com/find/?location=in--mumbai&source=EVENTS"
    "&categoryId=546&distance=fiftyMiles"
)


def _meetup_html(apollo_state) -> str:
    payload = {"props": {"pageProps": {"__APOLLO_STATE__": apollo_state}}}
    return (
        '<html><body><script id="__NEXT_DATA__" type="application/json">'
        + json.dumps(payload)
        + "</script></body></html>"
    )


@pytest.mark.asyncio
async def test_meetup_scraper_parses_events(httpx_mock):
    httpx_mock.add_response(url=MEETUP_URL, text=_meetup_html(MEETUP_APOLLO_STATE))

    scraper = MeetupScraper(delay=0)
    events = await scraper.scrape(city="mumbai", category_ids=[546])

    # The ONLINE event is skipped — this is a local discovery app.
    assert len(events) == 1

    e = events[0]
    assert e.title == "Mumbai Python Meetup"
    assert e.source == "meetup"
    assert e.source_id == "mu-ev-1"
    assert e.category == EventCategory.TECH
    assert e.location_name == "WeWork BKC"
    assert e.lat == pytest.approx(19.0650)
    assert e.lng == pytest.approx(72.8690)
    assert e.address == "Bandra Kurla Complex, Mumbai"
    assert e.image_url == "https://img.meetup.com/p1.jpg"
    assert e.country == "IN"
    assert e.is_free is True


@pytest.mark.asyncio
async def test_meetup_scraper_falls_back_to_city_coords(httpx_mock):
    """An event whose venue carries no coordinates inherits the city's."""
    state = {
        "Event:ev-3": {
            "id": "ev-3",
            "title": "Venue Without Coords",
            "dateTime": "2026-11-22T18:30:00+05:30",
            "eventUrl": "https://www.meetup.com/g/events/ev-3/",
            "eventType": "PHYSICAL",
            "group": {"__ref": "Group:g-1"},
        },
        "Group:g-1": {"name": "Mumbai Python User Group"},
    }
    httpx_mock.add_response(url=MEETUP_URL, text=_meetup_html(state))

    scraper = MeetupScraper(delay=0)
    events = await scraper.scrape(city="mumbai", category_ids=[546])

    assert len(events) == 1
    # Falls back to the configured coordinates for in--mumbai.
    assert events[0].lat == pytest.approx(19.076)
    assert events[0].lng == pytest.approx(72.878)
    # And to the group name when the venue has none.
    assert events[0].location_name == "Mumbai Python User Group"


@pytest.mark.asyncio
async def test_meetup_scraper_skips_unknown_city(httpx_mock):
    """An unconfigured city makes no HTTP request at all."""
    scraper = MeetupScraper(delay=0)
    assert await scraper.scrape(city="Atlantis") == []


@pytest.mark.asyncio
async def test_meetup_scraper_handles_page_without_next_data(httpx_mock):
    httpx_mock.add_response(url=MEETUP_URL, text="<html><body>nothing</body></html>")

    scraper = MeetupScraper(delay=0)
    assert await scraper.scrape(city="mumbai", category_ids=[546]) == []


@pytest.mark.asyncio
async def test_meetup_scraper_handles_http_error(httpx_mock):
    httpx_mock.add_response(url=MEETUP_URL, status_code=429)

    scraper = MeetupScraper(delay=0)
    assert await scraper.scrape(city="mumbai", category_ids=[546]) == []
