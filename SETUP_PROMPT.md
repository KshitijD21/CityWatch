You are setting up a new project called "CityWatch" from scratch. This is ONLY the project scaffold — folder structure, config files, dependencies, database schema, and environment setup. Do NOT build any features, pages, components, or API logic yet. Just the skeleton so the team can start building immediately.

Project name: CityWatch (or HeyPoco if you prefer to keep consistency)
Package manager: pnpm
Monorepo: yes, pnpm workspaces

---

PROJECT STRUCTURE:

Create this exact folder structure:

```
CITYWATCH/
├── frontend/                  # Next.js app
├── backend/                   # FastAPI app
├── scripts/                   # Seed data, scrapers, utilities
├── docs/                      # Project documentation
├── .claude/                   # Claude Code config (if using)
├── .project/                  # Project-level config
├── .gitignore
├── .prettierrc
├── .prettierignore
├── package.json               # Root package.json for pnpm workspaces
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── railway.json               # Railway deployment config
├── README.md
└── .env.example               # Template for environment variables
```

---

ROOT FILES:

pnpm-workspace.yaml:
```yaml
packages:
  - 'frontend'
  - 'scripts'
```

Root package.json:
- name: "citywatch"
- private: true
- scripts:
    "dev:frontend": "pnpm --filter frontend dev"
    "dev:backend": "cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000"
    "dev": run frontend and backend together (use concurrently if needed)
    "build": "pnpm --filter frontend build"
    "lint": "pnpm --filter frontend lint"
    "seed": "cd scripts && python seed_data.py"
    "scrape:police": "cd scripts && python scrape_police.py"
    "scrape:news": "cd scripts && python scrape_news.py"
- devDependencies: concurrently (for running frontend + backend together)

.env.example:
```
# Frontend (also add to frontend/.env.local)
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend
ANTHROPIC_API_KEY=
MAPBOX_TOKEN=
TINYFISH_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
DATABASE_URL=

# InsForge (if using instead of Supabase)
INSFORGE_URL=
INSFORGE_API_KEY=
```

.gitignore:
```
node_modules/
.next/
__pycache__/
*.pyc
venv/
.env
.env.local
.env.*.local
dist/
build/
*.log
.DS_Store
.vercel
```

.prettierrc:
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

.prettierignore:
```
node_modules
.next
venv
__pycache__
pnpm-lock.yaml
```

