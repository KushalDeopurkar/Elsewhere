import pytest

from app.models.event import EventCategory
from app.scrapers.classify import classify


@pytest.mark.parametrize(
    "title,expected",
    [
        ("BuildAI Mumbai: 24-Hour AI Hackathon", EventCategory.TECH),
        ("Python Workshop for Beginners", EventCategory.TECH),
        ("Founder Pitch Night: Seed Stage", EventCategory.BUSINESS),
        ("Art Exhibition: Modern Bombay", EventCategory.ARTS),
        ("Open Mic Comedy Night", EventCategory.ARTS),
        ("Mumbai City FC vs Bengaluru FC", EventCategory.SPORTS),
        ("Sunrise Yoga at Shivaji Park", EventCategory.HEALTH),
        ("Night Trek to Rajmachi Fort", EventCategory.OUTDOOR),
        ("Wine Tasting Evening", EventCategory.FOOD),
        ("Techno Night at the Warehouse", EventCategory.MUSIC),
        ("Beach Clean-Up Drive", EventCategory.COMMUNITY),
    ],
)
def test_classifies_from_the_title(title, expected):
    assert classify(title) == expected


def test_hyphens_do_not_hide_a_phrase():
    """Titles are full of hyphens; "Clean-Up" must still match "clean up"."""
    assert classify("Beach Clean-Up Drive") == EventCategory.COMMUNITY
    assert classify("Beach Clean Up Drive") == EventCategory.COMMUNITY


def test_short_words_need_a_whole_word_match():
    """"ai" must not fire inside "chair" or "certain"."""
    assert classify("Chair Repair Afternoon") != EventCategory.TECH
    assert classify("A Certain Kind of Evening") != EventCategory.TECH


def test_description_counts_for_less_than_the_title():
    """A title about one thing beats a passing mention in the body."""
    got = classify(
        "Yoga and Meditation Morning",
        "Afterwards we will talk about software and programming over coffee.",
    )
    assert got == EventCategory.HEALTH


def test_falls_back_when_nothing_matches():
    assert classify("Some Totally Unknown Thing") == EventCategory.OTHER
    assert (
        classify("Some Totally Unknown Thing", fallback=EventCategory.COMMUNITY)
        == EventCategory.COMMUNITY
    )


def test_hint_only_breaks_ties():
    """A clear signal in the text outranks the crawl path's guess."""
    assert (
        classify("AI and Robotics Hackathon", hint=EventCategory.MUSIC)
        == EventCategory.TECH
    )
    # Nothing in the text, so the hint stands.
    assert (
        classify("Saturday Gathering", hint=EventCategory.MUSIC)
        == EventCategory.MUSIC
    )
