# Getting real events into EventEngine

The scrapers work. They cannot run in the Claude cloud container because its
network policy blocks `allevents.in` and `www.meetup.com`, and there are no
Supabase credentials there. **Run these steps on your own machine**, where
neither limit applies.

Budget about 20 minutes.

## 1. Supabase project

1. Create a free project at supabase.com.
2. Open the SQL editor and run the whole of `supabase/migrations/001_create_events.sql`.
   It creates the PostGIS extension, the `events` table, the RLS policies,
   six indexes and three functions the API calls.
3. Go to Project Settings then API and copy three values.

## 2. Backend credentials

Create `backend/.env`:

```
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_KEY=<anon / public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

The service role key is not optional. `events_all_service_role` is the only
RLS policy that permits writes, so without it every scraped event is silently
rejected while the scrapers report success.

Leave `EVENTBRITE_TOKEN` unset. That scraper's endpoint was retired by
Eventbrite in 2020 and is skipped automatically when no token is present.

## 3. Run a scrape

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

In a second terminal:

```bash
# One city first, to check it works before a full sweep
curl -X POST "http://localhost:8000/api/events/ingest?city=mumbai"
```

The response reports upserts per scraper:

```json
{"data": {"scrapers": {"allevents": 34, "meetup": 12}, "total_upserted": 46}}
```

Then the full sweep, which takes several minutes because the scrapers pause
politely between requests:

```bash
curl -X POST "http://localhost:8000/api/events/ingest"
```

The app also ingests on startup and every `SCRAPE_INTERVAL_MINUTES` (default 60).

## 4. Check the data

```bash
curl "http://localhost:8000/api/events/search?limit=5"
```

Then run the frontend against it:

```bash
cd frontend && npm install && npm run dev
```

Once the API returns rows, the "Demo data" badge disappears on its own. The
sample set is only used when the API is unreachable or returns nothing for an
unfiltered browse.

## 5. Deploy

Set the same three Supabase variables on your backend host, and point the
frontend's `BACKEND_URL` at it in Vercel's environment settings.

## If a scraper returns zero

Both scrapers read the sites' own markup, so a layout change breaks parsing.

- `allevents.py` reads Schema.org `application/ld+json` blocks.
- `meetup.py` reads the `__NEXT_DATA__` Apollo cache.

Check what the site returns now:

```bash
curl -s "https://allevents.in/mumbai/all" | grep -c "application/ld+json"
```

Zero means the markup moved and the selector in `_extract_ld_json_events`
needs updating. A non-zero count with no events means the field names inside
the JSON changed; print one block and compare against `_parse_event`.

Note that both sites' terms restrict automated collection for commercial use.
Fine for a hackathon project; worth a proper read before anything further.
