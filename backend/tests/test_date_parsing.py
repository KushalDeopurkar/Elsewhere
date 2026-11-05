"""Start times must keep their real instant whatever format a source uses.

Regression: District sends UTC timestamps ending in "Z". They were matched
as a literal "Z" and then labelled IST, storing every event 5h30m early.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.scrapers.allevents import AllEventsScraper
from app.scrapers.district import DistrictScraper

IST = timezone(timedelta(hours=5, minutes=30))
ELEVEN_PM_IST = datetime(2026, 11, 7, 23, 0, tzinfo=IST)


@pytest.mark.parametrize(
    "raw",
    [
        "2026-11-07T17:30:00.000Z",
        "2026-11-07T17:30:00Z",
        "2026-11-07T23:00:00+05:30",
        "2026-11-07T23:00:00",
    ],
)
def test_district_keeps_the_instant(raw):
    assert DistrictScraper(delay=0)._parse_iso_date(raw) == ELEVEN_PM_IST


@pytest.mark.parametrize(
    "raw",
    [
        "2026-11-07T17:30:00Z",
        "2026-11-07T23:00:00+05:30",
        "2026-11-07T23:00:00",
    ],
)
def test_allevents_keeps_the_instant(raw):
    assert AllEventsScraper(delay=0)._parse_date(raw) == ELEVEN_PM_IST


def test_date_only_is_local_midnight():
    assert DistrictScraper(delay=0)._parse_iso_date("2026-11-07") == datetime(2026, 11, 7, tzinfo=IST)
    assert AllEventsScraper(delay=0)._parse_date("2026-11-07") == datetime(2026, 11, 7, tzinfo=IST)


def test_garbage_is_none():
    assert DistrictScraper(delay=0)._parse_iso_date("next friday") is None
    assert AllEventsScraper(delay=0)._parse_date("") is None
