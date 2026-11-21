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


def _norm(s: str) -> str:
    return re.sub(r"\W+", " ", unescape(unescape(s or ""))).strip().lower()


def _is_placeholder(name: str, titles: List[str]) -> bool:
    """An 'offer' that is just the event's own name is not a ticket tier.
    Titles on listings often carry extras ('... 2026 (Finance Summit)'), so
    a name contained in the title (or the reverse) counts too."""
    n = _norm(name)
    for t in titles:
        t = _norm(t)
        if not t:
            continue
        if n == t or (len(n) >= 8 and (n in t or t in n)):
            return True
    return False


def tickets_from_offers(offers: Any, event_name: str, source: str, also_titles: Optional[List[str]] = None) -> List[Dict[str, Any]]:
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
    titles = [event_name, *(also_titles or [])]
    tiers: List[Dict[str, Any]] = []
    seen = set()
    for o in flat:
        name = unescape(unescape(str(o.get("name") or ""))).strip()
        if not name:
            continue
        if _is_placeholder(name, titles):
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


def _find_key(node: Any, key: str, depth: int = 0) -> Optional[Dict[str, Any]]:
    """The first dict under `node` that has `key` (breadth isn't needed here)."""
    if depth > 12:
        return None
    if isinstance(node, dict):
        if key in node:
            return node
        for v in node.values():
            hit = _find_key(v, key, depth + 1)
            if hit is not None:
                return hit
    elif isinstance(node, list):
        for v in node:
            hit = _find_key(v, key, depth + 1)
            if hit is not None:
                return hit
    return None


def _luma_money(v: Any) -> tuple[Optional[float], Optional[str]]:
    """Luma prices come as {"cents": 49900, "currency": "inr"} or bare cents."""
    if isinstance(v, dict):
        cents = v.get("cents") if v.get("cents") is not None else v.get("amount")
        cur = v.get("currency")
        return (round(float(cents) / 100, 2) if isinstance(cents, (int, float)) else None,
                str(cur).upper() if cur else None)
    if isinstance(v, (int, float)):
        return round(float(v) / 100, 2), None
    return None, None


def luma_tickets(html: str) -> List[Dict[str, Any]]:
    """Ticket tiers from a Luma page (lu.ma / luma.com).

    Luma's pages carry no prices in their JSON-LD; the page data
    (__NEXT_DATA__) has `ticket_types` (each tier: name, cents, currency,
    free or paid) and `ticket_info` (overall free / price range / sold out).
    """
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return []
    try:
        data = json.loads(m.group(1))
    except ValueError:
        return []
    holder = _find_key(data, "ticket_info") or {}
    info = holder.get("ticket_info") or {}
    types_holder = holder if "ticket_types" in holder else (_find_key(data, "ticket_types") or {})
    sold_out = bool(info.get("is_sold_out") or holder.get("sold_out"))

    tiers: List[Dict[str, Any]] = []
    for t in types_holder.get("ticket_types") or []:
        if not isinstance(t, dict) or t.get("is_hidden"):
            continue
        if t.get("type") == "free":
            price, cur = 0.0, None
        else:
            price, cur = _luma_money({"cents": t.get("cents"), "currency": t.get("currency")})
            if price is None:  # pay-what-you-want with a floor
                price, cur = _luma_money({"cents": t.get("min_cents"), "currency": t.get("currency")})
        name = str(t.get("name") or "").strip() or "Ticket"
        left = t.get("spots_remaining")
        tiers.append({
            "name": name,
            "price": price,
            "currency": cur or (None if price == 0 else "INR"),
            "available": False if (sold_out or t.get("is_disabled") or left == 0) else None,
            "url": None,
        })
    if tiers:
        return tiers

    # No tier list: fall back to the summary.
    if info.get("is_free"):
        return [{"name": "Free", "price": 0.0, "currency": None, "available": False if sold_out else None, "url": None}]
    lo, cur = _luma_money(info.get("price"))
    hi, cur2 = _luma_money(info.get("max_price"))
    if lo is None:
        return []
    out = [{"name": "Ticket", "price": lo, "currency": cur or cur2 or "INR", "available": False if sold_out else None, "url": None}]
    if hi is not None and hi > lo:
        out.append({"name": "Ticket", "price": hi, "currency": cur2 or cur or "INR", "available": False if sold_out else None, "url": None})
    return out


def is_luma(url: Optional[str]) -> bool:
    return bool(url) and re.search(r"^https?://(www\.)?(lu\.ma|luma\.com)/", url or "") is not None


def parse_detail(html: str, source: str, event_name: str = "", url: Optional[str] = None) -> Dict[str, Any]:
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
    if about and len(about) > 12000:
        about = about[:11997].rstrip() + "..."

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
    tiers = tickets_from_offers(ev.get("offers"), name, source, [str(ev.get("name") or "")])
    if not tiers and (is_luma(url) or "__NEXT_DATA__" in html and "ticket_info" in html):
        tiers = luma_tickets(html)
    return {"tickets": tiers, "details": details}
