-- Adds an upper time bound to the map's bounding-box query.
--
-- events_in_bounds could only express "from this moment onward", so the map
-- had no way to answer "what is on this Saturday in this area" while the
-- rest of the app is date-led. Filtering client-side is not equivalent: the
-- function returns at most max_results rows ordered by start_time, so a day
-- far enough ahead would fall outside the window entirely and the map would
-- read as empty when it is not.
--
-- DROP first because the parameter list changes; CREATE OR REPLACE would
-- leave the old signature in place as an overload.

DROP FUNCTION IF EXISTS events_in_bounds(
    DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
    TIMESTAMPTZ, event_category, INT
);

CREATE OR REPLACE FUNCTION events_in_bounds(
    south DOUBLE PRECISION,
    west DOUBLE PRECISION,
    north DOUBLE PRECISION,
    east DOUBLE PRECISION,
    from_time TIMESTAMPTZ DEFAULT NOW(),
    to_time TIMESTAMPTZ DEFAULT NULL,
    category_filter event_category DEFAULT NULL,
    max_results INT DEFAULT 200
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    category event_category,
    start_time TIMESTAMPTZ,
    location_name TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    is_free BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.title, e.category, e.start_time,
        e.location_name,
        ST_Y(e.coords::geometry) AS lat,
        ST_X(e.coords::geometry) AS lng,
        e.is_free
    FROM events e
    WHERE
        e.coords IS NOT NULL
        AND ST_Intersects(
            e.coords::geometry,
            ST_MakeEnvelope(
                events_in_bounds.west, events_in_bounds.south,
                events_in_bounds.east, events_in_bounds.north,
                4326
            )
        )
        AND e.start_time >= events_in_bounds.from_time
        AND (events_in_bounds.to_time IS NULL OR e.start_time <= events_in_bounds.to_time)
        AND (events_in_bounds.category_filter IS NULL OR e.category = events_in_bounds.category_filter)
    ORDER BY e.start_time ASC
    LIMIT events_in_bounds.max_results;
END;
$$ LANGUAGE plpgsql;
