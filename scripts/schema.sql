-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age_band TEXT NOT NULL CHECK (age_band IN ('child', 'teen', 'young_adult', 'adult')),
  avatar_url TEXT,
  onboarded BOOLEAN DEFAULT false,
  notification_prefs JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('family', 'friends')),
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_groups_invite_code ON groups(invite_code);
CREATE INDEX idx_groups_created_by ON groups(created_by);

-- Group members table
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  display_name TEXT NOT NULL,
  age_band TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  sharing_location BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_gm_group_id ON group_members(group_id);
CREATE INDEX idx_gm_user_id ON group_members(user_id);

-- Saved places table
CREATE TABLE saved_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat FLOAT8 NOT NULL,
  lng FLOAT8 NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('home', 'school', 'work', 'favorite')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sp_user_id ON saved_places(user_id);
CREATE INDEX idx_sp_lat_lng ON saved_places(lat, lng);

-- Incidents table (THE MAIN TABLE)
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('theft', 'assault', 'vandalism', 'harassment', 'vehicle_breakin', 'disturbance', 'infrastructure', 'other')),
  description TEXT,
  lat FLOAT8 NOT NULL,
  lng FLOAT8 NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('police', 'news', 'community')),
  verified BOOLEAN DEFAULT false,
  verification_note TEXT,
  report_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inc_lat_lng ON incidents(lat, lng);
CREATE INDEX idx_inc_occurred_at ON incidents(occurred_at);
CREATE INDEX idx_inc_source ON incidents(source);
CREATE INDEX idx_inc_category ON incidents(category);
CREATE INDEX idx_inc_spatial_time ON incidents(lat, lng, occurred_at);

-- Incident sources table
CREATE TABLE incident_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('police', 'news', 'community')),
  external_id TEXT,
  url TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_name, external_id)
);

CREATE INDEX idx_is_incident_id ON incident_sources(incident_id);

-- Community reports table
CREATE TABLE community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN ('theft', 'assault', 'vandalism', 'harassment', 'vehicle_breakin', 'disturbance', 'infrastructure', 'other')),
  description TEXT,
  image_url TEXT,
  lat FLOAT8 NOT NULL,
  lng FLOAT8 NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'verified', 'flagged')),
  verification_note TEXT,
  linked_incident_id UUID REFERENCES incidents(id),
  flagged_by_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cr_user_id ON community_reports(user_id);
CREATE INDEX idx_cr_lat_lng ON community_reports(lat, lng);
CREATE INDEX idx_cr_status ON community_reports(status);
CREATE INDEX idx_cr_reported_at ON community_reports(reported_at);

-- Live locations table
CREATE TABLE locations_live (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  lat FLOAT8 NOT NULL,
  lng FLOAT8 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ll_user_id ON locations_live(user_id);
CREATE INDEX idx_ll_updated_at ON locations_live(updated_at);

-- Brief cache table
CREATE TABLE brief_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat_rounded FLOAT8 NOT NULL,
  lng_rounded FLOAT8 NOT NULL,
  brief_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_bc_location ON brief_cache(lat_rounded, lng_rounded);
CREATE INDEX idx_bc_expires_at ON brief_cache(expires_at);

-- RPC: Get nearby community reports within radius and time window
CREATE OR REPLACE FUNCTION get_nearby_reports(
  p_lat FLOAT8, p_lng FLOAT8, p_radius_miles FLOAT8 DEFAULT 0.5, p_days INT DEFAULT 7
) RETURNS SETOF community_reports AS $$
  SELECT * FROM community_reports
  WHERE lat BETWEEN p_lat - (p_radius_miles * 0.0145) AND p_lat + (p_radius_miles * 0.0145)
    AND lng BETWEEN p_lng - (p_radius_miles * 0.0175) AND p_lng + (p_radius_miles * 0.0175)
    AND reported_at >= now() - (p_days || ' days')::interval
  ORDER BY reported_at DESC;
$$ LANGUAGE sql STABLE;
