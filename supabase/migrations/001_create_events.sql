-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Event categories enum
CREATE TYPE event_category AS ENUM (
    'music', 'tech', 'sports', 'arts', 'food',
    'business', 'health', 'education', 'community',
    'nightlife', 'family', 'outdoor', 'other'
);

-- Events table
CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category event_category NOT NULL DEFAULT 'other',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location_name TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'US',
    coords GEOGRAPHY(POINT, 4326),
    image_url TEXT,
    url TEXT,
    price_min NUMERIC(10, 2),
    price_max NUMERIC(10, 2),
    is_free BOOLEAN DEFAULT FALSE,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_source_event UNIQUE (source, source_id)
);

-- Row-Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Anon users can read events
CREATE POLICY "events_select_anon" ON events
    FOR SELECT
    TO anon
    USING (true);

-- Authenticated users can read events
CREATE POLICY "events_select_authenticated" ON events
    FOR SELECT
    TO authenticated
    USING (true);

-- Service role has full access (used by backend for inserts/updates)
CREATE POLICY "events_all_service_role" ON events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Indexes
CREATE INDEX idx_events_start_time ON events (start_time);
CREATE INDEX idx_events_category ON events (category);
CREATE INDEX idx_events_city ON events (city);
CREATE INDEX idx_events_coords ON events USING GIST (coords);
CREATE INDEX idx_events_source ON events (source);

-- Full-text search index
ALTER TABLE events ADD COLUMN search_vector TSVECTOR
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(location_name, '')), 'C')
    ) STORED;

CREATE INDEX idx_events_search ON events USING GIN (search_vector);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC: search events by text + geo bounding box
-- NOTE: the geo input parameters are named p_lat/p_lng (not lat/lng) because
-- PostgreSQL forbids an IN parameter and a RETURNS TABLE output column from
-- sharing a name ("parameter name ... used more than once"), and this
-- function's output table already has lat/lng columns. Callers (e.g. the
-- Supabase RPC client) must pass p_lat/p_lng, not lat/lng.
CREATE OR REPLACE FUNCTION search_events(
    query TEXT DEFAULT NULL,
    category_filter event_category DEFAULT NULL,
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL,
    radius_km DOUBLE PRECISION DEFAULT 25.0,
    from_time TIMESTAMPTZ DEFAULT NOW(),
    to_time TIMESTAMPTZ DEFAULT NULL,
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
        e.is_free, e.source,
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
        CASE WHEN search_events.query IS NOT NULL
            THEN ts_rank(e.search_vector, plainto_tsquery('english', search_events.query))
            ELSE 0
        END DESC,
        e.start_time ASC
    LIMIT search_events.page_limit
    OFFSET search_events.page_offset;
END;
$$ LANGUAGE plpgsql;

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
        e.is_free, e.source, e.source_id,
        e.created_at, e.updated_at
    FROM events e
    WHERE e.id = get_event_by_id.p_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: get events within a map bounding box
CREATE OR REPLACE FUNCTION events_in_bounds(
    south DOUBLE PRECISION,
    west DOUBLE PRECISION,
    north DOUBLE PRECISION,
    east DOUBLE PRECISION,
    from_time TIMESTAMPTZ DEFAULT NOW(),
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
        AND (events_in_bounds.category_filter IS NULL OR e.category = events_in_bounds.category_filter)
    ORDER BY e.start_time ASC
    LIMIT events_in_bounds.max_results;
END;
$$ LANGUAGE plpgsql;
