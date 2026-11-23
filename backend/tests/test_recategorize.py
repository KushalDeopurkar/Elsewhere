"""Re-deciding stored categories, and noticing when the writes don't stick."""

import logging

from app.services.recategorize import recategorize


class _Res:
    def __init__(self, data=None, count=None):
        self.data, self.count = data, count


class _Query:
    def __init__(self, client, kind, payload=None):
        self.client, self.kind, self.payload, self.ids = client, kind, payload, []

    # read chain
    def select(self, *_a, **_k): return self
    def gte(self, *_a, **_k): return self
    def order(self, *_a, **_k): return self
    def range(self, *_a, **_k): return self

    def update(self, payload, **_k):
        return _Query(self.client, "update", payload)

    def in_(self, _col, ids):
        self.ids = list(ids)
        return self

    def execute(self):
        if self.kind == "update":
            self.client.updates.append((self.payload["category"], self.ids))
            return _Res(count=0 if self.client.refuse else len(self.ids))
        return _Res(data=self.client.rows)


class _Client:
    def __init__(self, rows, refuse=False):
        self.rows, self.refuse, self.updates = rows, refuse, []

    def table(self, _name):
        return _Query(self, "read")


ROWS = [
    # Found on Meetup's music page, plainly a founders' networking event.
    {"id": "a", "title": "Primewise Founders Club Networking Event- Mumbai (Online)",
     "description": None, "category": "music", "source": "meetup"},
    # Already right.
    {"id": "b", "title": "Arijit Singh Live", "description": None, "category": "music", "source": "district"},
]


def test_moves_wrong_categories_and_counts_what_was_saved():
    client = _Client(ROWS)
    stats = recategorize(client)
    assert stats == {"seen": 2, "changed": 1, "applied": 1}
    assert client.updates == [("business", ["a"])]


def test_reports_writes_the_database_refused(caplog):
    client = _Client(ROWS, refuse=True)
    with caplog.at_level(logging.ERROR):
        stats = recategorize(client)
    assert stats["applied"] == 0 and stats["changed"] == 1
    assert "only 0 of 1" in caplog.text
