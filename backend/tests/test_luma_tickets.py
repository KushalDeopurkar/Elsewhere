"""Luma pages carry their prices in __NEXT_DATA__, not JSON-LD."""

import json

from app.enrich.detail_parser import is_luma, luma_tickets, parse_detail
from app.enrich.enricher import price_update


def page(event: dict) -> str:
    data = {"props": {"pageProps": {"initialData": {"data": event}}}}
    return (
        '<html><head><script type="application/ld+json">{"@type":"Event","name":"X"}</script></head>'
        f'<body><script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script></body></html>'
    )


# Shape copied from a live Luma page (Silver Cross Grand Prix, 21 Nov 2026).
FREE = {
    "ticket_info": {"price": None, "is_free": True, "max_price": None, "is_sold_out": False,
                    "spots_remaining": 10, "is_near_capacity": False, "require_approval": False},
    "ticket_types": [{"api_id": "ttype-1", "cents": None, "currency": None, "name": "Standard",
                      "type": "free", "is_hidden": False, "is_disabled": False, "spots_remaining": None}],
    "sold_out": False,
}

PAID = {
    "ticket_info": {"price": {"cents": 49900, "currency": "inr"}, "is_free": False,
                    "max_price": {"cents": 149900, "currency": "inr"}, "is_sold_out": False},
    "ticket_types": [
        {"api_id": "a", "cents": 49900, "currency": "inr", "name": "Early bird", "type": "paid", "is_hidden": False},
        {"api_id": "b", "cents": 149900, "currency": "inr", "name": "VIP", "type": "paid", "is_hidden": False},
        {"api_id": "c", "cents": 1, "currency": "inr", "name": "Staff", "type": "paid", "is_hidden": True},
    ],
}


def test_free_luma_event_is_free():
    tiers = luma_tickets(page(FREE))
    assert tiers == [{"name": "Standard", "price": 0.0, "currency": None, "available": None, "url": None}]
    assert price_update({"price_min": None, "is_free": False}, tiers) == {"price_min": 0.0, "is_free": True}


def test_paid_luma_event_has_its_tiers_and_range():
    tiers = parse_detail(page(PAID), "ics", "X", "https://luma.com/abc123")["tickets"]
    assert [(t["name"], t["price"], t["currency"]) for t in tiers] == [("Early bird", 499.0, "INR"), ("VIP", 1499.0, "INR")]
    assert price_update({"price_min": None}, tiers) == {"price_min": 499.0, "price_max": 1499.0}


def test_sold_out_and_summary_fallback():
    ev = {"ticket_info": {"price": {"cents": 25000, "currency": "inr"}, "is_free": False, "max_price": None, "is_sold_out": True}}
    tiers = luma_tickets(page(ev))
    assert tiers[0]["price"] == 250.0 and tiers[0]["available"] is False


def test_is_luma():
    assert is_luma("https://lu.ma/x1") and is_luma("https://luma.com/x1")
    assert not is_luma("https://allevents.in/x")
