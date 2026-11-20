"""One category per event, from what the event is."""

import pytest

from app.services.categorize import categorize

CASES = [
    # (title, description, scraper's label, expected)
    ("ANYMA presents AEDEN", None, None, "music"),
    ("Arijit Singh Live", None, "music", "music"),
    ("Swar Yatra - A Musical Ode to Maharashtra", None, None, "music"),
    ("Sunburn Arena ft. Martin Garrix", None, "music", "music"),
    ("Indian Racing Festival", None, None, "sports"),
    ("Mumbai City FC vs Bengaluru FC", None, "sports", "sports"),
    ("Vashi Chess and Rubik's cube Tournament", None, None, "sports"),
    ("Rock Climbing Day", None, None, "sports"),
    ("IPTA Natak: Aakhri Shama", None, None, "arts"),
    ("LAID NIGHT Standup Comedy Show", None, None, "arts"),
    ("The Dirty Talk @ 11.00pm", "A late-night stand-up comedy show.", "education", "arts"),
    ("Pottery Workshop for Beginners", None, "education", "arts"),
    ("GLOBAL STARTUPS CLUB l STARTUP NETWORKING", None, "music", "business"),
    ("Startup Art Mixer", None, None, "business"),
    ("AI Workshop: Build agents", None, "education", "tech"),
    ("Kids Coding Camp", None, "tech", "family"),
    ("Villa party: Bollywood Nights", None, "music", "nightlife"),
    ("Techno Night ft. Local DJs", None, None, "nightlife"),
    ("Food Festival at Jio Garden", None, None, "food"),
    ("Wine Tasting Evening", None, None, "food"),
    ("Morning Yoga by the Sea", None, None, "health"),
    ("Heritage Walk: Kala Ghoda", None, None, "outdoor"),
    ("Mumbai Midnight Cycling - Treks & Bikes", None, None, "outdoor"),
    ("Public Speaking Masterclass", None, None, "education"),
    ("Diwali Mela", None, None, "community"),
    ("Book Club: Murakami", None, None, "community"),
    ("Something random", None, None, "other"),
    ("Something random", None, "arts", "arts"),
]


@pytest.mark.parametrize("title,desc,hint,want", CASES)
def test_each_event_gets_its_category(title, desc, hint, want):
    assert categorize(title, desc, hint) == want


def test_structured_source_label_wins_a_close_call():
    # Ticketmaster says sports; the title alone looks like a party.
    assert categorize("Fan Party Night", None, "sports", "ticketmaster") == "sports"