railway.json:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile"
  },
  "deploy": {
    "startCommand": "cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/api/health"
  }
}
```

README.md:
- Project name: CityWatch
- One-liner: "See what's happening around you. For real. With sources."
- Brief description: Real-time safety awareness app. Live map with sourced incident data, AI-powered chat and area briefs, community reporting with verification.
- Tech stack section: Next.js, FastAPI, PostgreSQL, Claude AI, TinyFish, Mapbox
- Setup instructions: how to install, set env vars, run dev
- Team members section (empty, to fill in)
- Hackathon: HackASU — Claude Builder Club — March 20-22, 2026

---

FRONTEND SETUP:

Initialize Next.js inside the frontend/ folder:
- Use: npx create-next-app@latest frontend --typescript --tailwind --app --use-pnpm
- Or if frontend folder already exists, init inside it

Install these dependencies in frontend/:
```
pnpm add mapbox-gl @mapbox/mapbox-gl-geocoder
pnpm add @supabase/supabase-js
pnpm add lucide-react
pnpm add clsx
pnpm add -D @types/mapbox-gl
```

Frontend folder structure inside frontend/src/ (or frontend/app/ depending on Next.js setup):
```
frontend/
├── app/
│   ├── layout.tsx                # Root layout with global providers
│   ├── page.tsx                  # Home — the map (no auth required)
│   ├── chat/
│   │   └── page.tsx              # Chat assistant page
│   ├── brief/
│   │   └── page.tsx              # Area safety brief page
│   ├── login/
│   │   └── page.tsx              # Login page
│   ├── signup/
│   │   └── page.tsx              # Signup page
│   ├── onboarding/
│   │   └── page.tsx              # Onboarding flow (after first signup)
│   ├── groups/
│   │   └── page.tsx              # Group management
│   └── join/
│       └── [code]/
│           └── page.tsx          # Join group via invite link
├── components/
│   ├── map/
│   │   ├── MapView.tsx           # Main Mapbox map component
│   │   ├── EventPin.tsx          # Individual pin on the map
│   │   ├── MemberDot.tsx         # Group member location dot
│   │   └── MapControls.tsx       # Search bar, zoom, locate me
│   ├── events/
│   │   ├── EventCard.tsx         # Slide-up card when pin is tapped
│   │   └── EventList.tsx         # List view of nearby events
│   ├── brief/
│   │   ├── SafetyBrief.tsx       # Full brief display
│   │   ├── TimeBadge.tsx         # Daytime/Evening/Late night row
│   │   └── SourcePanel.tsx       # "How we know this" expandable
│   ├── chat/
│   │   ├── ChatInput.tsx         # Message input + send button
│   │   ├── ChatMessage.tsx       # Single message bubble
│   │   ├── ChatSources.tsx       # Source citations in response
│   │   └── QuickPrompts.tsx      # Pre-built prompt buttons
│   ├── reports/
│   │   └── ReportForm.tsx        # Community report modal/sheet
│   ├── groups/
│   │   ├── GroupCard.tsx          # Group summary card
│   │   ├── MemberRow.tsx         # Member with sharing toggle
│   │   └── InviteLink.tsx        # Generate + copy invite link
│   ├── onboarding/
│   │   ├── EthicalModal.tsx      # "What this is / isn't"
│   │   ├── CreateGroup.tsx       # Step 2: name + type
│   │   ├── AddMembers.tsx        # Step 3: add people
│   │   └── AddPlaces.tsx         # Step 4: add saved locations
│   ├── auth/
│   │   ├── LoginForm.tsx         # Email/password + Google OAuth
│   │   └── SignupForm.tsx        # Registration form
│   └── ui/
│       ├── Button.tsx            # Reusable button
│       ├── Input.tsx             # Reusable input
│       ├── Modal.tsx             # Reusable modal/bottom sheet
│       ├── Badge.tsx             # Verified/unverified/source badges
│       ├── Skeleton.tsx          # Loading skeleton
│       └── Toast.tsx             # Toast notification
├── hooks/
│   ├── useLocation.ts            # Browser geolocation hook
│   ├── useRealtime.ts            # Supabase/InsForge realtime subscription
│   ├── useAuth.ts                # Auth state hook
│   └── useDebounce.ts            # Debounce hook (for map pan/zoom)
├── lib/
│   ├── supabase.ts               # Supabase client setup
│   ├── api.ts                    # Backend API call helpers
│   ├── mapbox.ts                 # Mapbox config and helpers
│   ├── constants.ts              # App-wide constants (colors, categories, radius values)
│   └── utils.ts                  # General utility functions
├── types/
│   └── index.ts                  # TypeScript types for all data models
└── public/
    └── favicon.ico
```

Create placeholder files for every file listed above. Each page file should export a minimal component:
```tsx
export default function PageName() {
  return <div>PageName — TODO</div>;
}
```

Each component file should export a minimal component:
```tsx
export default function ComponentName() {
  return <div>ComponentName — TODO</div>;
}
```

Each hook file should export a minimal hook:
```ts
export function useHookName() {
  // TODO
  return {};
}
```

frontend/lib/constants.ts should have actual values:
```ts
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
```

frontend/types/index.ts should have all TypeScript types:
```ts
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
  type: 'family' | 'trip';
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
```

frontend/lib/api.ts should have the base setup:
```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiStream(path: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return res.body;
}
```

frontend/lib/supabase.ts (or insforge.ts):
```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

BACKEND SETUP:

