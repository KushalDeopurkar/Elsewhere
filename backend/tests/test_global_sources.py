from datetime import datetime, timedelta, timezone

import pytest

from app.models.event import EventCategory, EventCreate
from app.scrapers import eventfinda, paris_opendata, seatgeek, ticketmaster
from app.scrapers.ics_feeds import parse_feed
from app.scrapers.world import cities_for, geohash
from app.services.dedupe import dedupe, norm_title

NYC = cities_for("ticketmaster", "New York")[0]
AKL = cities_for("eventfinda", "Auckland")[0]
NOW = datetime(2026, 11, 19, 12, 0, tzinfo=timezone.utc)

TM_EVENT = {
    "id": "G5v0Z9abc",
    "name": "Phoebe Bridgers",
    "url": "https://www.ticketmaster.com/event/G5v0Z9abc",
    "images": [
        {"ratio": "3_2", "url": "https://img/a.jpg", "width": 640},
        {"ratio": "16_9", "url": "https://img/b.jpg", "width": 1024},
        {"ratio": "16_9", "url": "https://img/c.jpg", "width": 2048},
    ],
    "dates": {"start": {"dateTime": "2026-12-05T01:00:00Z", "localDate": "2026-12-04"}, "timezone": "America/New_York", "status": {"code": "onsale"}},
    "classifications": [{"segment": {"name": "Music"}, "genre": {"name": "Rock"}}],
    "priceRanges": [{"min": 45.0, "max": 120.0, "currency": "USD"}],
    "_embedded": {"venues": [{"name": "Madison Square Garden", "city": {"name": "New York"}, "country": {"countryCode": "US"},
                              "address": {"line1": "4 Pennsylvania Plaza"}, "location": {"latitude": "40.7505", "longitude": "-73.9934"}}]},
}


def test_geohash_known_value():
    assert geohash(57.64911, 10.40744, 11) == "u4pruydqqvj"


def test_ticketmaster_normalize():
    e = ticketmaster.normalize(TM_EVENT, NYC)
    assert e is not None
    assert e.category == EventCategory.MUSIC
    assert e.start_time == datetime(2026, 12, 5, 1, 0, tzinfo=timezone.utc)
    assert (e.lat, e.lng) == (40.7505, -73.9934)
    assert e.image_url == "https://img/b.jpg"
    assert (e.price_min, e.price_max, e.is_free) == (45.0, 120.0, False)
    assert e.country == "US" and e.address == "4 Pennsylvania Plaza, New York"
    assert e.raw_data["timezone"] == "America/New_York"


def test_ticketmaster_date_only_and_cancelled():
    ev = {**TM_EVENT, "dates": {"start": {"localDate": "2026-12-04", "timeTBA": True}, "timezone": "America/New_York"}}
    e = ticketmaster.normalize(ev, NYC)
    # Local midnight in New York (the site reads that as "time on listing").
    assert e.start_time == datetime(2026, 12, 4, 5, 0, tzinfo=timezone.utc)
    gone = {**TM_EVENT, "dates": {**TM_EVENT["dates"], "status": {"code": "cancelled"}}}
    assert ticketmaster.normalize(gone, NYC) is None


@pytest.mark.asyncio
async def test_ticketmaster_scrape_pages_one_city(httpx_mock, monkeypatch):
    monkeypatch.setattr("app.scrapers.world.asyncio.sleep", _no_sleep)
    httpx_mock.add_response(json={"_embedded": {"events": [TM_EVENT]}, "page": {"totalPages": 1}})
    got = await ticketmaster.TicketmasterScraper(api_key="k").scrape(city="New York")
    assert [e.source_id for e in got] == ["G5v0Z9abc"]
    req = httpx_mock.get_requests()[0]
    assert req.url.params["apikey"] == "k" and req.url.params["unit"] == "km"


@pytest.mark.asyncio
async def test_sources_skip_without_keys(monkeypatch):
    for k in ("TICKETMASTER_API_KEY", "SEATGEEK_CLIENT_ID", "EVENTFINDA_USERNAME", "EVENTFINDA_PASSWORD"):
        monkeypatch.delenv(k, raising=False)
    assert await ticketmaster.TicketmasterScraper().scrape() == []
    assert await seatgeek.SeatGeekScraper().scrape() == []
    assert await eventfinda.EventfindaScraper().scrape() == []


async def _no_sleep(*_a, **_k):
    return None


