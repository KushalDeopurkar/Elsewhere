-- Adds the filters the discovery UI needs to be genuinely backed by data:
--   * is_online      — delivery format, so "Online" / "In person" can filter for real
--   * is_free filter — the column already existed; search_events had no filter for it
--   * sort_by        — relevance / date / distance ordering
--
-- search_events and get_event_by_id are DROPped rather than CREATE OR REPLACEd
-- because both gain an output column, and Postgres forbids changing a
-- function's return type in place.

-- Delivery format. Defaults FALSE so every existing row reads as in-person,
-- which is what the ingestion sources have been producing.
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: online events are the rarer case, so this keeps the
-- "online only" filter cheap without bloating the common in-person path.
CREATE INDEX IF NOT EXISTS idx_events_is_online ON events (is_online) WHERE is_online;

-- Supports the free-only filter.
CREATE INDEX IF NOT EXISTS idx_events_is_free ON events (is_free) WHERE is_free;


DROP FUNCTION IF EXISTS search_events(
    TEXT, event_category, DOUBLE PRECISION, DOUBLE PRECISION,
    DOUBLE PRECISION, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT
);

-- RPC: full-text + geo + facet search.
--
-- NOTE: the geo input parameters are named p_lat/p_lng (not lat/lng) because
-- PostgreSQL forbids an IN parameter and a RETURNS TABLE output column from
-- sharing a name, and this function's output table already has lat/lng
-- columns. Callers must pass p_lat/p_lng.
--
-- free_only and online_only are tri-state: NULL means "no constraint",
-- so an unset filter never narrows results.
--   online_only = TRUE  -> online events only
--   online_only = FALSE -> in-person events only
CREATE OR REPLACE FUNCTION search_events(
    query TEXT DEFAULT NULL,
    category_filter event_category DEFAULT NULL,
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL,
    radius_km DOUBLE PRECISION DEFAULT 25.0,
    from_time TIMESTAMPTZ DEFAULT NOW(),
    to_time TIMESTAMPTZ DEFAULT NULL,
    free_only BOOLEAN DEFAULT NULL,
    online_only BOOLEAN DEFAULT NULL,
    sort_by TEXT DEFAULT 'relevance',
    page_limit INT DEFAULT 50,
    page_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    category event_category,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    location_name TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    image_url TEXT,
    url TEXT,
    price_min NUMERIC,
    price_max NUMERIC,
    is_free BOOLEAN,
    is_online BOOLEAN,
    source TEXT,
    distance_km DOUBLE PRECISION,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.title, e.description, e.category,
        e.start_time, e.end_time, e.location_name,
        e.address, e.city, e.country,
        ST_Y(e.coords::geometry) AS lat,
        ST_X(e.coords::geometry) AS lng,
        e.image_url, e.url, e.price_min, e.price_max,
        e.is_free, e.is_online, e.source,
        CASE
            WHEN search_events.p_lat IS NOT NULL AND e.coords IS NOT NULL
            THEN ST_Distance(
                e.coords,
                ST_SetSRID(ST_MakePoint(search_events.p_lng, search_events.p_lat), 4326)::geography
            ) / 1000.0
            ELSE NULL
        END AS distance_km,
        CASE
            WHEN search_events.query IS NOT NULL
            THEN ts_rank(e.search_vector, plainto_tsquery('english', search_events.query))
            ELSE 0
        END AS relevance
    FROM events e
    WHERE
        (search_events.query IS NULL OR e.search_vector @@ plainto_tsquery('english', search_events.query))
        AND (search_events.category_filter IS NULL OR e.category = search_events.category_filter)
        AND e.start_time >= search_events.from_time
        AND (search_events.to_time IS NULL OR e.start_time <= search_events.to_time)
        AND (search_events.free_only IS NULL OR e.is_free = search_events.free_only)
        AND (search_events.online_only IS NULL OR e.is_online = search_events.online_only)
        AND (
            search_events.p_lat IS NULL
            OR e.coords IS NULL
            OR ST_DWithin(
                e.coords,
                ST_SetSRID(ST_MakePoint(search_events.p_lng, search_events.p_lat), 4326)::geography,
                search_events.radius_km * 1000
            )
        )
    ORDER BY
        -- Only the key matching sort_by is non-NULL, so the others no-op.
        -- An unknown sort_by value falls through to the start_time tiebreak.
        CASE WHEN search_events.sort_by = 'distance' AND search_events.p_lat IS NOT NULL
            THEN ST_Distance(
                e.coords,
                ST_SetSRID(ST_MakePoint(search_events.p_lng, search_events.p_lat), 4326)::geography
            )
        END ASC NULLS LAST,
        CASE WHEN search_events.sort_by = 'relevance' AND search_events.query IS NOT NULL
            THEN ts_rank(e.search_vector, plainto_tsquery('english', search_events.query))
        END DESC NULLS LAST,
        e.start_time ASC
    LIMIT search_events.page_limit
    OFFSET search_events.page_offset;
END;
$$ LANGUAGE plpgsql;


DROP FUNCTION IF EXISTS get_event_by_id(UUID);

-- RPC: get single event by ID (extracts lat/lng from coords)
CREATE OR REPLACE FUNCTION get_event_by_id(p_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    category event_category,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    location_name TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    image_url TEXT,
    url TEXT,
    price_min NUMERIC,
    price_max NUMERIC,
    is_free BOOLEAN,
    is_online BOOLEAN,
    source TEXT,
    source_id TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.title, e.description, e.category,
        e.start_time, e.end_time, e.location_name,
        e.address, e.city, e.country,
        ST_Y(e.coords::geometry) AS lat,
        ST_X(e.coords::geometry) AS lng,
        e.image_url, e.url, e.price_min, e.price_max,
        e.is_free, e.is_online, e.source, e.source_id,
        e.created_at, e.updated_at
    FROM events e
    WHERE e.id = get_event_by_id.p_id;
END;
$$ LANGUAGE plpgsql;
