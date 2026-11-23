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


# Meetup's label is the category *page* an event was found on, and Meetup's
# search fills those pages with whatever is nearby: founders' networking on
# the music page, speed dating on the tech page. So it never decides alone.
MEETUP_CASES = [
    ("Primewise Founders Club Networking Event- Mumbai (Online)", None, "music", "business"),
    ("Primewise Founders Club Networking Event- Chennai (Online)", None, "food", "business"),
    ("Virtual Meet Up - Monthly Catch up", "Let's meet, chat and get to know each other.", "music", "community"),
    ("JAIPUR TOASTMASTERS CLUB", None, "music", "community"),
    ("Tuesday Night Dungeons and Dragons!", None, "music", "community"),
    ("Fayetteville Speed Dating, Matched by Age", None, "tech", "community"),
    # Real words still win, whatever page it was on.
    ("Workshop: Become a Senior AI Engineer", None, "music", "tech"),
    ("Saturday Group Run", None, "music", "sports"),
]


@pytest.mark.parametrize("title,description,hint,expected", MEETUP_CASES)
def test_meetup_page_label_never_decides_alone(title, description, hint, expected):
    assert categorize(title, description, hint, "meetup") == expected
