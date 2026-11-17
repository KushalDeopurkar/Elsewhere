import json

from app.enrich.detail_parser import parse_detail, restore_paragraphs, tickets_from_offers
from app.enrich.enricher import price_update


def page(ld, body=""):
    blocks = "".join(f'<script type="application/ld+json">{json.dumps(b)}</script>' for b in ld)
    return f"<html><head>{blocks}</head><body>{body}</body></html>"


DISTRICT_EVENT = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": "Bollywood Night Ft. Teemeer &amp; The Cirkle | The Finch",
    "description": "Mumbai, get ready!Turn up the energy as Teemeer &amp; The Cirkle take over.Entry 21+ only. Photo ID required.",
    "organizer": {"@type": "Organization", "name": "PLUTUSONE HOSPITALITY PRIVATE LIMITED"},
    "location": {"@type": "Place", "name": "The Finch", "address": {"streetAddress": "Kurla West", "addressLocality": "Mumbai"}},
    "offers": {
        "@type": "AggregateOffer",
        "lowPrice": 500,
        "highPrice": 1500,
        "offers": [
            {"@type": "Offer", "name": "VIP", "price": 1500, "priceCurrency": "INR",
             "availability": "http://schema.org/InStock", "availabilityEnds": "2026-11-20T14:59:00.000Z", "url": "https://d/x"},
            {"@type": "Offer", "name": "Cover Ticket ", "price": 500, "priceCurrency": "INR",
             "availability": "http://schema.org/SoldOut", "url": "https://d/x"},
            {"@type": "Offer", "name": "VIP", "price": 1500, "priceCurrency": "INR"},
        ],
    },
}
FAQ = {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": "How long does it last?",
       "acceptedAnswer": {"@type": "Answer", "text": "It has a total duration of 2 Hours and 30 Minutes."}}]}


def test_district_tiers_details_and_paragraphs():
    out = parse_detail(page([DISTRICT_EVENT, FAQ]), "district")
    t = out["tickets"]
    assert [x["name"] for x in t] == ["Cover Ticket", "VIP"]  # sorted by price, deduped, trimmed
    assert t[0]["available"] is False and t[1]["available"] is True
    assert t[1]["sales_end"] == "2026-11-20T14:59:00.000Z"
    d = out["details"]
    assert d["organizer"].startswith("PLUTUSONE")
    assert d["duration"] == "2 Hours and 30 Minutes"
    assert d["address"] == "Kurla West, Mumbai"
    assert d["age"] == "21+"
    assert "Photo ID required" in d["notes"]
    assert "&amp;" not in d["about"]
    assert d["about"].split("\n\n")[:2] == ["Mumbai, get ready!", "Turn up the energy as Teemeer & The Cirkle take over."]


def test_allevents_body_description_and_placeholder_offer_ignored():
    ev = {
        "@type": "Event",
        "name": "India Finance &amp; Tech Summit 2026",
        "description": "India Finance & Tech Summit 2026",
        "offers": [
            {"@type": "AggregateOffer", "price": "0.00", "priceCurrency": "USD"},
            {"@type": "Offer", "name": "India Finance &amp; Tech Summit 2026", "price": 0, "priceCurrency": "USD",
             "availability": "https://schema.org/SoldOut"},
        ],
    }
    body = '<div class="event-description-html"><p>Powering the future of finance.</p><p>Seats are limited.</p></div>'
    out = parse_detail(page([ev], body), "allevents")
    assert out["tickets"] == []
    assert out["details"]["about"] == "Powering the future of finance.\n\nSeats are limited."


def test_allevents_real_tiers_but_usd_price_dropped():
    t = tickets_from_offers(
        [{"@type": "Offer", "name": "Early Bird", "price": 10, "priceCurrency": "USD"}], "Some Event", "allevents"
    )
    assert t == [{"name": "Early Bird", "price": None, "currency": None, "available": None, "sales_end": None, "url": None}]


def test_no_json_ld_is_safe():
    assert parse_detail("<html><body>nothing</body></html>", "district") == {"tickets": [], "details": {}}


def test_restore_paragraphs_keeps_decimals_and_urls():
    assert restore_paragraphs("Entry ₹2.5k only. Visit site.com now.") == "Entry ₹2.5k only. Visit site.com now."


def test_price_update_tracks_tiers():
    tiers = [{"price": 500.0, "currency": "INR"}, {"price": 1500.0, "currency": "INR"}]
    assert price_update({"price_min": 500, "price_max": None, "is_free": False}, tiers) == {"price_max": 1500.0}
    assert price_update({"price_min": None, "price_max": None, "is_free": False}, [{"price": 0.0, "currency": "INR"}]) == {
        "price_min": 0.0, "is_free": True}
    assert price_update({"price_min": 99}, []) == {}


def test_offer_named_like_a_longer_listing_title_is_not_a_tier():
    ev = {"@type": "Event", "name": "India Finance &amp; Tech Summit 2026",
          "offers": [{"@type": "Offer", "name": "India Finance &amp; Tech Summit 2026", "price": 0, "priceCurrency": "USD"}]}
    out = parse_detail(page([ev]), "allevents", "India Finance & Tech Summit 2026  (Finance Transformation Summit)")
    assert out["tickets"] == []


def test_short_tier_names_inside_title_are_kept():
    t = tickets_from_offers([{"@type": "Offer", "name": "VIP", "price": 999, "priceCurrency": "INR"}], "VIP Night at Club", "district")
    assert [x["name"] for x in t] == ["VIP"]
