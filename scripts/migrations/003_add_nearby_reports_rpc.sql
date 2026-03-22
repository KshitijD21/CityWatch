-- Migration: 003_add_nearby_reports_rpc
-- Created: 2026-03-22
-- Description: Add get_nearby_reports RPC function

CREATE OR REPLACE FUNCTION get_nearby_reports(
  p_lat FLOAT8, p_lng FLOAT8, p_radius_miles FLOAT8 DEFAULT 0.5, p_days INT DEFAULT 7
) RETURNS SETOF community_reports AS $$
  SELECT * FROM community_reports
  WHERE lat BETWEEN p_lat - (p_radius_miles * 0.0145) AND p_lat + (p_radius_miles * 0.0145)
    AND lng BETWEEN p_lng - (p_radius_miles * 0.0175) AND p_lng + (p_radius_miles * 0.0175)
    AND reported_at >= now() - (p_days || ' days')::interval
  ORDER BY reported_at DESC;
$$ LANGUAGE sql STABLE