Create backend/ folder with Python virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
```

Install these Python packages:
```
pip install fastapi uvicorn httpx anthropic python-dotenv supabase pydantic
pip install python-multipart  # for form data
```

Generate requirements.txt:
```
pip freeze > requirements.txt
```

Backend folder structure:
```
backend/
├── main.py                    # FastAPI app, CORS, route registration
├── config.py                  # Environment variables loader
├── requirements.txt
├── Dockerfile
├── .env                       # Local env (gitignored)
├── routers/
│   ├── __init__.py
│   ├── incidents.py           # GET /api/incidents/nearby, /bounds, /stats, /:id
│   ├── chat.py                # POST /api/chat (SSE streaming)
│   ├── briefs.py              # GET /api/briefs/generate
│   ├── reports.py             # POST /api/reports, GET /nearby, PUT /flag
│   ├── auth.py                # POST /api/auth/signup, /login, GET /me
│   ├── groups.py              # POST /api/groups, GET, join, members
│   ├── places.py              # POST /api/places, GET, DELETE
│   ├── location.py            # POST /api/location/update, GET /group/:id
│   └── geocode.py             # GET /api/geocode
├── services/
│   ├── __init__.py
│   ├── claude_service.py      # All Claude API calls (chat, brief, verification)
│   ├── spatial_service.py     # Haversine queries, nearby/bounds/along-route
│   ├── tinyfish_service.py    # TinyFish scraper calls
│   ├── verification_service.py # AI verification + clustering logic
│   └── realtime_service.py    # Broadcast events via Supabase/InsForge realtime
├── models/
│   ├── __init__.py
│   └── schemas.py             # Pydantic models for request/response
└── utils/
    ├── __init__.py
    └── helpers.py             # Shared utility functions
```

backend/main.py:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CityWatch API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register routers
from routers import incidents, chat, briefs, reports, auth, groups, places, location, geocode

app.include_router(incidents.router, prefix="/api/incidents", tags=["incidents"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(briefs.router, prefix="/api/briefs", tags=["briefs"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
app.include_router(places.router, prefix="/api/places", tags=["places"])
app.include_router(location.router, prefix="/api/location", tags=["location"])
app.include_router(geocode.router, prefix="/api/geocode", tags=["geocode"])

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "citywatch"}
```

backend/config.py:
```python
import os

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN")
TINYFISH_API_KEY = os.getenv("TINYFISH_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
```

backend/Dockerfile:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Each router file should have a minimal placeholder:
```python
# routers/incidents.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/nearby")
async def get_nearby_incidents():
    """Get incidents within radius of a point."""
    return {"message": "TODO"}

@router.get("/bounds")
async def get_incidents_in_bounds():
    """Get incidents within map viewport bounds."""
    return {"message": "TODO"}

@router.get("/stats")
async def get_incident_stats():
    """Get aggregated stats for an area."""
    return {"message": "TODO"}

@router.get("/{incident_id}")
async def get_incident(incident_id: str):
    """Get full incident details."""
    return {"message": "TODO"}
```

Do the same pattern for every router — import APIRouter, create router, add placeholder endpoints with docstrings matching the task breakdown. Here are the endpoints per router:

routers/chat.py:
  POST / → chat with Claude (SSE streaming)

routers/briefs.py:
  GET /generate → generate area safety brief

routers/reports.py:
  POST / → submit community report
  GET /nearby → get reports near a point
  PUT /{report_id}/flag → flag a report

routers/auth.py:
  POST /signup → create account
  POST /login → log in
  GET /me → get current user profile
  PUT /me → update profile
  PUT /me/onboarded → mark onboarding complete

routers/groups.py:
  POST / → create group
  GET / → list user's groups
  GET /{group_id} → get group details
  GET /join/{invite_code} → join group via invite
  POST /{group_id}/members → add placeholder member
  DELETE /{group_id}/members/{member_id} → remove member

