"""
Parse an event's own page (District, AllEvents, Meetup) into:
  - about: the full description, with paragraph breaks restored
  - tickets: named ticket tiers with price, availability and sale end
  - details: duration, organizer, address, age, language, notes

Only what the page states is kept. No tier is invented: pages without
named tiers return an empty list and the UI says "see all options".
"""
from __future__ import annotations

import json
import re
from html import unescape
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

_LD_RE = re.compile(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', re.S | re.I)


def _ld_blocks(html: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for raw in _LD_RE.findall(html):
        try:
            data = json.loads(raw.strip())
        except ValueError:
            continue
        items = data if isinstance(data, list) else [data]
        for it in items:
            if isinstance(it, dict):
                out.extend(it.get("@graph", [it]) if "@graph" in it else [it])
    return out


def _types(block: Dict[str, Any]) -> List[str]:
    t = block.get("@type")
    return t if isinstance(t, list) else [t] if t else []


def _clean_text(s: str) -> str:
    s = unescape(unescape(s))
    s = re.sub(r"<\s*br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</\s*(p|div|li|h\d)\s*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("\r", "")
    s = re.sub(r"[ \t ]+", " ", s)
    lines = [ln.strip() for ln in s.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def restore_paragraphs(s: str) -> str:
    """District joins sentences with no space ("differently!Turn up"). Put a
    paragraph break where a sentence end runs straight into a new sentence,
    an emoji, or a capital letter, and keep existing line breaks."""
    s = _clean_text(s)
    s = re.sub(r"([.!?])(?=[A-Z☀-➿\U0001F300-\U0001FAFF])", r"\1\n", s)
    paras = [p.strip() for p in s.split("\n") if p.strip()]
    return "\n\n".join(paras)


def _price(v: Any) -> Optional[float]:
    try:
        f = float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None
    return f if f >= 0 else None


def _available(v: Any) -> Optional[bool]:
    if not v:
        return None
    s = str(v).rsplit("/", 1)[-1].lower()
    if s in ("instock", "limitedavailability", "onlineonly", "presale"):
        return True
    if s in ("soldout", "outofstock", "discontinued"):
        return False
    return None


def tickets_from_offers(offers: Any, event_name: str, source: str) -> List[Dict[str, Any]]:
    """Named Offer entries become tiers. AggregateOffer only contributes its
    nested offers. AllEvents repeats the event title as an Offer with a
    placeholder USD 0 price, so that pattern is ignored."""
    flat: List[Dict[str, Any]] = []

    def walk(o: Any) -> None:
        if isinstance(o, list):
            for x in o:
                walk(x)
        elif isinstance(o, dict):
            if "AggregateOffer" in _types(o):
                walk(o.get("offers"))
            else:
                flat.append(o)

    walk(offers)
    title = re.sub(r"\W+", " ", unescape(event_name or "")).strip().lower()
    tiers: List[Dict[str, Any]] = []
    seen = set()
    for o in flat:
        name = unescape(unescape(str(o.get("name") or ""))).strip()
        if not name:
            continue
        if re.sub(r"\W+", " ", name).strip().lower() == title:
            continue
        currency = (o.get("priceCurrency") or "INR").upper()
        price = _price(o.get("price") if o.get("price") not in (None, "") else o.get("lowPrice"))
        if source == "allevents" and currency != "INR":
            price = None  # placeholder currency on Indian listings
        key = (name.lower(), price)
        if key in seen:
            continue
        seen.add(key)
        tiers.append(
            {
                "name": name,
                "price": price,
                "currency": currency if price is not None else None,
                "available": _available(o.get("availability")),
                "sales_end": (o.get("availabilityEnds") or o.get("validThrough") or None) or None,
                "url": o.get("url") or None,
            }
        )
    tiers.sort(key=lambda t: (t["price"] is None, t["price"] or 0))
    return tiers


def _address(loc: Any) -> Optional[str]:
    if isinstance(loc, list):
        loc = loc[0] if loc else None
    if not isinstance(loc, dict):
        return None
    a = loc.get("address")
    if isinstance(a, str):
        return unescape(a).strip() or None
    if isinstance(a, dict):
        parts = [a.get("streetAddress"), a.get("addressLocality"), a.get("postalCode")]
        s = ", ".join(unescape(str(p)).strip() for p in parts if p)
        return s or None
    return None


def _faq_duration(blocks: List[Dict[str, Any]]) -> Optional[str]:
    for b in blocks:
        if "FAQPage" not in _types(b):
            continue
        for q in b.get("mainEntity") or []:
            name = str(q.get("name") or "").lower()
            if "how long" in name or "duration" in name:
                ans = _clean_text(str((q.get("acceptedAnswer") or {}).get("text") or ""))
                m = re.search(r"(\d+\s*(?:hours?|hrs?|minutes?|mins?)(?:\s*(?:and)?\s*\d+\s*(?:minutes?|mins?))?)", ans, re.I)
                if m:
                    return m.group(1)
    return None


def _age(text: str) -> Optional[str]:
    m = re.search(r"\b(\d{1,2})\s*\+|\bage(?:d)?\s*(?:limit|restriction)?[:\s]*(\d{1,2})\s*(?:\+|years|yrs)", text, re.I)
    if m:
        return f"{m.group(1) or m.group(2)}+"
    if re.search(r"all ages|for all ages", text, re.I):
        return "All ages"
    return None


def _notes(text: str) -> List[str]:
    notes = []
    if re.search(r"photo id|government id|aadhaar|valid id", text, re.I):
        notes.append("Photo ID required")
    if re.search(r"pets? (are )?not allowed|no pets", text, re.I):
        notes.append("No pets")
    if re.search(r"no re-?entry|re-?entry (is )?not allowed", text, re.I):
        notes.append("No re-entry")
    return notes


def parse_detail(html: str, source: str, event_name: str = "") -> Dict[str, Any]:
    blocks = _ld_blocks(html)
    ev = next((b for b in blocks if any(t and t.endswith("Event") for t in _types(b))), {}) or {}
    name = event_name or str(ev.get("name") or "")

    about_html: Optional[str] = None
    if source == "allevents":
        soup = BeautifulSoup(html, "lxml")
        el = soup.select_one(".event-description-html")
        if el:
            about_html = el.decode_contents()
    elif source == "meetup":
        soup = BeautifulSoup(html, "lxml")
        el = soup.select_one("#event-details, [data-testid='event-description']")
        if el:
            about_html = el.decode_contents()
    ld_desc = str(ev.get("description") or "")
    candidates = [c for c in (about_html, ld_desc) if c]
    about = max((restore_paragraphs(c) for c in candidates), key=len, default="") or None
    if about and len(about) > 6000:
        about = about[:5997].rstrip() + "..."

    organizer = ev.get("organizer")
    if isinstance(organizer, list):
        organizer = organizer[0] if organizer else None
    org_name = unescape(str(organizer.get("name"))).strip() if isinstance(organizer, dict) and organizer.get("name") else None

    lang = ev.get("inLanguage")
    if isinstance(lang, dict):
        lang = lang.get("name")
    text_for_rules = about or ""

    details: Dict[str, Any] = {
        "about": about,
        "duration": _faq_duration(blocks),
        "organizer": org_name,
        "address": _address(ev.get("location")),
        "age": _age(text_for_rules),
        "language": str(lang).strip() if lang else None,
        "notes": _notes(text_for_rules),
    }
    details = {k: v for k, v in details.items() if v not in (None, "", [])}
    return {"tickets": tickets_from_offers(ev.get("offers"), name, source), "details": details}
