"""One category per event, decided the same way for every source.

Sources label events loosely (a URL section, a ticketing "segment", or
nothing), so the scraper's label is only a hint. The category is decided
here from what the event *is*, with these definitions:

  music      Live music is the point: concerts, gigs, DJ sets, music festivals.
  nightlife  Going out at night is the point: club nights, parties, pub crawls.
  arts       Performed or shown culture: theatre, comedy, film, dance shows,
             exhibitions, poetry, art and craft sessions.
  sports     Playing or watching sport and fitness: matches, races, runs,
             tournaments, gym and fitness classes.
  health     Wellbeing and personal growth: yoga, meditation, wellness,
             mental health, self-improvement.
  outdoor    Getting out of the city or into nature: treks, hikes, camping,
             trips, heritage and nature walks, rides.
  food       Food or drink is the point: tastings, food festivals, cooking,
             brunches, supper clubs.
  tech       Technology is the subject: hackathons, AI, coding, developer meetups.
  business   Work and money is the subject: startups, founders, networking,
             careers, investing, marketing, conferences.
  education  Learning a general skill or subject not covered above: lectures,
             classes, courses, language, public speaking, exams.
  family     Made for children or families: kids' shows and workshops, family days.
  community  People coming together: meetups, clubs, volunteering, cultural
             and religious celebrations, fairs and markets.
  other      None of the above.

How it decides: each category has strong words (what the event is about)
and weak words (its format: "workshop", "night", "festival"). Words in the
title count three times as much as words in the description. The topic
beats the format, so a "pottery workshop" is arts, an "AI workshop" is tech
and a "food festival" is food; only a plain "workshop" is education. Events
for children are family whatever their topic. The source's own label adds a
little weight, more when the source is structured (Ticketmaster's segments,
football fixtures). Ties go to the more specific category, in RANK order.
"""

from __future__ import annotations

import re
from typing import Dict, Optional, Tuple

STRONG, WEAK = 3, 1
TITLE_X, DESC_X = 3, 1
FAMILY_BOOST = 6  # "for kids" outweighs any topic

