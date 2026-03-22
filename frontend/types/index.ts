export interface User {
  id: string;
  email: string;
  name: string;
  age_band: 'child' | 'teen' | 'young_adult' | 'adult';
  avatar_url?: string;
  onboarded: boolean;
  notification_prefs: Record<string, boolean>;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  type: 'family' | 'friends';
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  age_band?: string;
  role: 'admin' | 'member';
  sharing_location: boolean;
  joined_at: string;
}

export interface SavedPlace {
  id: string;
  user_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'home' | 'school' | 'work' | 'favorite';
  created_at: string;
}

export interface Incident {
  id: string;
  category: string;
  description?: string;
  lat: number;
  lng: number;
  occurred_at: string;
  source: 'police' | 'news' | 'community';
  verified: boolean;
  verification_note?: string;
  report_count: number;
  created_at: string;
  distance_miles?: number;
  photo_url?: string;
}

export interface IncidentSource {
  id: string;
  incident_id: string;
  source_name: string;
  source_type: 'police' | 'news' | 'community';
  external_id?: string;
  url?: string;
  fetched_at: string;
}

export interface CommunityReport {
  id: string;
  user_id: string;
  category: string;
  description?: string;
  lat: number;
  lng: number;
  reported_at: string;
  status: 'unverified' | 'verified' | 'flagged';
  verification_note?: string;
  linked_incident_id?: string;
  flagged_by_users: number;
  created_at: string;
}

export interface LocationLive {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}

export interface BriefResponse {
  summary: string;
  time_breakdown: {
    daytime: string;
    evening: string;
    late_night: string;
  };
  household_context: string | null;
  sources: { name: string; type: string; count: number }[];
  incident_count: number;
  disclaimer: string;
}

export interface IncidentStats {
  by_category: Record<string, number>;
  by_source: Record<string, number>;
  by_time: Record<string, number>;
  total_count: number;
  sources: string[];
}
