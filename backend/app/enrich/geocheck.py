"""
Check event map pins against OpenStreetMap, and move the ones that are wrong.

Some sources send bad coordinates: AllEvents put a concert at Inorbit Mall,
Malad 8.6 km out in the Arabian Sea, and other venues 5 to 19 km from where
the same venue appears for other events. Events with no coordinates at all
get the city centre.

For each event from a checked source, this looks up "venue, city" on
Photon (OpenStreetMap's geocoder, komoot.io). Photon guesses freely when a
name is vague ("Paytm office" came back as a government building), so a
result only counts when its own name matches the venue's words. Then:

- the source pin is more than MOVE_KM from that place: the pin moves there;
- the event only had the city centre: it gets the venue's place.

Answers are cached in a JSON file (kept between runs by the workflow), and
each run looks up at most `budget` new names, soonest events first, at one
request a second as Photon asks.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import time
from typing import Callable, Iterable, Optional

import httpx

logger = logging.getLogger(__name__)

PHOTON = "https://photon.komoot.io/api/"
MOVE_KM = 2.0
# A match further than this from the city is some other place with the same name.
CITY_KM = 60.0
CHECKED_SOURCES = ("allevents",)
USER_AGENT = "Elsewhere event map (github.com/KushalDeopurkar/Elsewhere)"

# Words that say nothing about which place it is.
_STOP = {
    "the", "and", "for", "with", "at", "of", "in", "on", "by", "near", "opp", "opposite",
    "road", "rd", "marg", "street", "st", "lane", "floor", "level", "building", "bldg",
    "west", "east", "north", "south", "new", "old", "india", "maharashtra", "no",
    "venue", "hall", "ground", "grounds", "auditorium", "centre", "center", "mall",
}
_VAGUE = re.compile(r"\b(to be announced|tba|tbd|online|virtual|zoom|google meet|secret location|various)\b", re.I)


def _tokens(s: str | None) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", (s or "").lower()) if len(w) >= 3 and w not in _STOP}


def km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    p = math.pi / 180
    d = 0.5 - math.cos((b_lat - a_lat) * p) / 2 + math.cos(a_lat * p) * math.cos(b_lat * p) * (1 - math.cos((b_lng - a_lng) * p)) / 2
    return 12742 * math.asin(math.sqrt(max(0.0, d)))


def names_for(location_name: str | None, address: str | None) -> list[str]:
    """Venue names worth looking up, most specific first."""
    out: list[str] = []
    for n in (location_name, (address or "").split(",")[0], ", ".join((address or "").split(",")[:2])):
        n = (n or "").strip()
        if n and not _VAGUE.search(n) and _tokens(n) and n not in out:
            out.append(n)
    return out


def name_matches(query_name: str, result_name: str | None) -> bool:
    """The result is the place asked for: most of its distinctive words are in the venue's name."""
    q, r = _tokens(query_name), _tokens(result_name)
    if not q or not r:
        return False
    shared = q & r
    return bool(shared) and len(shared) / len(r) >= 0.6


Fetch = Callable[[str, float, float], list[dict]]


def photon_fetch(client: httpx.Client) -> Fetch:
    last = [0.0]

    def fetch(q: str, lat: float, lng: float) -> list[dict]:
        wait = 1.0 - (time.monotonic() - last[0])
        if wait > 0:
            time.sleep(wait)
        last[0] = time.monotonic()
        r = client.get(PHOTON, params={"q": q, "lat": lat, "lon": lng, "limit": 3}, timeout=10)
        r.raise_for_status()
        return r.json().get("features", [])

    return fetch


def lookup(name: str, city: str, near: tuple[float, float], fetch: Fetch) -> Optional[tuple[float, float]]:
    """(lat, lng) of the place called `name` in `city`, or None when nothing matching is found."""
    for f in fetch(f"{name}, {city}" if city else name, near[0], near[1]):
        try:
            lng, lat = f["geometry"]["coordinates"][:2]
        except (KeyError, TypeError, ValueError):
            continue
        if name_matches(name, (f.get("properties") or {}).get("name")) and km(lat, lng, near[0], near[1]) <= CITY_KM:
            return float(lat), float(lng)
    return None


def load_cache(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def save_cache(path: str, cache: dict) -> None:
    try:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(cache, fh)
    except OSError as e:
        logger.warning(f"Couldn't save the geocode cache: {e}")


def check_pins(
    events: Iterable,
    city_centres: dict[str, tuple[float, float]],
    cache: dict,
    fetch: Fetch,
    budget: int = 150,
    sources: tuple[str, ...] = CHECKED_SOURCES,
) -> dict:
    """
    Move pins that disagree with the venue's real place. Changes events in
    place and fills `cache` ({"name|city": [lat, lng] or None}). Returns
    counts, and in "changed" the (source, source_id) of every pin it set, so
    the save writes them even if nothing else about the event changed.
    """
    stats = {"checked": 0, "moved": 0, "placed": 0, "looked_up": 0, "failed": 0}
    changed: set = set()
    todo = sorted((e for e in events if e.source in sources), key=lambda e: e.start_time)
    for e in todo:
        city = (e.city or "").strip()
        centre = city_centres.get(city.lower())
        at_centre = centre is not None and e.lat is not None and e.lng is not None and km(e.lat, e.lng, *centre) < 0.2
        near = centre or ((e.lat, e.lng) if e.lat is not None and e.lng is not None else None)
        if near is None:
            continue
        found = None
        for name in names_for(e.location_name, e.address):
            key = f"{name.lower()}|{city.lower()}"
            if key not in cache:
                if stats["looked_up"] >= budget:
                    break
                stats["looked_up"] += 1
                try:
                    hit = lookup(name, city, near, fetch)
                except Exception as err:  # network trouble: try again next run
                    stats["failed"] += 1
                    logger.debug(f"Photon failed for {name!r}: {err}")
                    continue
                cache[key] = list(hit) if hit else None
            if cache[key]:
                found = cache[key]
                break
        if not found:
            continue
        stats["checked"] += 1
        lat, lng = found
        if e.lat is None or e.lng is None or at_centre:
            stats["placed"] += 1
        elif km(e.lat, e.lng, lat, lng) > MOVE_KM:
            stats["moved"] += 1
            logger.info(f"Moved pin {km(e.lat, e.lng, lat, lng):.1f} km: {e.title[:60]!r} @ {e.location_name!r}")
        else:
            continue
        e.lat, e.lng = lat, lng
        changed.add((e.source, getattr(e, "source_id", None)))
    return {**stats, "changed": changed}
