from app.scrapers.classify import guess_category, is_junk_title


def test_report_titles_land_in_right_category():
    cases = {
        "ANYMA presents AEDEN": "music",
        "Indian Racing Festival": "sports",
        "IPTA Natak: Aakhri Shama": "arts",
        "GLOBAL STARTUPS CLUB l STARTUP NETWORKING": "business",
        "Stand-up Comedy Night": "arts",
        "Villa party: Bollywood Nights": "nightlife",
        "Startup Art Mixer": "business",
    }
    for title, cat in cases.items():
        assert guess_category(title) == cat, title


def test_falls_back_to_default():
    assert guess_category("Something", default="other") == "other"


def test_junk_titles():
    assert is_junk_title("TEST")
    assert is_junk_title("Broken images - do not book")
    assert not is_junk_title("Testing Ground: live jazz")
