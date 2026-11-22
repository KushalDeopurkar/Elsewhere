from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.enrich.geocheck import check_pins, km, name_matches, names_for

MUMBAI = (19.076, 72.878)
CENTRES = {"mumbai": MUMBAI}
INORBIT = (19.1728, 72.8355)


def ev(title, lat, lng, loc, addr, source="allevents", hours=1):
    return SimpleNamespace(title=title, lat=lat, lng=lng, location_name=loc, address=addr, city="Mumbai",
                           source=source, start_time=datetime.now(timezone.utc) + timedelta(hours=hours))


def feature(name, lat, lng):
    return {"geometry": {"coordinates": [lng, lat]}, "properties": {"name": name}}


def fake(answers):
    calls = []

    def fetch(q, lat, lng):
        calls.append(q)
        return answers.get(q, [])

    fetch.calls = calls
    return fetch


def test_pin_at_sea_moves_to_the_venue():
    e = ev("Papon Live In Concert", 19.172909, 72.753502, "Inorbit Malad Parking Arena",
           "Inorbit Mall Malad, New Link Rd, Malad, Malad West, Mumbai, Maharashtra 400104, Mumbai")
    fetch = fake({"Inorbit Mall Malad, Mumbai": [feature("Inorbit Mall", *INORBIT)]})
    stats = check_pins([e], CENTRES, {}, fetch)
    assert stats["moved"] == 1
    assert km(e.lat, e.lng, *INORBIT) < 0.01
    assert stats["changed"] == {("allevents", None)}


def test_a_close_pin_stays():
    e = ev("Gig", 19.1731, 72.8361, "Inorbit Mall Malad", "Inorbit Mall Malad, Mumbai")
    stats = check_pins([e], CENTRES, {}, fake({"Inorbit Mall Malad, Mumbai": [feature("Inorbit Mall", *INORBIT)]}))
    assert stats["moved"] == 0 and (e.lat, e.lng) == (19.1731, 72.8361)


def test_a_guess_with_another_name_is_ignored():
    # Photon answered "Paytm office" with a government building in another part of town.
    e = ev("UX Lab", 19.11, 72.86, "Paytm office", "Paytm office, Mumbai")
    stats = check_pins([e], CENTRES, {}, fake({"Paytm office, Mumbai": [feature("Old Secretariat", 18.974, 72.817)]}))
    assert stats["moved"] == 0 and (e.lat, e.lng) == (19.11, 72.86)


def test_city_centre_pin_gets_the_venue():
    e = ev("Talk", *MUMBAI, "World Trade Centre", "World Trade Centre, Cuffe Parade")
    check_pins([e], CENTRES, {}, fake({"World Trade Centre, Mumbai": [feature("World Trade Centre", 18.9146, 72.8179)]}))
    assert (e.lat, e.lng) == (18.9146, 72.8179)


def test_same_name_far_away_is_ignored():
    e = ev("Show", 19.2, 72.85, "Phoenix Marketcity", "Phoenix Marketcity, Kurla")
    check_pins([e], CENTRES, {}, fake({"Phoenix Marketcity, Mumbai": [feature("Phoenix Marketcity", 12.99, 77.69)]}))
    assert (e.lat, e.lng) == (19.2, 72.85)


def test_other_sources_and_vague_venues_are_left_alone():
    a = ev("Meetup", 19.0, 72.7, "Inorbit Mall Malad", "x", source="district")
    b = ev("Secret", 19.0, 72.7, "Venue to be announced: Mumbai", "Venue to be announced")
    fetch = fake({})
    check_pins([a, b], CENTRES, {}, fetch)
    assert fetch.calls == [] and (a.lat, b.lat) == (19.0, 19.0)


def test_cache_and_budget():
    events = [ev(f"E{i}", 19.0, 72.7, f"Venue Alpha{i}", "", hours=i) for i in range(5)]
    cache = {}
    fetch = fake({})
    stats = check_pins(events, CENTRES, cache, fetch, budget=2)
    assert stats["looked_up"] == 2 and len(fetch.calls) == 2
    # The soonest events go first, and a cached miss isn't asked again.
    assert fetch.calls == ["Venue Alpha0, Mumbai", "Venue Alpha1, Mumbai"]
    fetch2 = fake({})
    check_pins(events, CENTRES, cache, fetch2, budget=2)
    assert fetch2.calls == ["Venue Alpha2, Mumbai", "Venue Alpha3, Mumbai"]


def test_names():
    assert names_for("Venue to be announced", "TBA") == []
    assert names_for("Inorbit Malad Parking Arena", "Inorbit Mall Malad, New Link Rd")[:2] == [
        "Inorbit Malad Parking Arena", "Inorbit Mall Malad"]
    assert name_matches("Inorbit Mall Malad", "Inorbit Mall")
    assert not name_matches("Paytm office", "Old Secretariat")
