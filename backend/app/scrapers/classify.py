"""Title-based category guess shared by scrapers.

Rules run in order and match whole words, so "startup" never reads as
"art" and "racing festival" lands in sports before the generic "fest".
"""

import re
from typing import Optional, Tuple

# (category, words). First rule with a hit wins, so specific beats generic.
RULES: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("business", ("startup", "startups", "founder", "founders", "networking",
                  "entrepreneur", "entrepreneurs", "investor", "investors",
                  "pitch night", "conference", "summit", "expo", "b2b")),
    ("tech", ("hackathon", "ai", "machine learning", "coding", "developer",
              "developers", "web3", "blockchain", "tech meetup", "devfest")),
    ("sports", ("racing", "race", "marathon", "half marathon", "cricket",
                "football", "match", "tournament", "league", "cyclothon",
                "motorsport", "f1", "kabaddi", "badminton", "pickleball", "sports")),
    ("arts", ("stand-up", "standup", "stand up", "comedy", "comedian", "open mic",
              "theatre", "theater", "natak", "ipta", "drama", "musical theatre",
              "exhibition", "gallery", "art", "arts", "screening", "film", "poetry",
              "dance performance", "ballet", "kathak", "bharatanatyam")),
    ("nightlife", ("villa party", "pool party", "bollywood night", "bollywood nights",
                   "techno night", "club night", "nightlife", "party", "rave", "dj night",
                   "ladies night", "afterparty", "after party")),
    ("music", ("concert", "concerts", "live music", "gig", "world tour", "india tour", "presents",
               "unplugged", "live band", "band", "orchestra", "symphony", "jam",
               "music", "festival of music", "edm", "dj", "singer", "album launch")),
    ("food", ("brunch", "food", "foodie", "tasting", "wine", "beer", "cocktail",
              "dinner", "supper club", "cook-off", "bake")),
    ("health", ("yoga", "meditation", "wellness", "fitness", "zumba", "breathwork",
                "sound bath", "pilates")),
    ("outdoor", ("trek", "trekking", "hike", "hiking", "camping", "kayaking",
                 "trail", "nature walk", "birding")),
    ("family", ("kids", "children", "family", "toddler", "parents")),
    ("education", ("workshop", "masterclass", "class", "course", "talk", "lecture",
                   "seminar", "webinar", "bootcamp")),
    ("community", ("fest", "festival", "fair", "carnival", "mela", "flea market",
                   "meetup", "volunteer", "volunteering")),
)

_COMPILED = tuple(
    (cat, re.compile(r"(?<![a-z0-9])(?:" + "|".join(re.escape(w) for w in words) + r")(?![a-z0-9])"))
    for cat, words in RULES
)


def guess_category(*texts: Optional[str], default: str = "community") -> str:
    """Return the first rule's category whose words appear in the texts."""
    blob = " ".join(t for t in texts if t).lower()
    blob = re.sub(r"[_/|]+", " ", blob)
    for cat, rx in _COMPILED:
        if rx.search(blob):
            return cat
    return default



_JUNK_WHOLE = re.compile(
    r"^(test|testing|test event|sample event|dummy|dummy event|untitled|untitled event"
    r"|tbd|tba|placeholder|asdf\w*)$"
)
_JUNK_PART = re.compile(
    r"\b(broken images?|do not (book|attend|use)|lorem ipsum|test listing|qa test)\b"
)


def is_junk_title(title: Optional[str]) -> bool:
    """Listings that are plainly tests or placeholders, not events."""
    t = re.sub(r"[^a-z0-9 ]+", " ", (title or "").lower())
    t = re.sub(r"\s+", " ", t).strip()
    return len(t) < 2 or bool(_JUNK_WHOLE.match(t) or _JUNK_PART.search(t))
