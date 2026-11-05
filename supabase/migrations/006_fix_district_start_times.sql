-- 006: one-off correction for the District timezone bug (fixed in 786b70e).
--
-- The old parser read District's UTC timestamps ("...Z") as IST, storing
-- every District event 5h30m early (half marathons at 00:00, Comic Cons at
-- 05:30, instead of 05:30 and 11:00).
--
-- Safe to re-run: it only shifts while a known marathon still shows the
-- broken 00:00 start. After one run it reads 05:30 and nothing matches.
UPDATE events
SET start_time = start_time + interval '5 hours 30 minutes',
    end_time   = end_time   + interval '5 hours 30 minutes'
WHERE source = 'district'
  AND EXISTS (
    SELECT 1 FROM events s
    WHERE s.source = 'district'
      AND s.title = 'Gurugram Legends Half Marathon 2026'
      AND to_char(s.start_time AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') = '00:00'
  );
