from app.enrich.images import generic_images, image_from_html
from app.services.event_service import split_by_image


def test_og_image_absolute_and_relative():
    html = '<head><meta property="og:image" content="/img/poster.jpg"></head>'
    assert image_from_html(html, "https://lu.ma/abc") == "https://lu.ma/img/poster.jpg"
    html2 = "<meta content='https://cdn.x/p.png' property='og:image'>"
    assert image_from_html(html2, "https://x.com/e") == "https://cdn.x/p.png"


def test_event_json_ld_wins_over_cards():
    html = (
        '<meta property="og:image" content="https://site/logo.png">'
        '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},'
        '{"@type":"MusicEvent","name":"Gig","image":[{"url":"https://cdn/gig.jpg"}]}]}</script>'
    )
    assert image_from_html(html, "https://site/e/1") == "https://cdn/gig.jpg"


def test_twitter_card_and_link_fallbacks():
    assert image_from_html('<meta name="twitter:image" content="https://t/i.jpg">', "https://a") == "https://t/i.jpg"
    assert image_from_html('<link rel="image_src" href="https://l/i.jpg">', "https://a") == "https://l/i.jpg"


def test_no_picture_and_junk():
    assert image_from_html("<html><title>x</title></html>", "https://a") is None
    assert image_from_html('<meta property="og:image" content="https://a/favicon.ico">', "https://a") is None
    assert image_from_html('<meta property="og:image" content="data:image/png;base64,xx">', "https://a") is None


def test_site_default_is_ignored():
    found = {str(i): "https://site/logo.png" for i in range(5)} | {"x": "https://site/own.jpg"}
    assert generic_images(found) == {"https://site/logo.png"}


def test_rows_without_a_picture_do_not_send_the_column():
    rows = [
        {"source": "a", "source_id": "1", "image_url": "https://p"},
        {"source": "a", "source_id": "2", "image_url": None},
    ]
    with_img, without = split_by_image(rows)
    assert with_img == [rows[0]]
    assert without == [{"source": "a", "source_id": "2"}]
