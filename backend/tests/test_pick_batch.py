from datetime import datetime, timedelta, timezone

from app.enrich.enricher import pick_batch


class Q:
    """Just enough of the supabase query builder for pick_batch."""

    def __init__(self, rows):
        self.rows, self.f, self.neg, self.n = rows, [], False, None

    def select(self, *_):
        return self

    @property
    def not_(self):
        self.neg = True
        return self

    def _add(self, fn):
        neg, self.neg = self.neg, False
        self.f.append((lambda r: not fn(r)) if neg else fn)
        return self

    def gte(self, k, v):
        return self._add(lambda r: r.get(k) is not None and r[k] >= v)

    def lte(self, k, v):
        return self._add(lambda r: r.get(k) is not None and r[k] <= v)

    def lt(self, k, v):
        return self._add(lambda r: r.get(k) is not None and r[k] < v)

    def in_(self, k, vs):
        return self._add(lambda r: r.get(k) in vs)

    def is_(self, k, _null):
        return self._add(lambda r: r.get(k) is None)

    def order(self, k):
        self.key = k
        return self

    def limit(self, n):
        self.n = n
        return self

    def execute(self):
        out = sorted((r for r in self.rows if all(f(r) for f in self.f)), key=lambda r: r["start_time"])
        return type("R", (), {"data": out[: self.n]})()


class Client:
    def __init__(self, rows):
        self.rows = rows

    def table(self, _):
        return Q(self.rows)


def iso(**kw):
    return (datetime.now(timezone.utc) + timedelta(**kw)).isoformat()


def row(i, start_h, fetched_h_ago=None, details=None):
    return {"id": str(i), "title": f"E{i}", "url": f"https://district.in/e/{i}", "source": "district",
            "start_time": iso(hours=start_h), "details": details,
            "details_fetched_at": iso(hours=-fetched_h_ago) if fetched_h_ago is not None else None}


def test_retry_failed_still_rechecks_stale_tickets():
    rows = [row(1, 5, fetched_h_ago=120, details={"t": 1}),  # sold out 5 days ago, show is today
            row(2, 30, fetched_h_ago=2, details=None),        # tried, got nothing
            row(3, 40)]                                         # never tried
    ids = [r["id"] for r in pick_batch(Client(rows), 10, ["district"], retry_failed=True)]
    assert ids[0] == "2"            # failed ones first
    assert set(ids) == {"1", "2", "3"}  # the stale ticket check is no longer skipped


def test_failed_ones_take_at_most_half():
    rows = [row(i, i + 1, fetched_h_ago=1) for i in range(10)] + [row(100, 2, fetched_h_ago=200, details={"t": 1})]
    ids = [r["id"] for r in pick_batch(Client(rows), 4, ["district"], retry_failed=True)]
    # Two failed retries (half of 4) leave room for the stale ticket check.
    assert ids == ["0", "1", "100"]
