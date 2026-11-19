# Global event sources

Elsewhere now pulls events from outside India too. Every source here is either an
official free API or open data, chosen because their terms allow it (unlike
Eventbrite, Resident Advisor, Meetup, Luma or AllEvents, which ban scraping).

| Source | Covers | Key needed | Secret names |
|---|---|---|---|
| Ticketmaster Discovery | US, Canada, Mexico, UK, Ireland, Europe, Australia, NZ: concerts, sports, theatre, family | Free | `TICKETMASTER_API_KEY` |
| SeatGeek | US and Canada: sports, concerts, theatre | Free | `SEATGEEK_CLIENT_ID` |
| Eventfinda | New Zealand, Australia, Singapore: arts, community, festivals | Free | `EVENTFINDA_USERNAME`, `EVENTFINDA_PASSWORD` |
| Que faire à Paris | Paris: culture, workshops, walks, kids, lots of free events | None (ODbL open data) | none |
| iCal feeds | Any public `.ics` calendar you list in `backend/feeds.json` | None | none |

A source whose secret isn't set is skipped with a log line, so you can add them one at a time.
Paris works straight away with no key.

## 1. Get the keys (about 10 minutes)

1. **Ticketmaster**: sign up at https://developer.ticketmaster.com, open *My Apps*, copy the
   **Consumer Key**. Default quota is 5,000 calls a day; a full run uses about 180.
2. **SeatGeek**: sign in at https://seatgeek.com/account/develop, create an app, copy the
   **Client ID**.
3. **Eventfinda**: register at https://www.eventfinda.co.nz/api/v2/index. You get a username
   and password for HTTP Basic auth. That account only works for New Zealand. For Australia
   register again at https://www.eventfinda.com.au/api/v2/index and add
   `EVENTFINDA_AU_USERNAME` / `EVENTFINDA_AU_PASSWORD`; for Singapore, https://www.eventfinda.sg
   with `EVENTFINDA_SG_USERNAME` / `EVENTFINDA_SG_PASSWORD`. Cities without an account are skipped. Standard access trims descriptions to about 220
   characters; ask them for full access when you want the rest.

## 2. Add them to GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**, one each:
`TICKETMASTER_API_KEY`, `SEATGEEK_CLIENT_ID`, `EVENTFINDA_USERNAME`, `EVENTFINDA_PASSWORD`.

The *Scrape Events* workflow already passes them in. Run it once by hand (**Actions → Scrape
Events → Run workflow**, source `global`) to fill the database now; after that the 6-hourly
schedule refreshes everything.

To try locally: put the same names in `backend/.env`, then

```
cd backend
python run_scrapers.py --source global --dry-run      # fetch only, print a sample
python run_scrapers.py --source ticketmaster --city London --dry-run
python run_scrapers.py --source global                # fetch and save
```

## 3. iCal feeds (optional)

Many venues, universities, libraries and Meetup/Luma groups publish a public calendar. Add
them to `backend/feeds.json`:

```json
[
  {"url": "https://example.org/events.ics", "name": "Example Hall",
   "city": "London", "country": "GB", "lat": 51.5074, "lng": -0.1278,
   "tz": "Europe/London", "category": "community"}
]
```

`lat`/`lng` place events whose feed has no coordinates; use the city's centre if unsure.

## Cities

Cities outside India live in two places that must match:
`backend/app/scrapers/world.py` (what gets fetched) and `frontend/src/lib/cities.ts`
(`WORLD`, what the city picker offers). To add a city, add it to both.

## Rules we follow

- Every event links back to its source's own page; nothing is sold on Elsewhere.
- Paris events carry the credit "Que faire à Paris, Ville de Paris (ODbL)" on the event page.
- The same event listed by two sources (say Ticketmaster and SeatGeek) is kept once, from
  the primary ticketer.
- Times show in the event city's own time zone, and prices in its currency.
