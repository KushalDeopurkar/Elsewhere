"""
Football fixtures: home matches of clubs in the cities we cover, from
openfootball (github.com/openfootball/football.json), a public-domain
(CC0) dataset of league fixtures kept up to date by volunteers.

openfootball has no stadiums, so STADIUMS maps each home club in a covered
city to its ground. A match becomes an event at the home club's stadium.
Kick-off times in the dataset can lag behind TV rescheduling (and some
leagues only have dates), so the description says to check the club.

No key needed. Leagues: Premier League, Championship, La Liga, Bundesliga,
Ligue 1, Eredivisie.
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, NamedTuple, Optional

from app.models.event import EventCategory, EventCreate
from app.scrapers.base import BaseScraper
from app.scrapers.world import get_json, new_client, to_utc

logger = logging.getLogger(__name__)

RAW = "https://raw.githubusercontent.com/openfootball/football.json/master/{season}/{code}.json"
HORIZON_DAYS = 60

# (dataset code, display name)
LEAGUES = [
    ("en.1", "Premier League"),
    ("en.2", "Championship"),
    ("es.1", "La Liga"),
    ("de.1", "Bundesliga"),
    ("fr.1", "Ligue 1"),
    ("nl.1", "Eredivisie"),
]


class Ground(NamedTuple):
    stadium: str
    city: str
    country: str
    lat: float
    lng: float
    tz: str
    site: str


_LDN = ("London", "GB", "Europe/London")
_MAN = ("Manchester", "GB", "Europe/London")
_BHM = ("Birmingham", "GB", "Europe/London")
_MAD = ("Madrid", "ES", "Europe/Madrid")
_BCN = ("Barcelona", "ES", "Europe/Madrid")


def _g(stadium: str, where: tuple, lat: float, lng: float, site: str) -> Ground:
    return Ground(stadium, where[0], where[1], lat, lng, where[2], site)


# Home grounds of clubs in covered cities, keyed by openfootball's team name.
STADIUMS: Dict[str, Ground] = {
    # London
    "Arsenal FC": _g("Emirates Stadium", _LDN, 51.5549, -0.1084, "https://www.arsenal.com/tickets"),
    "Chelsea FC": _g("Stamford Bridge", _LDN, 51.4817, -0.1910, "https://www.chelseafc.com/en/tickets"),
    "Tottenham Hotspur FC": _g("Tottenham Hotspur Stadium", _LDN, 51.6043, -0.0664, "https://www.tottenhamhotspur.com/tickets/"),
    "Crystal Palace FC": _g("Selhurst Park", _LDN, 51.3983, -0.0855, "https://www.cpfc.co.uk/tickets/"),
    "Fulham FC": _g("Craven Cottage", _LDN, 51.4749, -0.2217, "https://www.fulhamfc.com/tickets"),
    "Brentford FC": _g("Gtech Community Stadium", _LDN, 51.4907, -0.2886, "https://www.brentfordfc.com/en/tickets"),
    "West Ham United FC": _g("London Stadium", _LDN, 51.5387, -0.0166, "https://www.whufc.com/tickets"),
    "Charlton Athletic FC": _g("The Valley", _LDN, 51.4865, 0.0364, "https://www.cafc.co.uk/tickets"),
    "Millwall FC": _g("The Den", _LDN, 51.4859, -0.0509, "https://www.millwallfc.co.uk/tickets"),
    "Queens Park Rangers FC": _g("Loftus Road", _LDN, 51.5093, -0.2322, "https://www.qpr.co.uk/tickets"),
    "Watford FC": _g("Vicarage Road", _LDN, 51.6500, -0.4016, "https://www.watfordfc.com/tickets"),
    # Manchester
    "Manchester City FC": _g("Etihad Stadium", _MAN, 53.4831, -2.2004, "https://www.mancity.com/tickets"),
    "Manchester United FC": _g("Old Trafford", _MAN, 53.4631, -2.2913, "https://www.manutd.com/en/tickets-and-hospitality"),
    # Birmingham (West Midlands)
    "Aston Villa FC": _g("Villa Park", _BHM, 52.5092, -1.8848, "https://www.avfc.co.uk/tickets"),
    "Birmingham City FC": _g("St Andrew's", _BHM, 52.4757, -1.8682, "https://www.bcfc.com/tickets"),
    "West Bromwich Albion FC": _g("The Hawthorns", _BHM, 52.5090, -1.9639, "https://www.wba.co.uk/tickets"),
    # Madrid
    "Real Madrid CF": _g("Santiago Bernabéu", _MAD, 40.4531, -3.6883, "https://www.realmadrid.com/en-US/tickets"),
    "Club Atlético de Madrid": _g("Riyadh Air Metropolitano", _MAD, 40.4362, -3.5995, "https://www.atleticodemadrid.com/entradas"),
    "Rayo Vallecano de Madrid": _g("Estadio de Vallecas", _MAD, 40.3919, -3.6587, "https://www.rayovallecano.es/"),
    "Getafe CF": _g("Coliseum", _MAD, 40.3257, -3.7148, "https://www.getafecf.com/"),
    # Barcelona
    "FC Barcelona": _g("Spotify Camp Nou", _BCN, 41.3809, 2.1228, "https://www.fcbarcelona.com/en/tickets"),
    "RCD Espanyol de Barcelona": _g("RCDE Stadium", _BCN, 41.3479, 2.0757, "https://www.rcdespanyol.com/"),
    # Berlin, Paris, Amsterdam
    "1. FC Union Berlin": _g("Stadion An der Alten Försterei", ("Berlin", "DE", "Europe/Berlin"), 52.4573, 13.5681, "https://www.fc-union-berlin.de/en/tickets/"),
    "Paris Saint-Germain FC": _g("Parc des Princes", ("Paris", "FR", "Europe/Paris"), 48.8414, 2.2530, "https://billetterie.psg.fr/"),
    "Paris FC": _g("Stade Jean-Bouin", ("Paris", "FR", "Europe/Paris"), 48.8433, 2.2527, "https://www.parisfc.fr/"),
    "AFC Ajax": _g("Johan Cruijff ArenA", ("Amsterdam", "NL", "Europe/Amsterdam"), 52.3144, 4.9419, "https://www.ajax.nl/tickets/"),
}

_SUFFIX = re.compile(r"\s+(?:FC|AFC|CF|SC)$|^(?:AFC|FC|1\. FC|RCD|CA|SV|RC)\s+")


NAMES = {
    "Paris FC": "Paris FC",
    "Club Atlético de Madrid": "Atlético Madrid",
    "Rayo Vallecano de Madrid": "Rayo Vallecano",
    "Real Racing Club de Santander": "Racing Santander",
    "RC Deportivo La Coruña": "Deportivo La Coruña",
    "Real Sociedad de Fútbol": "Real Sociedad",
    "Real Betis Balompié": "Real Betis",
    "FC Twente '65": "FC Twente",
    "Brighton & Hove Albion FC": "Brighton",
    "Wolverhampton Wanderers FC": "Wolves",
    "Queens Park Rangers FC": "QPR",
}


def short_name(team: str) -> str:
    """'Manchester City FC' -> 'Manchester City', 'AFC Ajax' -> 'Ajax'."""
    if team in NAMES:
        return NAMES[team]
    name = team.strip()
    for _ in range(2):
        name = _SUFFIX.sub("", name).strip()
    return name.replace(" de Barcelona", "")


def season_for(today: date) -> str:
    """openfootball's folder for the season running on `today`: 2026-27 from July."""
    y = today.year if today.month >= 7 else today.year - 1
    return f"{y}-{(y + 1) % 100:02d}"


