import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.api.events import get_event_service
from app.main import app


@pytest.fixture
def mock_event_service():
    # FastAPI resolves `Depends(get_event_service)` by the function object
    # captured at route-decoration time, so `unittest.mock.patch`-ing the
    # `app.api.events.get_event_service` module attribute after import has
    # no effect on already-registered routes. `dependency_overrides` is the
    # mechanism FastAPI provides specifically to swap a dependency's
    # implementation for tests, keyed by that same original callable.
    service = MagicMock()
    app.dependency_overrides[get_event_service] = lambda: service
    yield service
    app.dependency_overrides.pop(get_event_service, None)


@pytest.fixture
def client():
    return TestClient(app)


def test_search_events(client, mock_event_service):
    mock_event_service.search.return_value = [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Tech Meetup",
            "description": "A meetup",
            "category": "tech",
            "start_time": "2026-09-15T18:00:00+00:00",
            "end_time": None,
            "location_name": "WeWork",
            "address": "BKC",
            "city": "Mumbai",
            "country": "IN",
            "lat": 19.06,
            "lng": 72.87,
            "image_url": None,
            "url": "https://example.com",
            "price_min": None,
            "price_max": None,
            "is_free": True,
            "source": "eventbrite",
            "distance_km": 2.5,
            "relevance": 0.8,
        }
    ]

    resp = client.get("/api/events/search?q=tech&lat=19.07&lng=72.87")
    assert resp.status_code == 200

    body = resp.json()
    assert body["error"] is None
    assert len(body["data"]) == 1
    assert body["data"][0]["title"] == "Tech Meetup"


def test_search_events_no_results(client, mock_event_service):
    mock_event_service.search.return_value = []

    resp = client.get("/api/events/search?q=nonexistent")
    assert resp.status_code == 200
    assert resp.json()["data"] == []


def test_get_event_by_id(client, mock_event_service):
    mock_event_service.get_by_id.return_value = {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Tech Meetup",
        "description": "A meetup",
        "category": "tech",
        "start_time": "2026-09-15T18:00:00+00:00",
        "end_time": None,
        "location_name": "WeWork",
        "address": "BKC",
        "city": "Mumbai",
        "country": "IN",
        "lat": 19.06,
        "lng": 72.87,
        "image_url": None,
        "url": "https://example.com",
        "price_min": None,
        "price_max": None,
        "is_free": True,
        "source": "eventbrite",
    }

    resp = client.get("/api/events/550e8400-e29b-41d4-a716-446655440000")
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == "Tech Meetup"


def test_get_event_not_found(client, mock_event_service):
    mock_event_service.get_by_id.return_value = None

    resp = client.get("/api/events/550e8400-e29b-41d4-a716-446655440000")
    assert resp.status_code == 404


def test_map_events(client, mock_event_service):
    mock_event_service.get_in_bounds.return_value = [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Nearby Event",
            "category": "music",
            "start_time": "2026-09-20T19:00:00+00:00",
            "location_name": "Venue",
            "lat": 19.08,
            "lng": 72.88,
            "is_free": False,
        }
    ]

    resp = client.get("/api/events/map?south=19.0&west=72.8&north=19.2&east=73.0")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1