def test_seatgeek_normalize():
    ev = {
        "id": 6101,
        "title": "Knicks at Celtics",
        "type": "nba",
        "datetime_utc": "2026-12-10T00:30:00",
        "datetime_local": "2026-12-09T19:30:00",
        "url": "https://seatgeek.com/e/6101",
        "venue": {"name": "TD Garden", "address": "100 Legends Way", "extended_address": "Boston, MA 02114",
                  "country": "US", "timezone": "America/New_York", "location": {"lat": 42.3662, "lon": -71.0621}},
        "performers": [{"images": {"huge": "https://seatgeek/img.jpg"}}],
        "stats": {"lowest_price": 89, "highest_price": 900},
    }
    e = seatgeek.normalize(ev, cities_for("seatgeek", "Boston")[0])
    assert e.category == EventCategory.SPORTS
    assert e.start_time == datetime(2026, 12, 10, 0, 30, tzinfo=timezone.utc)
    assert (e.price_min, e.price_max) == (89.0, 900.0)
    assert e.image_url == "https://seatgeek/img.jpg"


def test_eventfinda_normalize():
    ev = {
        "id": 99,
        "name": "Auckland Night Market",
        "url": "https://www.eventfinda.co.nz/2026/market/auckland",
        "description": "<p>Street food &amp; stalls</p>",
        "datetime_start": "2026-11-21 17:00:00",
        "datetime_end": "2026-11-21 22:00:00",
        "location": {"name": "Pakuranga Plaza", "summary": "Pakuranga, Auckland"},
        "point": {"lat": -36.9, "lng": 174.87},
        "category": {"name": "Markets & Fairs", "url_slug": "markets"},
        "is_free": True,
        "images": {"images": [{"transforms": {"transforms": [{"url": "https://ef/s.jpg", "width": 190}, {"url": "https://ef/l.jpg", "width": 1200}]}}]},
    }
    e = eventfinda.normalize(ev, AKL)
    # 5 pm in Auckland (NZDT, UTC+13) is 4 am UTC.
    assert e.start_time == datetime(2026, 11, 21, 4, 0, tzinfo=timezone.utc)
    assert e.is_free and e.category == EventCategory.COMMUNITY
    assert e.image_url == "https://ef/l.jpg" and e.source_id == "nz-99"
    assert e.description == "Street food &amp; stalls"


