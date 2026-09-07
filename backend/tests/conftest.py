import os
from datetime import datetime, timezone

import pytest

# Ensure Settings() can be constructed during test collection (app.main
# builds the FastAPI app — and therefore Settings — at import time) even
# when no real Supabase project is configured for this test run.
os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "placeholder")


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
