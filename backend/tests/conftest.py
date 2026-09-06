import pytest
from datetime import datetime, timezone


@pytest.fixture
def sample_event_data() -> dict:
    return {
        "title": "Mumbai Tech Meetup",
        "description": "Monthly tech meetup in Mumbai",
        "category": "tech",
        "start_time": datetime(2026, 9, 15, 18, 0, tzinfo=timezone.utc),
        "end_time": datetime(2026, 9, 15, 21, 0, tzinfo=timezone.utc),
        "location_name": "WeWork BKC",
        "address": "Bandra Kurla Complex",
        "city": "Mumbai",
        "country": "IN",
        "lat": 19.0596,
        "lng": 72.8656,
        "url": "https://example.com/event/123",
        "is_free": True,
        "source": "test",
        "source_id": "test-123",
    }