# category -> (strong words, weak words)
WORDS: Dict[str, Tuple[Tuple[str, ...], Tuple[str, ...]]] = {
    "music": (
        ("concert", "concerts", "live music", "gig", "gigs", "band", "live band", "orchestra",
         "symphony", "philharmonic", "choir", "unplugged", "acoustic", "album launch", "music festival",
         "edm", "techno", "house music", "hip hop", "hip-hop", "rap", "jazz", "blues", "rock",
         "metal", "indie", "sufi", "ghazal", "qawwali", "classical music", "carnatic", "hindustani",
         "bollywood music", "singer", "songwriter", "musician", "dj set", "world tour", "india tour",
         "live in concert", "recital", "jam session", "karaoke", "opera", "music", "musical"),
        ("live", "tour", "presents", "dj", "sessions", "festival"),
    ),
    "nightlife": (
        ("club night", "nightclub", "pub crawl", "bar crawl", "villa party", "pool party",
         "rooftop party", "afterparty", "after party", "rave", "ladies night", "bollywood night",
         "bollywood nights", "techno night", "nightlife", "brewery night"),
        ("party", "parties", "night", "nights", "late", "lounge", "club"),
    ),
    "arts": (
        ("stand-up", "standup", "stand up comedy", "comedy", "comedian", "open mic", "improv",
         "theatre", "theater", "natak", "ipta", "drama", "musical theatre", "screening",
         "film festival", "film", "cinema", "documentary", "exhibition", "gallery", "art show",
         "art fair", "museum", "painting", "pottery", "ceramics", "sketching", "calligraphy",
         "photography", "poetry", "spoken word", "storytelling", "book launch", "literature",
         "lit fest", "dance performance", "ballet", "kathak", "bharatanatyam", "odissi",
         "puppet", "mime", "magic show", "art", "arts", "craft", "crafts"),
        ("show", "performance", "creative", "play"),
    ),
    "sports": (
        ("match", "matches", "vs", "fixture", "tournament", "league", "championship", "cup",
         "marathon", "half marathon", "10k", "5k", "run", "running", "race", "racing", "cyclothon",
         "triathlon", "cricket", "football", "soccer", "basketball", "volleyball", "badminton",
         "tennis", "pickleball", "table tennis", "kabaddi", "hockey", "chess", "esports", "e-sports",
         "boxing", "mma", "wrestling", "motorsport", "f1", "golf", "swimming", "skating",
         "climbing", "rock climbing", "bouldering", "crossfit", "hiit", "bootcamp workout", "zumba", "fitness",
         "workout", "gym", "rubik's cube"),
        ("sports", "sport", "game", "games", "play", "team"),
    ),
    "health": (
        ("yoga", "meditation", "mindfulness", "breathwork", "sound bath", "sound healing",
         "wellness", "wellbeing", "well-being", "mental health", "therapy", "healing", "reiki",
         "pilates", "self-care", "self care", "journaling", "life coaching", "manifestation",
         "ayurveda", "nutrition", "retreat", "personal growth", "self improvement"),
        ("health", "mind", "calm", "balance"),
    ),
    "outdoor": (
        ("trek", "trekking", "hike", "hiking", "camping", "campsite", "kayaking", "rafting",
         "rappelling", "waterfall", "monsoon trail", "nature walk", "heritage walk", "walking tour",
         "birding", "bird watching", "stargazing", "road trip", "day trip", "weekend getaway",
         "getaway", "cycling", "cycle ride", "bike ride", "ride", "beach cleanup", "safari",
         "paragliding", "scuba", "snorkelling"),
        ("outdoor", "outdoors", "trip", "tour", "walk", "adventure", "explore", "trail", "travel"),
    ),
    "food": (
        ("food festival", "food fest", "food walk", "tasting", "wine tasting", "beer tasting",
         "whisky", "whiskey", "brunch", "supper club", "pop-up dinner", "dinner", "chef's table",
         "cooking", "cooking class", "baking", "bake", "cook-off", "barbecue", "bbq", "street food",
         "coffee", "tea tasting", "mixology", "cocktail", "cocktails", "food", "foodie", "wine",
         "beer", "brewery", "cuisine"),
        ("eat", "drink", "drinks", "menu", "kitchen"),
    ),
    "tech": (
        ("hackathon", "ai", "artificial intelligence", "machine learning", "ml", "genai",
         "generative ai", "llm", "llms", "data science", "coding", "code", "programming",
         "developer", "developers", "devfest", "gdg", "python", "javascript", "react", "web3",
         "blockchain", "crypto", "cloud", "aws", "devops", "cybersecurity", "robotics", "iot",
         "product management", "ux", "ui design", "no-code", "open source", "tech"),
        ("digital", "software", "app", "apps"),
    ),
    "business": (
        ("startup", "startups", "founder", "founders", "entrepreneur", "entrepreneurs",
         "entrepreneurship", "networking", "investor", "investors", "venture capital", "vc",
         "pitch", "pitch night", "business", "b2b", "sales", "marketing", "branding", "finance",
         "investing", "stock market", "trading", "real estate", "career", "careers", "job fair",
         "hiring", "leadership", "conference", "summit", "expo", "trade show", "industry"),
        ("professionals", "growth", "strategy"),
    ),
    "education": (
        ("lecture", "lectures", "seminar", "webinar", "course", "masterclass", "bootcamp",
         "language class", "public speaking", "debate", "quiz", "spelling bee", "olympiad",
         "exam", "admissions", "study abroad", "upsc", "ielts", "gre", "science", "history",
         "philosophy", "economics", "learning"),
        ("workshop", "workshops", "class", "classes", "talk", "talks", "session", "learn",
         "training", "school", "college", "university"),
    ),
    "family": (
        ("kids", "kid", "children", "child", "toddler", "toddlers", "family day", "for families",
         "family fun", "parents and kids", "parenting", "storytime", "story time", "baby",
         "babies", "teens", "summer camp for kids"),
        ("family", "families", "junior", "little ones"),
    ),
    "community": (
        ("meetup", "meet-up", "volunteer", "volunteering", "community", "club meet", "book club",
         "fair", "mela", "flea market", "bazaar", "carnival", "celebration", "diwali", "holi",
         "navratri", "garba", "dandiya", "eid", "christmas", "ganesh", "durga puja", "pride",
         "cleanup", "fundraiser", "charity", "social", "mixer", "speed dating", "singles"),
        ("fest", "festival", "gathering", "together", "people"),
    ),
}