routers/places.py:
  POST / → add saved place
  GET / → list saved places
  DELETE /{place_id} → remove saved place

routers/location.py:
  POST /update → send location update
  GET /group/{group_id} → get live locations for group
  PUT /sharing → toggle location sharing

routers/geocode.py:
  GET / → geocode an address to lat/lng

Each service file should have a minimal placeholder:
```python
# services/claude_service.py

async def generate_chat_response(message: str, incidents: list, user_context: dict = None):
    """Generate a chat response using Claude."""
    # TODO
    pass

async def generate_safety_brief(incidents: list, stats: dict, user_context: dict = None):
    """Generate a safety brief using Claude."""
    # TODO
    pass

async def verify_community_report(report: dict, nearby_incidents: list, nearby_reports: list):
    """Verify a community report using Claude."""
    # TODO
    pass
```

Do the same for spatial_service.py, tinyfish_service.py, verification_service.py, realtime_service.py.

backend/models/schemas.py should have Pydantic models:
```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class IncidentResponse(BaseModel):
    id: str
    category: str
    description: Optional[str]
    lat: float
    lng: float
    occurred_at: datetime
    source: str
    verified: bool
    report_count: int
    distance_miles: Optional[float]

class ChatRequest(BaseModel):
    message: str
    user_lat: Optional[float]
    user_lng: Optional[float]

class BriefResponse(BaseModel):
    summary: str
    time_breakdown: dict
    household_context: Optional[str]
    sources: list
    incident_count: int
    disclaimer: str

class ReportCreate(BaseModel):
    category: str
    description: Optional[str]
    lat: float
    lng: float

class LocationUpdate(BaseModel):
    lat: float
    lng: float

class GroupCreate(BaseModel):
    name: str
    type: str  # "family" or "trip"

class PlaceCreate(BaseModel):
    name: str
    address: str
    type: str  # "home", "school", "work", "favorite"

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str
    age_band: str
```

---

SCRIPTS SETUP:

```
scripts/
├── seed_data.py               # Load Phoenix PD CSV into database
├── scrape_police.py           # TinyFish police data scraper
├── scrape_news.py             # TinyFish news scraper
├── normalize.py               # Shared normalization functions
└── requirements.txt           # Script-specific dependencies
```

Each script should have a minimal placeholder:
```python
# scripts/seed_data.py
"""
Seed the database with Phoenix PD crime data.
Usage: python seed_data.py
"""

def main():
    print("TODO: Load CSV, normalize, insert into database")

if __name__ == "__main__":
    main()
```

---

DOCS SETUP:

Copy these files into docs/ folder:
- PROJECT_IDEA.md (the project idea document)
- SCHEMA.md (the database schema document)
- TASK_BREAKDOWN.md (the task breakdown document)

These are reference docs for the team.

---

DATABASE SCHEMA:

Run these SQL statements against the database (Supabase or InsForge) to create all tables:

```sql
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
  type TEXT NOT NULL CHECK (type IN ('family', 'trip')),
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
  sharing_location BOOLEAN DEFAULT false,
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
  category TEXT NOT NULL CHECK (category IN ('streetlight_out', 'police_activity', 'felt_unsafe', 'disturbance', 'vehicle_breakin', 'suspicious_activity', 'other')),
  description TEXT,
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
```

Put this SQL in a file: scripts/schema.sql

---

AFTER SETUP VERIFICATION:

Once everything is created, verify:
1. `cd frontend && pnpm dev` → Next.js runs on localhost:3000
2. `cd backend && source venv/bin/activate && uvicorn main:app --reload` → FastAPI runs on localhost:8000
3. Visit localhost:8000/api/health → returns {"status": "ok"}
4. Visit localhost:8000/docs → FastAPI Swagger docs show all endpoints
5. Visit localhost:3000 → shows the home page placeholder

Do NOT build any actual features. Just make sure the scaffold compiles and runs without errors. Every file should have a minimal placeholder that doesn't crash.
