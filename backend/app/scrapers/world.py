"""
Cities outside India that the global sources cover, and small helpers the
global scrapers share (time zones, geohash, polite JSON fetching).

Keep this list in step with frontend/src/lib/cities.ts (WORLD): the site
searches a radius around these same points, so events stored here land
inside the city the person picks.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import httpx

logger = logging.getLogger(__name__)

USER_AGENT = "ElsewhereBot/1.0 (+https://elsewhere-in.vercel.app; event discovery)"


@dataclass(frozen=True)
class WorldCity:
    name: str
    country: str  # ISO 3166-1 alpha-2
    lat: float
    lng: float
    tz: str
    sources: Tuple[str, ...] = field(default=("ticketmaster",))


_TM = ("ticketmaster",)
_TM_SG = ("ticketmaster", "seatgeek")
_TM_EF = ("ticketmaster", "eventfinda")

WORLD_CITIES: List[WorldCity] = [
    # North America
    WorldCity("New York", "US", 40.7128, -74.0060, "America/New_York", _TM_SG),
    WorldCity("Los Angeles", "US", 34.0522, -118.2437, "America/Los_Angeles", _TM_SG),
    WorldCity("Chicago", "US", 41.8781, -87.6298, "America/Chicago", _TM_SG),
    WorldCity("San Francisco", "US", 37.7749, -122.4194, "America/Los_Angeles", _TM_SG),
    WorldCity("Austin", "US", 30.2672, -97.7431, "America/Chicago", _TM_SG),
    WorldCity("Miami", "US", 25.7617, -80.1918, "America/New_York", _TM_SG),
    WorldCity("Seattle", "US", 47.6062, -122.3321, "America/Los_Angeles", _TM_SG),
    WorldCity("Boston", "US", 42.3601, -71.0589, "America/New_York", _TM_SG),
    WorldCity("Washington DC", "US", 38.9072, -77.0369, "America/New_York", _TM_SG),
    WorldCity("Las Vegas", "US", 36.1699, -115.1398, "America/Los_Angeles", _TM_SG),
    WorldCity("Nashville", "US", 36.1627, -86.7816, "America/Chicago", _TM_SG),
    WorldCity("Toronto", "CA", 43.6532, -79.3832, "America/Toronto", _TM_SG),
    WorldCity("Vancouver", "CA", 49.2827, -123.1207, "America/Vancouver", _TM_SG),
    WorldCity("Montreal", "CA", 45.5019, -73.5674, "America/Toronto", _TM_SG),
    WorldCity("Mexico City", "MX", 19.4326, -99.1332, "America/Mexico_City", _TM),
    # UK and Ireland
    WorldCity("London", "GB", 51.5074, -0.1278, "Europe/London", _TM),
    WorldCity("Manchester", "GB", 53.4808, -2.2426, "Europe/London", _TM),
    WorldCity("Birmingham", "GB", 52.4862, -1.8904, "Europe/London", _TM),
    WorldCity("Glasgow", "GB", 55.8642, -4.2518, "Europe/London", _TM),
    WorldCity("Dublin", "IE", 53.3498, -6.2603, "Europe/Dublin", _TM),
    # Europe
    WorldCity("Paris", "FR", 48.8566, 2.3522, "Europe/Paris", ("ticketmaster", "paris")),
    WorldCity("Berlin", "DE", 52.5200, 13.4050, "Europe/Berlin", _TM),
    WorldCity("Amsterdam", "NL", 52.3676, 4.9041, "Europe/Amsterdam", _TM),
    WorldCity("Madrid", "ES", 40.4168, -3.7038, "Europe/Madrid", _TM),
    WorldCity("Barcelona", "ES", 41.3874, 2.1686, "Europe/Madrid", _TM),
    WorldCity("Brussels", "BE", 50.8503, 4.3517, "Europe/Brussels", _TM),
    WorldCity("Copenhagen", "DK", 55.6761, 12.5683, "Europe/Copenhagen", _TM),
    WorldCity("Stockholm", "SE", 59.3293, 18.0686, "Europe/Stockholm", _TM),
    # Oceania and Asia
    WorldCity("Sydney", "AU", -33.8688, 151.2093, "Australia/Sydney", _TM_EF),
    WorldCity("Melbourne", "AU", -37.8136, 144.9631, "Australia/Melbourne", _TM_EF),
    WorldCity("Brisbane", "AU", -27.4698, 153.0251, "Australia/Brisbane", _TM_EF),
    WorldCity("Perth", "AU", -31.9505, 115.8605, "Australia/Perth", _TM_EF),
    WorldCity("Auckland", "NZ", -36.8485, 174.7633, "Pacific/Auckland", _TM_EF),
    WorldCity("Wellington", "NZ", -41.2865, 174.7762, "Pacific/Auckland", _TM_EF),
    WorldCity("Christchurch", "NZ", -43.5321, 172.6362, "Pacific/Auckland", _TM_EF),
    WorldCity("Singapore", "SG", 1.3521, 103.8198, "Asia/Singapore", ("eventfinda",)),
]


def cities_for(source: str, only: Optional[str] = None) -> List[WorldCity]:
    """Cities a source covers, optionally narrowed to one by name."""
    out = [c for c in WORLD_CITIES if source in c.sources]
    if only:
        key = only.strip().lower().replace("-", " ")
        out = [c for c in out if c.name.lower() == key]
    return out


def to_utc(local: datetime, tz: str) -> datetime:
    """A naive local wall-clock time in `tz`, as an aware UTC datetime."""
    if local.tzinfo is None:
        local = local.replace(tzinfo=ZoneInfo(tz))
    return local.astimezone(timezone.utc)


def parse_iso(s: Optional[str]) -> Optional[datetime]:
    """ISO 8601 with a Z, an offset or nothing (then UTC)."""
    if not s:
        return None
    try:
        d = datetime.fromisoformat(s.strip().replace("Z", "+00:00").replace(" ", "T", 1))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


_B32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def geohash(lat: float, lng: float, precision: int = 7) -> str:
    lat_r, lng_r = [-90.0, 90.0], [-180.0, 180.0]
    out, bits, ch, even = [], 0, 0, True
    while len(out) < precision:
        rng, val = (lng_r, lng) if even else (lat_r, lat)
        mid = (rng[0] + rng[1]) / 2
        if val >= mid:
            ch |= 1 << (4 - bits)
            rng[0] = mid
        else:
            rng[1] = mid
        even = not even
        bits += 1
        if bits == 5:
            out.append(_B32[ch])
            bits, ch = 0, 0
    return "".join(out)


_TAGS = re.compile(r"<[^>]+>")


def strip_html(s: Optional[str], limit: int = 4000) -> Optional[str]:
    if not s:
        return None
    t = re.sub(r"\s+", " ", _TAGS.sub(" ", s)).strip()
    return t[:limit] or None


def to_float(v: Any) -> Optional[float]:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f else None  # drop NaN


async def get_json(
    client: httpx.AsyncClient,
    url: str,
    params: Optional[Dict[str, Any]] = None,
    *,
    tries: int = 3,
    pause: float = 0.25,
    **kwargs: Any,
) -> Optional[Any]:
    """GET JSON politely: a pause before each call, backing off on 429/5xx.
    Returns None (and logs) instead of raising, so one bad page doesn't
    sink a whole run."""
    for attempt in range(tries):
        await asyncio.sleep(pause * (2 ** attempt))
        try:
            r = await client.get(url, params=params, **kwargs)
        except httpx.HTTPError as e:
            logger.warning(f"GET {url} failed: {e}")
            continue
        if r.status_code == 429 or r.status_code >= 500:
            await asyncio.sleep(1.5 * (attempt + 1))
            continue
        if r.status_code >= 400:
            logger.warning(f"GET {url} -> {r.status_code}: {r.text[:200]}")
            return None
        try:
            return r.json()
        except ValueError:
            logger.warning(f"GET {url}: not JSON")
            return None
    return None


def new_client(**kwargs: Any) -> httpx.AsyncClient:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    headers.update(kwargs.pop("headers", {}))
    return httpx.AsyncClient(timeout=30, headers=headers, follow_redirects=True, **kwargs)