# Ties go to the earlier, more specific category.
RANK = ("family", "tech", "business", "music", "arts", "sports", "food", "health", "outdoor",
        "nightlife", "education", "community", "other")

# How much a source's own label counts. Structured feeds know their events.
HINT_WEIGHT = {"ticketmaster": 5, "seatgeek": 5, "football": 9, "eventfinda": 3, "meetup": 0}
DEFAULT_HINT_WEIGHT = 2

# Sources whose label says nothing about the event: Meetup's is the category
# page the event turned up on, and its search fills every page with whatever
# is nearby (founders' networking under music, speed dating under tech).
# With no words to go on, such an event is a meetup: community.
UNTRUSTED_HINT = {"meetup": "community"}
UNTRUSTED_BASE = 2


# Every phrase once, longest first, so "rock climbing" is read before "rock"
# and "food festival" before "festival": a phrase's words aren't counted
# again by a shorter phrase in another category.
_PHRASES = sorted(
    {(w, cat, kind) for cat, (strong, weak) in WORDS.items() for kind, ws in (("s", strong), ("w", weak)) for w in ws},
    key=lambda p: -len(p[0]),
)
_ALL = re.compile(
    r"(?<![a-z0-9])(" + "|".join(re.escape(w) for w, _, _ in _PHRASES) + r")(?![a-z0-9])"
)
_LOOKUP: Dict[str, list] = {}
for _w, _cat, _kind in _PHRASES:
    _LOOKUP.setdefault(_w, []).append((_cat, _kind))


def _norm(text: Optional[str], limit: int) -> str:
    t = (text or "")[:limit].lower()
    t = re.sub(r"[_/|•·:,;!?()\[\]\"“”]+", " ", t)
    return re.sub(r"\s+", " ", t)


def _hits(text: str):
    """(category, kind) for each distinct phrase found, longest match wins."""
    seen = set()
    for m in _ALL.finditer(text):
        w = m.group(1)
        if w in seen:
            continue
        seen.add(w)
        for cat, kind in _LOOKUP[w]:
            yield cat, kind


def scores(title: str, description: Optional[str] = None, hint: Optional[str] = None,
           source: Optional[str] = None) -> Dict[str, int]:
    """Points per category; exposed for tests and debugging.

    Topic words count three times in the title and once in the description.
    Format words count once wherever they are: they only break ties.
    """
    t, d = _norm(title, 300), _norm(description, 600)
    out: Dict[str, int] = {}
    family_in_title = False
    for text, x in ((t, TITLE_X), (d, DESC_X)):
        if not text:
            continue
        for cat, kind in _hits(text):
            out[cat] = out.get(cat, 0) + (STRONG * x if kind == "s" else WEAK)
            if cat == "family" and kind == "s" and x == TITLE_X:
                family_in_title = True
    if family_in_title:
        out["family"] += FAMILY_BOOST
    # An untrusted source's events are meetups first: a stray weak word
    # ("club", "night") alone doesn't outweigh that; a real topic does.
    base = UNTRUSTED_HINT.get((source or "").lower())
    if base:
        out[base] = out.get(base, 0) + UNTRUSTED_BASE
    weight = HINT_WEIGHT.get((source or "").lower(), DEFAULT_HINT_WEIGHT)
    if hint and hint not in ("other", "community") and weight:
        out[hint] = out.get(hint, 0) + weight
    return out


def categorize(title: str, description: Optional[str] = None, hint: Optional[str] = None,
               source: Optional[str] = None) -> str:
    """The single category for an event."""
    pts = scores(title, description, hint, source)
    if not pts:
        fallback = UNTRUSTED_HINT.get((source or "").lower())
        if fallback:
            return fallback
        return hint if hint in WORDS else "other"
    best = max(pts.values())
    for cat in RANK:
        if pts.get(cat) == best:
            return cat
    return "other"
