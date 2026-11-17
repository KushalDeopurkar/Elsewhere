-- Adds keyword search to the map's bounding-box query.
--
-- The map could filter by category and day but not by text, so it was the
-- one surface where "hackathon near me" could not be asked. This reuses the
-- same generated search_vector column and GIN index that search_events
-- queries, so map search ranks and matches identically to the main feed —
-- one search behaviour across the product rather than two.
--
-- DROP first because the parameter list changes; CREATE OR REPLACE would
-- leave the previous signature behind as an overload.

DROP FUNCTION IF EXISTS events_in_bounds(
    DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
    TIMESTAMPTZ, TIMESTAMPTZ, event_category, INT
);

CREATE OR REPLACE FUNCTION events_in_bounds(
    south DOUBLE PRECISION,
    west DOUBLE PRECISION,
    north DOUBLE PRECISION,
    east DOUBLE PRECISION,
    from_time TIMESTAMPTZ DEFAULT NOW(),
    to_time TIMESTAMPTZ DEFAULT NULL,
    category_filter event_category DEFAULT NULL,
    query TEXT DEFAULT NULL,
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
        AND (
            events_in_bounds.query IS NULL
            OR e.search_vector @@ plainto_tsquery('english', events_in_bounds.query)
        )
    -- Still ordered by start_time, not relevance: on a map the list is a
    -- legend for what is plotted, and a chronological legend is easier to
    -- match against pins than a ranked one.
    ORDER BY e.start_time ASC
    LIMIT events_in_bounds.max_results;
END;
$$ LANGUAGE plpgsql;
