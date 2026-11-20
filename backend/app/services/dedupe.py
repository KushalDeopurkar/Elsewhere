"""
Cross-source de-duplication within a scrape run.

The same concert can arrive from Ticketmaster and SeatGeek. Before the
upsert, events that share a normalised title, a start time within the same
half hour and a venue within about 250 m are collapsed to one, keeping the
listing from the most authoritative source (the primary ticketer first).
"""

from __future__ import annotations

import math
import re
from typing import Dict, List, Tuple

from app.models.event import EventCreate

# Lower is preferred.
PRIORITY = {"ticketmaster": 0, "eventfinda": 1, "paris-opendata": 1, "seatgeek": 2, "ics": 3, "football": 4}
NOISE = re.compile(r"\b(tickets?|live( at| in)?|presents?|the|tour|concert|edition|ft|feat|featuring|20\d\d)\b")


def norm_title(t: str) -> str:
    """Lower case, accents and emoji gone, "Æ" as "ae", filler words dropped.

    "ANYMA presents AEDEN" and "Anyma presents ÆDEN" come out the same.
    """
    import unicodedata

    t = t.replace("Æ", "AE").replace("æ", "ae").replace("Œ", "OE").replace("œ", "oe").replace("ß", "ss")
    t = unicodedata.normalize("NFKD", t)
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    t = re.sub(r"[^a-z0-9\s]", " ", t.lower())
    t = NOISE.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


def _near(a: EventCreate, b: EventCreate, metres: float = 250) -> bool:
    if None in (a.lat, a.lng, b.lat, b.lng):
        return (a.location_name or "").lower() == (b.location_name or "").lower()
    dy = (a.lat - b.lat) * 111_320
    dx = (a.lng - b.lng) * 111_320 * math.cos(math.radians((a.lat + b.lat) / 2))
    return math.hypot(dx, dy) <= metres


def dedupe(events: List[EventCreate]) -> List[EventCreate]:
    ranked = sorted(events, key=lambda e: PRIORITY.get(e.source, 5))
    buckets: Dict[Tuple[str, int], List[EventCreate]] = {}
    kept: List[EventCreate] = []
    for e in ranked:
        slot = int(e.start_time.timestamp() // 1800)
        title = norm_title(e.title)
        clash = False
        for s in (slot - 1, slot, slot + 1):
            for other in buckets.get((title, s), []):
                # The same listing twice, from two sites or posted twice on one.
                if (other.source != e.source or other.source_id != e.source_id) and abs((other.start_time - e.start_time).total_seconds()) <= 1800 and _near(other, e):
                    clash = True
                    break
            if clash:
                break
        if clash:
            continue
        buckets.setdefault((title, slot), []).append(e)
        kept.append(e)
    return kept
