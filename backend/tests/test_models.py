from datetime import datetime, timezone
from app.models.event import EventCreate, EventCategory, EventResponse


def test_event_create_to_db_row(sample_event_data):
    event = EventCreate(**sample_event_data)
    row = event.to_db_row()

    assert row["title"] == "Mumbai Tech Meetup"
    assert row["coords"] == "POINT(72.8656 19.0596)"
    assert row["source"] == "test"
    assert row["source_id"] == "test-123"
    assert "lat" not in row
    assert "lng" not in row


def test_event_create_no_coords(sample_event_data):
    sample_event_data.pop("lat")
    sample_event_data.pop("lng")
    event = EventCreate(**sample_event_data)
    row = event.to_db_row()

    assert row["coords"] is None


def test_event_category_values():
    assert EventCategory.TECH == "tech"
    assert EventCategory.MUSIC == "music"


def test_event_create_defaults():
    event = EventCreate(
        title="Minimal Event",
        start_time=datetime(2026, 10, 1, tzinfo=timezone.utc),
        source="test",
        source_id="min-1",
    )
    assert event.category == EventCategory.OTHER
    assert event.is_free is False
    assert event.country == "US"
