-- Stored functions for spatial queries.
-- Run these in InsForge's SQL editor or via the database admin API.

-- Get nearby incidents using Haversine distance formula
CREATE OR REPLACE FUNCTION get_nearby_incidents(
    p_lat FLOAT8,
    p_lng FLOAT8,
    p_radius_miles FLOAT8 DEFAULT 1.0,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    id UUID,
    category TEXT,
    description TEXT,
    lat FLOAT8,
    lng FLOAT8,
    occurred_at TIMESTAMPTZ,
    source TEXT,
    verified BOOLEAN,
    report_count INTEGER,
    created_at TIMESTAMPTZ,
    distance_miles FLOAT8
)
LANGUAGE sql STABLE
AS $$
    SELECT
        i.id, i.category, i.description, i.lat, i.lng,
        i.occurred_at, i.source, i.verified, i.report_count, i.created_at,
        (3959 * acos(
            cos(radians(p_lat)) * cos(radians(i.lat))
            * cos(radians(i.lng) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(i.lat))
        )) AS distance_miles
    FROM incidents i
    WHERE i.lat BETWEEN p_lat - (p_radius_miles / 69.0) AND p_lat + (p_radius_miles / 69.0)
      AND i.lng BETWEEN p_lng - (p_radius_miles / (69.0 * cos(radians(p_lat))))
                      AND p_lng + (p_radius_miles / (69.0 * cos(radians(p_lat))))
      AND i.occurred_at >= now() - (p_days || ' days')::INTERVAL
      AND (3959 * acos(
            cos(radians(p_lat)) * cos(radians(i.lat))
            * cos(radians(i.lng) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(i.lat))
        )) <= p_radius_miles
    ORDER BY distance_miles ASC;
$$;

-- Get nearby community reports
CREATE OR REPLACE FUNCTION get_nearby_reports(
    p_lat FLOAT8,
    p_lng FLOAT8,
    p_radius_miles FLOAT8 DEFAULT 1.0,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    category TEXT,
    description TEXT,
    lat FLOAT8,
    lng FLOAT8,
    reported_at TIMESTAMPTZ,
    status TEXT,
    distance_miles FLOAT8
)
LANGUAGE sql STABLE
AS $$
    SELECT
        r.id, r.user_id, r.category, r.description, r.lat, r.lng,
        r.reported_at, r.status,
        (3959 * acos(
            cos(radians(p_lat)) * cos(radians(r.lat))
            * cos(radians(r.lng) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(r.lat))
        )) AS distance_miles
    FROM community_reports r
    WHERE r.lat BETWEEN p_lat - (p_radius_miles / 69.0) AND p_lat + (p_radius_miles / 69.0)
      AND r.lng BETWEEN p_lng - (p_radius_miles / (69.0 * cos(radians(p_lat))))
                      AND p_lng + (p_radius_miles / (69.0 * cos(radians(p_lat))))
      AND r.reported_at >= now() - (p_days || ' days')::INTERVAL
      AND (3959 * acos(
            cos(radians(p_lat)) * cos(radians(r.lat))
            * cos(radians(r.lng) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(r.lat))
        )) <= p_radius_miles
    ORDER BY distance_miles ASC;
$$;

-- Get incident stats grouped by category and source
CREATE OR REPLACE FUNCTION get_incident_stats(
    p_lat FLOAT8,
    p_lng FLOAT8,
    p_radius_miles FLOAT8 DEFAULT 1.0,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    category TEXT,
    source TEXT,
    incident_count BIGINT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        i.category,
        i.source,
        count(*)::BIGINT AS incident_count
    FROM incidents i
    WHERE i.lat BETWEEN p_lat - (p_radius_miles / 69.0) AND p_lat + (p_radius_miles / 69.0)
      AND i.lng BETWEEN p_lng - (p_radius_miles / (69.0 * cos(radians(p_lat))))
                      AND p_lng + (p_radius_miles / (69.0 * cos(radians(p_lat))))
      AND i.occurred_at >= now() - (p_days || ' days')::INTERVAL
      AND (3959 * acos(
            cos(radians(p_lat)) * cos(radians(i.lat))
            * cos(radians(i.lng) - radians(p_lng))
            + sin(radians(p_lat)) * sin(radians(i.lat))
        )) <= p_radius_miles
    GROUP BY i.category, i.source
    ORDER BY incident_count DESC;
$$;
