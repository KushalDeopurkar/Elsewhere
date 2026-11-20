"""A chunk that times out is split and retried, never failing the run."""

from postgrest import APIError

from app.services.event_service import EventService


class FakeTable:
    def __init__(self, log, limit):
        self.log, self.limit, self.rows = log, limit, None

    def upsert(self, rows, **kw):
        self.rows = rows
        return self

    def execute(self):
        if len(self.rows) > self.limit:
            raise APIError({"code": "57014", "message": "canceling statement due to statement timeout"})
        self.log.extend(self.rows)


class FakeClient:
    def __init__(self, limit):
        self.log, self.limit = [], limit

    def table(self, name):
        return FakeTable(self.log, self.limit)


def test_timeouts_split_until_rows_fit(monkeypatch):
    monkeypatch.setattr("app.services.event_service.time.sleep", lambda s: None)
    client = FakeClient(limit=60)
    svc = EventService(client)
    rows = [{"source": "s", "source_id": str(i)} for i in range(200)]
    assert svc._upsert_chunk(rows) == 200
    assert len(client.log) == 200


def test_other_errors_still_raise():
    class Broken(FakeClient):
        def table(self, name):
            t = FakeTable(self.log, 10**6)
            def boom():
                raise APIError({"code": "23505", "message": "duplicate key"})
            t.execute = boom
            return t
    svc = EventService(Broken(0))
    try:
        svc._upsert_chunk([{"source": "s", "source_id": "1"}])
    except APIError:
        return
    raise AssertionError("expected APIError")