def parse_league(data: Dict[str, Any], code: str, league: str, now: Optional[datetime] = None) -> List[EventCreate]:
    now = now or datetime.now(timezone.utc)
    until = now + timedelta(days=HORIZON_DAYS)
    out: List[EventCreate] = []
    for m in data.get("matches") or []:
        home, away = m.get("team1"), m.get("team2")
        ground = STADIUMS.get(home or "")
        if not ground or not away or m.get("score"):
            continue
        try:
            day = datetime.strptime(m["date"], "%Y-%m-%d")
        except (KeyError, ValueError):
            continue
        timed = bool(re.fullmatch(r"\d{1,2}:\d{2}", m.get("time") or ""))
        if timed:
            hh, mm = (int(x) for x in m["time"].split(":"))
            local = day.replace(hour=hh, minute=mm)
        else:
            local = day  # date only: midnight local, shown as "time on listing"
        start = to_utc(local, ground.tz)
        # Keep today's matches until kick-off has passed (+2h for date-only).
        if (start + timedelta(hours=2 if timed else 24)) < now or start > until:
            continue
        title = f"{short_name(home)} vs {short_name(away)}"
        round_ = m.get("round") or ""
        when_note = (
            "Kick-off times can move for TV; check the club before you go."
            if timed
            else "Kick-off time not announced yet; the date can also shift by a day for TV."
        )
        out.append(
            EventCreate(
                title=title,
                description=f"{league}{' · ' + round_ if round_ else ''}. {when_note}",
                category=EventCategory.SPORTS,
                start_time=start,
                end_time=start + timedelta(hours=2) if timed else None,
                location_name=ground.stadium,
                city=ground.city,
                country=ground.country,
                lat=ground.lat,
                lng=ground.lng,
                url=ground.site,
                is_free=False,
                source="football",
                source_id=hashlib.sha1(f"{code}|{m['date']}|{home}|{away}".encode()).hexdigest()[:24],
                raw_data={"timezone": ground.tz, "league": league, "round": round_, "home": home, "away": away},
            )
        )
    return out


class FootballScraper(BaseScraper):
    name = "football"

    async def scrape(self, city: Optional[str] = None, **kwargs) -> List[EventCreate]:
        season = season_for(datetime.now(timezone.utc).date())
        out: List[EventCreate] = []
        async with new_client() as client:
            for code, league in LEAGUES:
                data = await get_json(client, RAW.format(season=season, code=code), pause=0.5)
                if not isinstance(data, dict):
                    self._log(f"{league} {season}: no data")
                    continue
                got = parse_league(data, code, league)
                if city:
                    got = [e for e in got if (e.city or "").lower() == city.lower()]
                self._log(f"{league}: {len(got)} home matches in covered cities")
                out.extend(got)
        return out