def test_paris_next_occurrence_and_free():
    rec = {
        "id": 4242,
        "title": "Atelier céramique",
        "lead_text": "Initiation au tour",
        "date_start": "2026-11-01T10:00:00+01:00",
        "date_end": "2026-12-20T18:00:00+01:00",
        "occurrences": "2026-11-10T10:00:00+01:00_2026-11-10T12:00:00+01:00;2026-11-24T10:00:00+01:00_2026-11-24T12:00:00+01:00",
        "lat_lon": {"lat": 48.86, "lon": 2.35},
        "price_type": "gratuit",
        "qfap_tags": "Atelier;Enfants",
        "address_name": "Maison des arts",
        "url": "https://quefaire.paris.fr/4242",
    }
    e = paris_opendata.normalize(rec, NOW)
    assert e.start_time == datetime(2026, 11, 24, 9, 0, tzinfo=timezone.utc)
    assert e.is_free and e.category == EventCategory.FAMILY  # a kids workshop
    assert e.raw_data["license"] == "ODbL-1.0"
    # Past and with no future slot: dropped.
    assert paris_opendata.normalize({**rec, "occurrences": "", "date_end": "2026-11-01T12:00:00+01:00"}, NOW) is None


ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VEVENT
UID:a1@test
SUMMARY:AI Builders Meetup
DTSTART:20261125T183000Z
DTEND:20261125T210000Z
LOCATION:Shoreditch Works
URL:https://example.org/ai
END:VEVENT
BEGIN:VEVENT
UID:old@test
SUMMARY:Last month
DTSTART:20261001T183000Z
END:VEVENT
END:VCALENDAR
"""


def test_ics_feed_parses_upcoming_only():
    feed = {"url": "https://example.org/cal.ics", "name": "Example", "city": "London", "country": "GB",
            "lat": 51.52, "lng": -0.08, "tz": "Europe/London"}
    got = parse_feed(ICS, feed, NOW)
    assert [e.title for e in got] == ["AI Builders Meetup"]
    e = got[0]
    assert e.category == EventCategory.TECH and (e.lat, e.lng) == (51.52, -0.08)
    assert e.url == "https://example.org/ai" and e.country == "GB"


def _ev(source, title, minutes=0, lat=40.7505):
    return EventCreate(title=title, start_time=NOW + timedelta(minutes=minutes), lat=lat, lng=-73.9934,
                       source=source, source_id=f"{source}-{title}-{minutes}")


def test_dedupe_prefers_ticketmaster():
    kept = dedupe([
        _ev("seatgeek", "Phoebe Bridgers Tickets"),
        _ev("ticketmaster", "Phoebe Bridgers", 15),
        _ev("seatgeek", "Phoebe Bridgers", 60 * 24),  # next night: a different show
        _ev("seatgeek", "Phoebe Bridgers", 10, lat=40.80),  # another venue
    ])
    assert sorted(e.source for e in kept) == ["seatgeek", "seatgeek", "ticketmaster"]
    assert norm_title("The Killers: Live at MSG 2026") == "killers msg"


@pytest.mark.asyncio
async def test_eventfinda_pages_by_count_and_skips_countries_without_account(httpx_mock, monkeypatch):
    monkeypatch.setattr("app.scrapers.world.asyncio.sleep", _no_sleep)
    for k in ("EVENTFINDA_AU_USERNAME", "EVENTFINDA_AU_PASSWORD", "EVENTFINDA_SG_USERNAME", "EVENTFINDA_SG_PASSWORD"):
        monkeypatch.delenv(k, raising=False)
    row = lambda i: {"id": i, "name": f"E{i}", "datetime_start": "2026-11-21 17:00:00", "point": {"lat": -36.9, "lng": 174.8}}
    # 19 usable rows on a full first page still means "keep going": the API says 25 in total.
    page1 = [row(i) for i in range(19)] + [{"id": 99, "name": "", "datetime_start": "x"}]
    httpx_mock.add_response(json={"@attributes": {"count": 25}, "events": page1})
    httpx_mock.add_response(json={"@attributes": {"count": 25}, "events": [row(i) for i in range(19, 24)]})
    got = await eventfinda.EventfindaScraper(username="u", password="p").scrape(city="Auckland")
    assert len(got) == 24 and len(httpx_mock.get_requests()) == 2
    # Sydney has no Australian account set: no request at all.
    assert await eventfinda.EventfindaScraper(username="u", password="p").scrape(city="Sydney") == []


def test_luma_feed_parsing():
    from datetime import datetime, timezone
    from pathlib import Path
    from app.scrapers.ics_feeds import parse_feed

    text = (Path(__file__).parent / "fixtures" / "luma_mumbai.ics").read_text(encoding="utf-8")
    feed = {"url": "https://api.luma.com/ics/get?entity=discover&id=x", "name": "Luma · Mumbai", "city": "Mumbai",
            "country": "IN", "lat": 19.07, "lng": 72.87, "tz": "Asia/Kolkata", "category": "community"}
    got = parse_feed(text, feed, now=datetime(2026, 11, 19, 12, tzinfo=timezone.utc))
    assert [e.title for e in got] == ["Games Night", "BR Shake Out Run w/ Only What's Needed"]
    games, run = got
    # Link pulled out of the boilerplate; hidden address isn't shown as a URL.
    assert games.url == "https://luma.com/4ivdbx65"
    assert games.location_name is None
    assert games.description.startswith("This is your chance")
    assert "Hosted by" not in games.description and "Get up-to-date" not in games.description
    assert abs(games.lat - 19.0055) < 1e-3
    assert run.url == "https://luma.com/lmp9bj2q"
    assert run.location_name.startswith("Carter Road Amphitheatre")
    assert run.city == "Mumbai" and run.source == "ics"
    assert run.category.value == "sports"


def test_football_fixtures_home_matches_in_covered_cities():
    from datetime import date, datetime, timezone
    from app.scrapers.football import parse_league, season_for, short_name

    assert season_for(date(2026, 11, 20)) == "2026-27"
    assert season_for(date(2027, 3, 1)) == "2026-27"
    assert season_for(date(2027, 7, 1)) == "2027-28"
    assert short_name("Manchester City FC") == "Manchester City"
    assert short_name("AFC Ajax") == "Ajax"
    assert short_name("Paris FC") == "Paris FC"

    data = {"matches": [
        {"round": "Matchday 11", "date": "2026-11-21", "time": "15:00", "team1": "Chelsea FC", "team2": "Leeds United FC"},
        {"round": "Matchday 11", "date": "2026-11-21", "time": "17:30", "team1": "Newcastle United FC", "team2": "Arsenal FC"},
        {"round": "Matchday 10", "date": "2026-11-08", "time": "15:00", "team1": "Arsenal FC", "team2": "Everton FC", "score": {"ft": [1, 0]}},
        {"round": "Matchday 12", "date": "2026-11-28", "team1": "Manchester United FC", "team2": "Fulham FC"},
        {"round": "Matchday 30", "date": "2027-04-10", "time": "15:00", "team1": "Arsenal FC", "team2": "Fulham FC"},
    ]}
    got = parse_league(data, "en.1", "Premier League", now=datetime(2026, 11, 19, 12, tzinfo=timezone.utc))
    assert [e.title for e in got] == ["Chelsea vs Leeds United", "Manchester United vs Fulham"]
    chelsea, united = got
    assert chelsea.city == "London" and chelsea.location_name == "Stamford Bridge"
    assert chelsea.start_time == datetime(2026, 11, 21, 15, 0, tzinfo=timezone.utc)  # GMT in November
    assert chelsea.category.value == "sports" and chelsea.source == "football"
    assert "Matchday 11" in chelsea.description
    # Date-only match: midnight local, with a note that the time isn't out yet.
    assert united.start_time == datetime(2026, 11, 28, 0, 0, tzinfo=timezone.utc)
    assert "not announced" in united.description
