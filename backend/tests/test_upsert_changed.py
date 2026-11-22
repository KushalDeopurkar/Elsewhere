"""Only new or changed listings are written; page-found values are kept."""

from app.services.event_service import EventService, split_by_image


class Q:
    def __init__(self, client, name):
        self.c, self.op, self.rows = client, None, None

    def select(self, cols):
        self.op = "select"
        return self

    def eq(self, *a):
        return self

    def in_(self, col, ids):
        self.ids = ids
        return self

    def upsert(self, rows, **kw):
        self.op, self.rows = "upsert", rows
        return self

    def execute(self):
        class R:
            pass
        r = R()
        if self.op == "select":
            r.data = [s for s in self.c.stored if s["source_id"] in self.ids]
        else:
            self.c.written.extend(self.rows)
            r.data = None
        return r


class Client:
    def __init__(self, stored):
        self.stored, self.written = stored, []

    def table(self, name):
        return Q(self, name)


def row(i, title="Gig", start="2026-11-22T14:00:00+00:00", price=None, img=None):
    return {"source": "ics", "source_id": str(i), "title": title, "start_time": start,
            "price_min": price, "price_max": None, "image_url": img, "is_free": False, "raw_data": {"x": i}}


def test_unchanged_rows_are_skipped(monkeypatch):
    monkeypatch.setattr("app.services.event_service.WRITE_PAUSE", 0)
    stored = [{"source_id": "1", "title": "Gig", "start_time": "2026-11-22T19:30:00+05:30"},
              {"source_id": "2", "title": "Old title", "start_time": "2026-11-22T14:00:00+00:00"}]
    client = Client(stored)
    svc = EventService(client)
    rows = [row(1), row(2, title="New title"), row(3)]
    n = 0
    for batch in split_by_image(rows):
        chunk = svc._changed_only(batch)
        n += len(chunk)
    assert n == 2  # 1 is the same instant in another spelling; 2 changed; 3 is new


def test_empty_price_and_picture_do_not_wipe_page_values():
    groups = split_by_image([row(1), row(2, price=499.0, img="https://x/y.jpg")])
    keys = sorted(tuple(sorted(g[0])) for g in groups)
    no_info = next(k for k in keys if "price_min" not in k)
    assert "image_url" not in no_info and "is_free" not in no_info
    assert any("price_min" in k and "image_url" in k for k in keys)


def test_a_moved_pin_is_written_even_when_nothing_else_changed():
    rows = [row(1)]
    stored = [{k: v for k, v in rows[0].items() if k != "raw_data"}]
    svc = EventService(Client(stored))
    assert svc._changed_only(rows) == []
    assert svc._changed_only(rows, {("ics", "1")}) == rows


def test_an_unchanged_event_from_a_scraper_is_skipped():
    # Through the real path: EventCreate -> to_db_row, category an Enum.
    from datetime import datetime, timezone
    from app.models.event import EventCategory, EventCreate
    from app.services.event_service import _unescape_row

    e = EventCreate(title="Gig", category=EventCategory.MUSIC, source="ics", source_id="9",
                    start_time=datetime(2026, 11, 25, 14, 0, tzinfo=timezone.utc), city="Mumbai",
                    url="https://example.com/gig", is_free=True)
    r = _unescape_row(e.to_db_row())
    stored = [{"source_id": "9", "title": "Gig", "category": "music", "start_time": "2026-11-25T14:00:00+00:00",
               "city": "Mumbai", "url": "https://example.com/gig", "is_free": True,
               "description": None, "end_time": None, "location_name": None, "address": None,
               "country": "US", "image_url": None, "price_min": None, "price_max": None}]
    svc = EventService(Client(stored))
    assert svc._changed_only([r]) == []
    stored[0]["category"] = "sports"
    assert svc._changed_only([r]) == [r]
