-- 006: one-off correction for the District timezone bug (fixed in 786b70e).
--
-- The old parser read District's UTC timestamps ("...Z") as IST, storing
-- every District event 5h30m early (half marathons at 00:00, Comic Cons at
-- 05:30 instead of 05:30 and 11:00).
--
-- Only rows last written before the fixed scraper shipped are shifted.
-- Running this sets updated_at to now (trigger), so a second run matches
-- nothing: it is safe to re-run. Rows a fixed scrape rewrites are skipped.
UPDATE events
SET start_time = start_time + interval '5 hours 30 minutes',
    end_time   = end_time   + interval '5 hours 30 minutes'
WHERE source = 'district'
  AND updated_at < timestamptz '2026-11-05 20:30:00+00';
