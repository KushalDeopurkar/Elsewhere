"""
Infer an event category from its own words.

The scrapers previously took the category from the listing page they happened
to be crawling. AllEvents is crawled on its "all" path, which is not in the
category map, so every event it produced fell through to `community`: one
colour on the map, one bucket in the filters, and nothing for cross-category
discovery to work with.

Reading the title and description instead gives a category per event rather
than per crawl. This is deterministic keyword scoring, not a classifier model.
Words in the title count for more than words in the description, because a
title names the event while a description often mentions things in passing.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional

from app.models.event import EventCategory

# Ordered longest-first within each list so multi-word phrases win over the
# single words they contain ("machine learning" before "learning").
KEYWORDS: Dict[EventCategory, List[str]] = {
    EventCategory.TECH: [
        "artificial intelligence", "machine learning", "deep learning", "data science",
        "open source", "cyber security", "cybersecurity", "blockchain", "web3",
        "hackathon", "devops", "kubernetes", "python", "javascript", "react",
        "robotics", "coding", "developer", "programming", "software", "startup weekend",
        "tech talk", "api", "cloud", "ai", "ml", "iot", "engineering", "technology",
    ],
    EventCategory.BUSINESS: [
        "pitch competition", "venture capital", "angel investor", "demo day",
        "entrepreneurship", "networking", "founders", "founder", "startup",
        "investor", "pitch", "business", "leadership", "career fair", "recruitment",
        "b2b", "sales", "marketing", "conference",
    ],
    EventCategory.EDUCATION: [
        "masterclass", "bootcamp", "certification", "workshop", "seminar", "webinar",
        "lecture", "tutorial", "training", "course", "class", "learn", "study",
        "exam", "scholarship", "university", "college", "school",
    ],
    EventCategory.ARTS: [
        "art exhibition", "photo walk", "open mic", "stand up", "standup",
        "exhibition", "gallery", "theatre", "theater", "drama", "poetry", "painting",
        "sculpture", "photography", "film", "cinema", "screening", "literature",
        "book launch", "comedy", "craft", "design", "museum", "art",
    ],
    EventCategory.SPORTS: [
        "football", "cricket", "basketball", "badminton", "marathon", "triathlon",
        "tournament", "championship", "league", "match", "esports", "gaming",
        "cycling", "swimming", "running", "fitness", "crossfit", "sports", "sport",
        "fc", "united vs", "premier league", "ipl", "isl", "kabaddi", "hockey",
        "athletics", "boxing", "wrestling", "golf", "tennis",
    ],
    EventCategory.MUSIC: [
        "live music", "music festival", "open decks", "concert", "gig", "band",
        "orchestra", "symphony", "dj", "rapper", "singer", "acoustic", "jazz",
        "techno", "house music", "music",
    ],
    EventCategory.FOOD: [
        "food festival", "wine tasting", "beer festival", "cooking class",
        "masterchef", "brunch", "tasting", "culinary", "restaurant", "cuisine",
        "baking", "barbecue", "food", "coffee",
    ],
    EventCategory.HEALTH: [
        "mental health", "sound healing", "meditation", "mindfulness", "wellness",
        "wellbeing", "therapy", "yoga", "pilates", "ayurveda", "nutrition", "detox",
    ],
    EventCategory.OUTDOOR: [
        "night trek", "trek", "trekking", "hiking", "hike", "camping", "cycling tour",
        "nature walk", "adventure", "outdoor", "wildlife", "safari", "kayaking",
    ],
    EventCategory.FAMILY: [
        "kids", "children", "toddler", "family", "parenting", "storytelling for",
    ],
    EventCategory.NIGHTLIFE: [
        "club night", "ladies night", "nightlife", "after party", "afterparty",
        "nightclub", "bar crawl", "party",
    ],
    EventCategory.COMMUNITY: [
        "volunteer", "volunteering", "charity", "fundraiser", "clean up", "cleanup",
        "social impact", "ngo", "donation", "board game", "language exchange",
        "meetup", "community",
    ],
}

TITLE_WEIGHT = 3
BODY_WEIGHT = 1


def _normalise(text: str) -> str:
    """Lowercase and reduce punctuation to spaces.

    Titles are full of hyphens and ampersands ("Clean-Up Drive", "Rock & Roll"),
    and without this a hyphen hides a phrase that is plainly present.
    """
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def _count(text: str, phrase: str) -> int:
    """Whole-word match, so 'ai' does not fire inside 'certain' or 'chair'."""
    return len(re.findall(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", text))


def classify(
    title: str,
    description: str = "",
    fallback: EventCategory = EventCategory.OTHER,
    hint: Optional[EventCategory] = None,
) -> EventCategory:
    """Best category for this event, or `fallback` when nothing matches.

    `hint` is the crawl's own guess. It breaks ties but never outranks a clear
    signal in the text, since the crawl path is often just "all".
    """
    t = _normalise(title)
    b = _normalise(description)

    scores: Dict[EventCategory, int] = {}
    for category, phrases in KEYWORDS.items():
        score = 0
        for phrase in phrases:
            needle = _normalise(phrase)
            score += _count(t, needle) * TITLE_WEIGHT
            score += _count(b, needle) * BODY_WEIGHT
        if score:
            scores[category] = score

    if not scores:
        return hint or fallback

    best = max(scores.values())
    winners = [c for c, s in scores.items() if s == best]
    if len(winners) > 1 and hint in winners:
        return hint
    return winners[0]
