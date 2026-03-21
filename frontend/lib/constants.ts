export const PIN_COLORS = {
  theft: '#E67E22',
  assault: '#E74C3C',
  vandalism: '#9B59B6',
  harassment: '#E74C3C',
  vehicle_breakin: '#F39C12',
  disturbance: '#E67E22',
  infrastructure: '#3498DB',
  other: '#95A5A6',
} as const;

export const RADIUS = {
  PINS_NEAR_PEOPLE: 0.25,
  SAFETY_BRIEFS: 0.5,
  ROUTE_CORRIDOR: 0.1,
  BROAD_SEARCH: 1.0,
} as const;

export const CATEGORIES = [
  'theft', 'assault', 'vandalism', 'harassment',
  'vehicle_breakin', 'disturbance', 'infrastructure', 'other'
] as const;

export const REPORT_CATEGORIES = [
  { value: 'streetlight_out', label: 'Streetlight out / broken' },
  { value: 'police_activity', label: 'Unusual police activity' },
  { value: 'felt_unsafe', label: 'I felt unsafe here' },
  { value: 'disturbance', label: 'Heard disturbance' },
  { value: 'vehicle_breakin', label: 'Vehicle break-in' },
  { value: 'other', label: 'Other safety concern' },
] as const;
