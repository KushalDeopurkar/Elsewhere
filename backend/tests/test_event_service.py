from datetime import datetime, timezone

import pytest
from unittest.mock import MagicMock

from app.models.event import EventCreate, EventSearchParams, EventSort
from app.services.event_service import EventService


@pytest.fixture
def mock_supabase():
    client = MagicMock()
    # Mock the table().upsert().execute() chain
    mock_execute = MagicMock()
    mock_execute.data = [{"id": "uuid-1"}]
    client.table.return_value.upsert.return_value.execute.return_value = mock_execute
    return client


@pytest.fixture
def service(mock_supabase):
    return EventService(mock_supabase)


def test_upsert_events_calls_supabase(service, mock_supabase, sample_event_data):
    events = [EventCreate(**sample_event_data)]
    count = service.upsert_events(events)

    assert count == 1
    mock_supabase.table.assert_called_with("events")
    call_args = mock_supabase.table().upsert.call_args
    rows = call_args[0][0]
    assert len(rows) == 1
    assert rows[0]["title"] == "Mumbai Tech Meetup"


def test_upsert_events_empty_list(service):
    count = service.upsert_events([])
    assert count == 0


def test_search_calls_rpc(service, mock_supabase):
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = [
        {"id": "uuid-1", "title": "Test Event", "distance_km": 5.2}
    ]
    mock_supabase.rpc.return_value = mock_rpc

    params = EventSearchParams(q="tech", lat=19.07, lng=72.87)
    results = service.search(params)

    assert len(results) == 1
    assert results[0]["title"] == "Test Event"
    mock_supabase.rpc.assert_called_once_with(
        "search_events",
        {
            "query": "tech",
            "category_filter": None,
            "p_lat": 19.07,
            "p_lng": 72.87,
            "radius_km": 25.0,
            "from_time": params.from_time.isoformat() if params.from_time else None,
            "to_time": None,
            "free_only": None,
            "online_only": None,
            "sort_by": "relevance",
            "page_limit": 50,
            "page_offset": 0,
        },
    )


def test_search_passes_facets_and_sort_to_rpc(service, mock_supabase):
    """free_only/online_only/sort_by must reach the RPC, not be dropped."""
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = []
    mock_supabase.rpc.return_value = mock_rpc

    params = EventSearchParams(
        free_only=True, online_only=False, sort_by=EventSort.DATE
    )
    service.search(params)

    rpc_params = mock_supabase.rpc.call_args[0][1]
    assert rpc_params["free_only"] is True
    assert rpc_params["online_only"] is False
    assert rpc_params["sort_by"] == "date"


def test_search_unset_facets_are_none(service, mock_supabase):
    """An unset facet must be NULL so the RPC applies no constraint."""
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = []
    mock_supabase.rpc.return_value = mock_rpc

    service.search(EventSearchParams(q="jazz"))

    rpc_params = mock_supabase.rpc.call_args[0][1]
    assert rpc_params["free_only"] is None
    assert rpc_params["online_only"] is None
    assert rpc_params["sort_by"] == "relevance"


def test_get_by_id_found(service, mock_supabase):
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = [{"id": "uuid-1", "title": "Test Event"}]
    mock_supabase.rpc.return_value = mock_rpc

    result = service.get_by_id("uuid-1")

    assert result == {"id": "uuid-1", "title": "Test Event"}
    mock_supabase.rpc.assert_called_with("get_event_by_id", {"p_id": "uuid-1"})


def test_get_by_id_not_found(service, mock_supabase):
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = []
    mock_supabase.rpc.return_value = mock_rpc

    result = service.get_by_id("missing-id")

    assert result is None


def test_get_in_bounds(service, mock_supabase):
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = [
        {"id": "uuid-1", "title": "Nearby Event", "lat": 19.08, "lng": 72.88}
    ]
    mock_supabase.rpc.return_value = mock_rpc

    results = service.get_in_bounds(
        south=19.0, west=72.8, north=19.2, east=73.0
    )

    assert len(results) == 1
    mock_supabase.rpc.assert_called_once()
    call_args = mock_supabase.rpc.call_args
    assert call_args[0][0] == "events_in_bounds"
    rpc_params = call_args[0][1]
    assert rpc_params["south"] == 19.0
    assert rpc_params["west"] == 72.8
    assert rpc_params["north"] == 19.2
    assert rpc_params["east"] == 73.0


def test_get_in_bounds_passes_time_window(service, mock_supabase):
    """The map's day filter must reach the RPC as a real bounded window."""
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = []
    mock_supabase.rpc.return_value = mock_rpc

    start = datetime(2026, 10, 31, tzinfo=timezone.utc)
    end = datetime(2026, 11, 1, tzinfo=timezone.utc)
    service.get_in_bounds(
        south=19.0, west=72.8, north=19.2, east=73.0,
        from_time=start, to_time=end,
    )

    rpc_params = mock_supabase.rpc.call_args[0][1]
    assert rpc_params["from_time"] == start.isoformat()
    assert rpc_params["to_time"] == end.isoformat()


def test_get_in_bounds_unset_to_time_is_none(service, mock_supabase):
    """No upper bound means no constraint, not an empty result."""
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = []
    mock_supabase.rpc.return_value = mock_rpc

    service.get_in_bounds(south=19.0, west=72.8, north=19.2, east=73.0)

    assert mock_supabase.rpc.call_args[0][1]["to_time"] is None


def test_get_in_bounds_passes_query(service, mock_supabase):
    """Map search must reach the RPC so it uses the same index as /search."""
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = []
    mock_supabase.rpc.return_value = mock_rpc

    service.get_in_bounds(
        south=19.0, west=72.8, north=19.2, east=73.0, q="hackathon"
    )

    assert mock_supabase.rpc.call_args[0][1]["query"] == "hackathon"


def test_get_in_bounds_unset_query_is_none(service, mock_supabase):
    """No keyword means no text constraint on the bounding box."""
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = []
    mock_supabase.rpc.return_value = mock_rpc

    service.get_in_bounds(south=19.0, west=72.8, north=19.2, east=73.0)

    assert mock_supabase.rpc.call_args[0][1]["query"] is None


def test_get_in_bounds_empty_result(service, mock_supabase):
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = None
    mock_supabase.rpc.return_value = mock_rpc

    results = service.get_in_bounds(south=19.0, west=72.8, north=19.2, east=73.0)

    assert results == []
