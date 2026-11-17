-- Event details from each event's own page (filled by the enrich pass in
-- backend/run_scrapers.py --enrich-only). Kept out of the scraper's upsert
-- so a 6-hourly re-scrape never wipes them.
--
--   tickets  : [{ "name": "VIP", "price": 1499, "currency": "INR",
--                 "available": true, "sales_end": "2026-11-20T14:59:00Z",
--                 "url": "https://..." }, ...]
--   details  : { "about": "full description", "duration": "2 hours",
--                "organizer": "...", "age": "18+", "language": "English",
--                "address": "...", "notes": ["Photo ID required", ...] }
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS tickets JSONB,
  ADD COLUMN IF NOT EXISTS details JSONB,
  ADD COLUMN IF NOT EXISTS details_fetched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS events_details_fetched_at_idx ON events (details_fetched_at NULLS FIRST);
