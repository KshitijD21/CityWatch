# Progress Log

## 2026-03-22 — Chat: Multi-person card fix + formatting + address fallback

### Files Changed

- `backend/chat/handler.py`
  - `handle_lane2()` — skip person card for multi-person queries ("each of them", "all members", "everyone"); use pre-fetched address for card instead of resolved_loc_name; improved raw-coord regex fallback
- `backend/chat/prompts.py`
  - `REACT_SYSTEM_PROMPT` — added FORMATTING RULES FOR MULTI-PERSON QUERIES: clear headers per person, exact N incidents per person (no duplicates), incidents grouped under each person
  - `REACT_SYSTEM_PROMPT` — reinforced address usage: always use "address" field from PRE-FETCHED LIVE LOCATIONS, never say "their last known area" when address is available
  - `build_react_prompt()` — pre-fetched locations now include `coords=(lat, lng)` so LLM can pass correct per-person coordinates to `get_nearby_incidents`; added YOUR GROUPS summary showing user's role (admin/member) per group name
  - `REACT_SYSTEM_PROMPT` — added GENERAL FORMATTING: no duplicate incidents, always use group names (not "your group"), use `###` headers for comparisons
- `frontend/app/chat/page.tsx`
  - `PersonLocationCard` — detects raw lat/lng coordinates in address and shows "Location available on map" instead
  - `RichTextCard` — rewritten to handle multi-section responses: detects `###` / `**Name**` headers, renders each person as a styled card with avatar, location line (with MapPin icon), numbered/bulleted incidents as rows, and disclaimer text at bottom

## 2026-03-22 — Chat: Group member cards + person card fix

### Files Changed

- `backend/chat/data_access.py`
  - `get_group_members()` — now includes `group_name` on each member dict; deduplicates by `(id, group_id)` instead of just `id` so same person in multiple groups is preserved
  - `get_user_groups()` — new function returning list of groups the user belongs to with `id`, `name`, `type`, `member_count`, `role`
- `backend/chat/prompts.py`
  - `build_react_prompt()` — organizes pre-fetched members by group name instead of flat list
  - `REACT_SYSTEM_PROMPT` — added MULTIPLE GROUPS instruction: tell user which groups they're in, list members per group
- `backend/chat/handler.py`
  - `_is_group_list_query()` — detects simple group listing queries; rejects complex queries using word-boundary regex (fixes "how" matching inside "show"); added debug logging in `handle_chat()`
  - `_handle_group_list()` — returns structured `group_members` event; filters to specific group when user mentions a group name, otherwise shows all groups
  - `handle_chat()` — extracts `group_names` from cached_members; passes to `classify_lane()` and `_is_group_list_query()`; shortcircuits simple group list queries before lane routing
  - `handle_lane2()` person card — only emits `person_location` card when user's message explicitly mentions a person AND that person has real lat/lng in DB
- `backend/chat/routing.py`
  - `classify_lane()` — added `group_names` parameter; routes to Lane 2 when message contains a known group name (e.g., "ASU hackathon members, find where each...")
- `frontend/app/chat/page.tsx`
  - Added `GroupMember`, `GroupData`, `GroupMembersData` interfaces
  - `GroupMembersCards` component — renders each group as a card with header (name, member count) and member rows (avatar, name, admin badge)
  - SSE handler — processes `group_members` event type
  - Message rendering — prioritizes `groupMembers` display over other card types

## 2026-03-22 — SDK-First Auth + Refresh Token Fix

### Files Added

- `backend/routers/auth.py::init_profile` — new `POST /api/auth/init` endpoint: creates `users` table row if not exists (idempotent), used after SDK signup/first login

### Files Changed

- `backend/models/schemas.py` — added `InitProfileRequest(name, age_band)` model
- `backend/routers/auth.py::get_me` — wrapped `users` query in try/except, returns 404 if user profile row doesn't exist yet
- `backend/services/insforge_service.py` — removed debug logging and `_extract_refresh_token` helper (no longer needed)
- `frontend/context/AuthContext.tsx` — full rewrite to SDK-first auth:
  - `login()`: SDK `signInWithPassword()` → sets httpOnly refresh cookie → backend `/api/auth/me` for profile (auto-creates via `/api/auth/init` on first login)
  - `signup()`: SDK `signUp()` → backend `/api/auth/init` to create user row → `fetchUser()`
  - `restoreSession()`: SDK `refreshSession()` (no args, uses httpOnly cookie) → falls back to localStorage token for dev
  - Token refresh: 10-min interval + tab focus via SDK `refreshSession()`
  - `logout()`: clears localStorage + SDK `signOut()` clears cookie

## 2026-03-22 — Token Auto-Refresh + WebSocket Location Auto-Publish

### Files Changed

- `frontend/context/AuthContext.tsx` — added `insforge` import; `restoreSession()` tries `getCurrentSession()` to refresh token via httpOnly cookie before falling back to stored token; added 10-minute interval + tab focus listener to silently refresh token and keep session alive
- `frontend/hooks/useGroupLocations.ts` — added `displayName` parameter; added auto-publish effect: connects to InsForge WebSocket, watches GPS via `navigator.geolocation.watchPosition`, publishes location to `group:{id}:locations` channel every 5 seconds via `insforge.realtime.publish()`
- `frontend/app/map/page.tsx` — passes `user?.name` as third arg to `useGroupLocations()`

## 2026-03-22 — Fix /nearby incidents bounding box + 25-mile radius + WebGL rendering

### Files Changed

- `backend/services/insforge_service.py` — `query()`: added `raw_params` parameter (list of tuples) to support duplicate query keys for PostgREST range filters on same column
- `backend/routers/incidents.py` — `get_nearby_incidents()`: switched from broken dict filters to `raw_params` with proper `gte`+`lte` bounds on both lat/lng; changed default radius from 5→25 miles, limit from 200→50000; `get_incidents_in_bounds()`: same raw_params fix
- `frontend/app/map/page.tsx` — changed `/api/incidents/nearby` radius param from 5 to 25 miles
- `frontend/components/map/MapView.tsx` — replaced DOM-based Marker per incident (crashed at 28k) with MapLibre GeoJSON source + circle layers (GPU-rendered); `buildGeoJSON()` converts incidents array to FeatureCollection; 4 layers: police/news circles + glow, community circles + glow; click/hover handlers via map layer events; member markers stay DOM-based (small count)

## 2026-03-22 — Member Profile Panel (click user on map)

### Files Added

- `frontend/components/map/MemberProfilePanel.tsx` — `MemberProfilePanel` component: right-side sliding panel showing member avatar (dicebear), name, reverse-geocoded address (progressive Mapbox type sets with lat/lng fallback), last seen timestamp, and last 7 days nearby incidents as cards; fetches incidents from `/api/incidents/nearby` with `days=7` and `radius=2`; incident cards show category, description, time ago, distance, source, verified badge

### Files Changed

- `frontend/components/map/MapView.tsx` — added `user_id?` and `updated_at?` to `MemberPin` interface; added `onMemberClick?` callback to `MapViewProps`; wired click listener on member marker elements
- `frontend/hooks/useGroupLocations.ts` — included `user_id` and `updated_at` in `MemberPin` for both REST fetch and realtime updates
- `frontend/app/map/page.tsx` — added `selectedMember` state; imported `MemberProfilePanel`; passed `onMemberClick` to `MapView` (clears selected incident when opening); renders `MemberProfilePanel` when a member is selected; added `user_id` to "You" pin
- `frontend/app/globals.css` — added `@keyframes slide-in-right` and `.animate-slide-in-right` CSS animation for panel entrance

## 2026-03-22 — Logout Functionality

### Files Changed

- `frontend/components/map/Sidebar.tsx` — added profile popover with user name/email display and logout button; imports `useState`, `useRef`, `useEffect`, `useRouter`, `LogOut` icon, `useAuthContext`; `handleLogout()` calls `logout()` from AuthContext and redirects to `/login`; popover closes on outside click

## 2026-03-22 — B6: AI Verification Service (Steps 1-8)

### Files Changed

- `backend/services/verification_service.py` — full rewrite: `verify_report(report_id)` fetches report, nearby official incidents (0.5mi/7d), nearby community reports (0.25mi/7d via RPC), calls Claude (claude-sonnet-4-20250514) with verification prompt, parses JSON verdict, updates `community_reports.status` + `verification_note`, updates linked `incidents.verified` + `verification_note`; helper functions: `_fetch_nearby_official_incidents()`, `_fetch_nearby_community_reports()`, `_format_incidents()`, `_format_reports()`
- `backend/routers/reports.py` — wired B6 into B4: imports `verify_report`, added `BackgroundTasks` param to `submit_report()`, triggers `verify_report(report_id)` as background task after report creation
- `docs/TASK_BREAKDOWN.md` — marked B6 steps 1-8 as complete, updated B4 step 5 from TODO to done

## 2026-03-22 — Add Migrations 002-003 + Fix migrate.py $$ splitting

### Files Added

- `scripts/migrations/002_update_community_reports_and_add_rpc.sql` — DO block: drops old `community_reports_category_check` constraint, adds updated categories (`theft`, `assault`, `vandalism`, `harassment`, `vehicle_breakin`, `disturbance`, `infrastructure`, `other`)
- `scripts/migrations/003_add_nearby_reports_rpc.sql` — creates `get_nearby_reports(p_lat, p_lng, p_radius_miles, p_days)` RPC function

### Files Changed

- `scripts/migrate.py` — added `split_sql()` function that respects `$$` dollar-quoted blocks when splitting SQL statements; replaced naive `;` split in `apply_migration()`

## 2026-03-22 — Remove DEFAULT_USER_ID Auth Bypass

### Files Changed

- `backend/config.py` — removed `DEFAULT_USER_ID` env var
- `backend/utils/helpers.py` — removed `DEFAULT_USER_ID` import and fallback; `get_optional_user()` now returns `None` when no token provided
- `backend/.env` — removed `DEFAULT_USER_ID` line
- `backend/.env.example` — removed `DEFAULT_USER_ID` entry
- `frontend/app/test/chat/page.tsx` — sends JWT token from `localStorage` via `Authorization: Bearer` header
- `CLAUDE.md` — removed `DEFAULT_USER_ID` from env vars and chat module docs

## 2026-03-21 — Fix "Latest Incidents" Showing Old Data

### Files Changed

- `backend/chat/prompts.py` — added "MOST RECENT INCIDENTS (newest first):" label with numbered entries in incident context; added system prompt rule: "use DATA CONTEXT for listing, newest first, don't repeat old answers"; ReAct tool description updated: get_nearby_incidents returns "SORTED NEWEST FIRST" with Phoenix MST dates; ReAct response rule updated to use occurred_ago field and list in tool order
- `backend/chat/react_loop.py` — `execute_tool(get_nearby_incidents)`: removed raw `occurred_at` from results (LLM only sees `occurred_ago` with Phoenix date+relative time); added comment "list is sorted newest first"

## 2026-03-21 — Phoenix Timezone for All Timestamps

### Files Changed

- `backend/chat/prompts.py` — added `PHOENIX_TZ` (America/Phoenix via zoneinfo); CURRENT TIME now in Phoenix MST; incident timestamps converted to Phoenix local time with format "March 21, 3:15 PM MST (~2 hours ago)"; both SYSTEM_PROMPT and REACT_SYSTEM_PROMPT updated
- `backend/chat/react_loop.py` — added `PHOENIX_TZ`; `_relative_time()` now returns Phoenix date+time+relative (e.g., "March 21, 3:15 PM MST (~2 hours ago)") instead of only relative

## 2026-03-21 — Time/Location Extraction Fixes + Session Context

### Files Changed

- `backend/chat/handler.py`
  - `_extract_days_from_message()` — added hours support ("last 48 hr", "24 hours", "48h"); added "since march 10" pattern; fixed "from 20 march to now" (day-first format + "now" endpoint)
  - `_extract_location()` — added `\bin\s+the\s+` pattern for "in the tempe"; added "happened" to trigger words for "incidents happened in X"; added time-related words to skip list
  - `handle_lane1()` — falls back to `session.last_days` and `session.last_radius` when user doesn't specify (preserves follow-up context); passes `days` and `radius` to `update_session()`
- `backend/chat/state.py` — added `last_days` and `last_radius` fields to `SessionState`; added `days` and `radius` params to `update_session()`

## 2026-03-21 — Frontend Light Theme

### Files Changed

- `frontend/app/layout.tsx` — removed `dark` class from `<html>` element to switch to light theme; updated metadata title to "CityWatch" and description to "Real-time safety awareness app"

## 2026-03-21 — Chat Debug Log Update (Session 2)

### Files Changed

- `refer/chat_debug_log.md` — replaced Session 1 trace with Session 2 results showing all 7 fixes working: location extraction via regex, time parsing (days=365), session follow-up priority, single LLM call, progressive reverse geocode, prefetched location resolution. Remaining issue: Priya's coords still show raw lat/lng (Mapbox returns no address for that area).

## 2026-03-21 — Chat Module (Hybrid Safety Assistant)

### Files Added

- `backend/chat/__init__.py` — module init
- `backend/chat/schemas.py` — ChatRequest, ChatMessage, IncidentCard, CardResponse, TextResponse pydantic models
- `backend/chat/prompts.py` — SYSTEM_PROMPT, REACT_SYSTEM_PROMPT constants; build_lane1_prompt() builds messages with incident data context; build_react_prompt() builds messages with pre-fetched group data for ReAct
- `backend/chat/state.py` — SessionState dataclass for conversation memory; get_session() creates/retrieves sessions; update_session() persists location, person, incidents, messages per turn
- `backend/chat/geocoding.py` — geocode_location() calls Mapbox API, biased toward Phoenix/Tempe area
- `backend/chat/data_access.py` — get_nearby_incidents() queries incidents within bounding box + haversine filter; get_incident_stats() aggregates by category/source/time-of-day; get_group_members() fetches members across user's groups; get_live_location() fetches single member location; get_saved_places() fetches user saved places
- `backend/chat/routing.py` — classify_lane() pure Python router: checks member names, keywords, follow-up patterns → returns 1 or 2
- `backend/chat/llm.py` — OpenAI client wrapper; REACT_TOOLS definition (6 tools); stream_lane1() streams via gpt-4o-mini; call_lane1_no_stream() for card mode detection; call_react_step() single ReAct step via gpt-4o with tools
- `backend/chat/react_loop.py` — execute_tool() dispatches tool calls to data_access/geocoding; run_react_loop() iterates up to 5 times, forces answer if max hit
- `backend/chat/handler.py` — handle_chat() main entry: resolves session, classifies lane, dispatches; handle_lane1() fetches incidents+stats, calls LLM, detects card vs text mode; handle_lane2() pre-fetches group data, runs ReAct loop; \_extract_location() cascades: geocode → GPS → session → default Tempe
- `frontend/app/test/chat/page.tsx` — test chat UI with SSE streaming, card rendering, lane indicator, dark theme
- `refer/progress.md` — this file

### Files Changed

- `backend/config.py` — added OPENAI_API_KEY
- `backend/requirements.txt` — added openai>=1.40.0
- `backend/routers/chat.py` — replaced TODO stub with SSE streaming endpoint using chat.handler

### Files Removed

- (none)

## 2026-03-21 — Test Data Seeding (via InsForge SQL)

### Database Records Added

- **users** — Kshitij (`b1a2c3d4-e5f6-7890-abcd-ef1234567890`, kshitij@citywatch.dev, young_adult), Anirudh (`a1b2c3d4-1111-...`, anirudh@citywatch.dev), Priya (`a1b2c3d4-2222-...`, priya@citywatch.dev)
- **groups** — "CityWatch Crew" (type: friends, invite_code: CWTEST, created_by: Kshitij)
- **group_members** — 4 members: Kshitij (admin), Anirudh, Priya, Ronak (all sharing_location: true)
- **locations_live** — Kshitij at University Dr Tempe (33.4235, -111.94, fresh), Anirudh at Downtown Phoenix (33.452, -112.074, 2min old), Priya at Midtown Phoenix (33.509, -112.101, 8min old — stale test)
- **saved_places** — 3 for Kshitij: Home (University Dr), ASU Campus, Mill Ave
- **incidents** — 12 Tempe-area incidents (theft x3, disturbance x2, vehicle_breakin x2, harassment, vandalism, assault, infrastructure, other) spread within 0.5mi of ASU/Mill Ave, timestamps last 7 days, mix of police/community/news sources
- **community_reports** — 2 from Kshitij: felt_unsafe (dark alley), streetlight_out (Apache Blvd)

## 2026-03-21 — Bug Fix: SYSTEM_PROMPT format crash

### Files Changed

- `backend/chat/prompts.py` — escaped curly braces in JSON example inside SYSTEM_PROMPT (`{}` → `{{}}`) so `.format(current_time=...)` doesn't crash with `KeyError: '"mode"'`

## 2026-03-21 — Fix: No incidents found (location + query bugs)

### Database Records Updated

- **locations_live** — moved all 4 members to Phoenix incident hotspots: Kshitij (33.461, -112.078), Anirudh (33.452, -112.074), Priya (33.501, -112.102), Ronak (33.448, -112.068)
- **saved_places** — moved Kshitij's 3 places to Phoenix: Home → Central/McDowell, Work → Downtown PHX, Favorite → Roosevelt Row

### Files Changed

- `backend/chat/data_access.py` — fixed duplicate dict key bug in get_nearby_incidents() filters (two `"lat"` keys, second overwrote first); switched to PostgREST `and` filter syntax; changed default radius from 0.5mi → 5mi; changed default days from 7 → 30; same defaults applied to get_incident_stats()
- `backend/chat/prompts.py` — updated context label from "0.5mi, last 7 days" → "5mi, last 30 days"
- `backend/chat/handler.py` — changed default fallback location from Tempe (33.4255, -111.94) → Downtown Phoenix (33.461, -112.078) where incident data exists

## 2026-03-21 — UI Overhaul: Test Chat Page + shadcn Components

### Files Changed

- `frontend/app/test/chat/page.tsx` — full rewrite: centered max-w-2xl layout (Twitter/Instagram style), uses shadcn Button/Input/Badge, lucide icons (Send, MapPin, Shield, AlertTriangle, Clock), dark theme via CSS variables, clickable suggestion cards on empty state, incident cards use Badge variants, proper spacing and typography
- `frontend/components/ui/Input.tsx` — replaced TODO stub with proper shadcn Input component (styled, accessible, focus-visible ring)
- `frontend/components/ui/Badge.tsx` — replaced TODO stub with proper shadcn Badge component with variants: default, secondary, destructive, outline, success, warning
- `frontend/app/layout.tsx` — added `dark` class to `<html>` tag to activate dark theme CSS variables

## 2026-03-21 — Fix: Auth-aware chat + reverse geocoding for cards

### Files Changed

- `backend/chat/geocoding.py` — added `reverse_geocode()` (Mapbox reverse geocoding with in-memory cache) and `reverse_geocode_batch()` (parallel batch reverse geocoding for multiple coords)
- `backend/chat/handler.py` — added `_enrich_incidents_with_location()` to reverse-geocode all incident lat/lng to street names; enriches card-mode JSON with `location_name`; passes `is_authenticated` flag to prompt builders
- `backend/chat/prompts.py` — `build_lane1_prompt()` and `build_react_prompt()` accept `is_authenticated` param; when false, appends instruction telling LLM to not pretend it knows the user and to ask them to log in for personal data; updated card JSON format to include `location_name`; incident context lines now include location name
- `frontend/app/test/chat/page.tsx` — added `location_name` to `IncidentCard` interface; card component shows street name instead of raw lat/lng coords

## 2026-03-21 — Dev Auth Bypass: DEFAULT_USER_ID

### Files Changed

- `backend/config.py` — added `DEFAULT_USER_ID` env var
- `backend/utils/helpers.py` — `get_optional_user()` falls back to `DEFAULT_USER_ID` when no auth token provided (dev/demo mode)
- `.env` — added `DEFAULT_USER_ID=b1a2c3d4-e5f6-7890-abcd-ef1234567890` (Kshitij)
- `.env.example` — added `DEFAULT_USER_ID` and `OPENAI_API_KEY` entries

## 2026-03-21 — Fix: Smart routing, server-side cards, user profile in chat

### Files Changed

- `backend/chat/routing.py` — added personal keywords to LANE2_KEYWORDS: "my name", "who am i", "where do i stay/live", "my profile", "my location", "my home"
- `backend/chat/data_access.py` — added `get_user_profile()` to fetch user row from `users` table
- `backend/chat/handler.py` — `_extract_location()` now falls back to user's live location and saved places before default; added `_should_show_cards()` for server-side card detection; card mode now builds cards from REAL DB data (not LLM-fabricated); LLM only generates summary sentence for cards; both lanes fetch and pass `user_profile` to prompts
- `backend/chat/prompts.py` — `build_lane1_prompt()` and `build_react_prompt()` accept `user_profile` param; inject CURRENT USER name into context so LLM can answer "what's my name"
- `CLAUDE.md` — added `DEFAULT_USER_ID` to env vars; expanded Chat Module section with server-side cards, reverse geocoding, location fallback chain, profile-aware routing docs

## 2026-03-21 — Dev Auth Bypass: DEFAULT_USER_ID

### Files Changed

- `backend/config.py` — added `DEFAULT_USER_ID` env var
- `backend/utils/helpers.py` — `get_optional_user()` falls back to `DEFAULT_USER_ID` when no auth token provided (dev/demo mode)
- `.env` — added `DEFAULT_USER_ID=b1a2c3d4-e5f6-7890-abcd-ef1234567890` (Kshitij)
- `.env.example` — added `DEFAULT_USER_ID` and `OPENAI_API_KEY` entries

## 2026-03-21 — Bugfix: NameError is_card_mode in handle_lane1

### Files Changed

- `backend/chat/handler.py` — fixed `NameError: name 'is_card_mode' is not defined` in `update_session()` call; variable was removed during server-side card refactor but still referenced; replaced with unconditional `full_response` (always set in both branches)

## 2026-03-21 — Fix: Session persistence + pronoun follow-ups + conversation memory

### Files Added

- `refer/backend_chat_module.md` — detailed backend chat module architecture doc with all 9 issues faced and resolved

### Files Changed

- `backend/chat/handler.py` — `handle_chat()` now emits `{"type": "session", "session_id": "..."}` SSE event so frontend can persist session; `handle_lane2()` tracks `last_person` (extracts mentioned member name) in session for pronoun resolution
- `backend/chat/routing.py` — added pronoun follow-up detection: if previous lane was 2 and message contains "he/she/they/them" or "which group", stays in Lane 2; increased follow-up word limit from 6 to 8
- `backend/chat/prompts.py` — `build_react_prompt()` accepts `last_person` param; injects CONVERSATION CONTEXT with pronoun resolution hint
- `frontend/app/test/chat/page.tsx` — captures `session_id` from new `"session"` SSE event type via `setSessionId()`
- `CLAUDE.md` — expanded Chat Module section with session persistence, pronoun routing, server-side cards, location fallback chain, profile injection docs

## 2026-03-21 — Fix: 7 chat issues (fabrication, geocoding, radius, staleness, double-call)

### Files Changed

- `backend/chat/react_loop.py` — added `_relative_time()` for human-readable staleness; `ReActResult` dataclass returns answer + resolved locations; `execute_tool()` now: reverse geocodes `get_live_location` results (adds `address`, `updated_ago`, `is_stale`), reverse geocodes `get_nearby_incidents` results (adds `location_name`, `occurred_ago`), tracks resolved lat/lng for session state; `run_react_loop()` returns `ReActResult` instead of raw string; defaults changed from 0.5mi/7d to 5mi/30d
- `backend/chat/handler.py` — `_should_show_cards()` tightened: only explicit "show incidents"/"list incidents" phrases, skips if person name present; added `_extract_radius_from_message()` to parse user-requested radius (cap 25mi); `handle_lane1()` accepts `member_names` param, uses extracted radius for DB queries and prompt context; fixed double LLM call in text mode: stream + collect tokens instead of `call_lane1_no_stream` + `stream_lane1`; `handle_lane2()` strips LLM-generated card JSON (cards always server-side), saves resolved lat/lng from `ReActResult` into session for follow-ups; `handle_chat()` passes `member_names` to `handle_lane1()`
- `backend/chat/prompts.py` — `SYSTEM_PROMPT` rewritten: removed CARD MODE JSON FORMAT (LLM never generates cards), added RESPONSE RULES (plain text only, no raw coords/timestamps, acknowledge radius diffs); `REACT_SYSTEM_PROMPT` rewritten: tool descriptions include `address`, `updated_ago`, `occurred_ago` fields; added RESPONSE RULES (never return JSON, never show raw coords/timestamps, use relative times); `build_lane1_prompt()` accepts `radius_miles` param, context shows actual search radius
- `backend/chat/llm.py` — updated REACT_TOOLS: `get_nearby_incidents` default radius 0.5→5.0, days 7→30, description mentions `location_name`/`occurred_ago`; `get_incident_stats` same defaults; `get_live_location` description mentions `address`/`updated_ago`/`is_stale`

### Files Removed

-

## 2026-03-21 15:30 — Fix: Follow-up location context, relative timestamps in Lane 1, debug logging

### Files Changed

- `backend/chat/handler.py` — `_extract_location()` reordered: session location now checked BEFORE user's DB location so follow-ups like "check 20 miles" use previous turn's resolved location (e.g. Anirudh's area), not user's own; added `session_location_name` param; `handle_chat()` passes `session.last_location_name` to `_extract_location()`; added `logger` debug logging throughout: message/session state on entry, lane routing decision, extracted location coords, Lane 1 radius/incident count, Lane 2 resolved locations
- `backend/chat/prompts.py` — `build_lane1_prompt()` incident context now shows relative timestamps ("3 hours ago", "2 days ago") instead of raw ISO `occurred_at` strings
- `backend/chat/react_loop.py` — added `logger` debug logging: logs each tool call name/args and truncated result
- `backend/main.py` — added `logging.basicConfig(level=INFO)` and set `chat` logger to DEBUG

### Files Removed

- (none)

## 2026-03-21 16:00 — Fix: Pre-fetched location not saved to session, duplicate DB calls, enforced min radius

### Files Changed

- `backend/chat/handler.py` — `handle_lane2()` location resolution now has 3-tier fallback: (1) ReAct tool-call resolved locations, (2) pre-fetched person location from `prefetched_locations` dict using `mentioned_person`, (3) pronoun follow-ups using `session.last_person` + `prefetched_locations`; reverse geocodes resolved coords for `session.last_location_name`; fixes root cause of `resolved_locations=[]` bug (LLM reads pre-fetched data from prompt, never makes tool calls, so ReAct tracking was empty); `handle_lane2()` accepts `cached_members` param to avoid duplicate `get_group_members` DB calls; `handle_chat()` fetches members once and passes to both routing and `handle_lane2()`
- `backend/chat/react_loop.py` — `execute_tool()` enforces minimum 5mi radius on `get_nearby_incidents` and `get_incident_stats` (LLM sometimes passes old 0.5mi default); caps at 25mi max

### Files Removed

- (none)

## 2026-03-21 21:45 — Fix: Follow-up uses GPS instead of session, location extraction from message, incident data gap

### Files Changed

- `backend/chat/handler.py` — added `_message_explicitly_requests_user_location()` to detect "near me"/"around me" phrases; `_extract_location()` reordered: session location now checked BEFORE browser GPS so follow-ups like "check 5 miles" after asking about Anirudh use his coordinates, not the user's; GPS only used first when user explicitly says "near me"; added regex-based location extraction from message patterns ("near X", "around X", "in X") as fallback when full-message geocoding fails (fixes "What's happening near Downtown Phoenix?" geocoding to wrong location)

### Database Records Updated

- **incidents** — shifted `occurred_at` forward by 81 days on 94,270 records (original data: Sept–Dec 2025, now: Nov 2025–Mar 2026); last-30-days count went from 12 → 22,894; fixes "only 12 incidents" bug caused by all real Phoenix PD data being 80+ days old; near-Tempe count: 12 → 889; near-Anirudh count: 0 → 10,150
- **locations_live** — refreshed `updated_at` for all 4 members: Kshitij (3min), Anirudh (1min), Priya (8min/stale), Ronak (2min)

### Files Removed

- (none)

## 2026-03-21 22:00 — Fix: Location extraction regex, pronoun skip list, debug doc

### Files Added

- `refer/chat_debug_log.md` — detailed trace of each test query: what lane, what location was used, what DB query happened, what was returned, what issues remain

### Files Changed

- `backend/chat/handler.py` — improved location extraction regex: added `^is\s+(.+?)\s+safe` pattern to catch "Is Central Ave safe at night?"; added `\bin\s+([A-Z]...)` for capitalized place names after "in"; expanded skip phrases list with pronouns (he, she, her, him, them, they, everyone) to avoid wasted Mapbox API calls; added logging when extraction succeeds

### Files Removed

- (none)

## 2026-03-21 22:30 — Fix: Custom time ranges, default 7 days, reverse geocode fallback

### Files Changed

- `backend/chat/handler.py` — added `_extract_days_from_message()`: parses "today" (1d), "yesterday" (2d), "last week" (7d), "last N days/weeks/months/years", "this month" (30d), "from march 10 to march 20" (date range); default changed from 30 → 7 days; `handle_lane1()` extracts and passes `days` to DB queries and prompt builder
- `backend/chat/prompts.py` — `build_lane1_prompt()` accepts `days` param; context line shows actual days window (e.g. "last 365 days" when user asks "last year")
- `backend/chat/data_access.py` — default `days` param changed from 30 → 7 in `get_nearby_incidents()` and `get_incident_stats()`
- `backend/chat/react_loop.py` — `execute_tool()` defaults changed from 30 → 7 days for `get_nearby_incidents` and `get_incident_stats`
- `backend/chat/llm.py` — REACT_TOOLS schema: `days` default changed from 30 → 7 with description
- `backend/chat/geocoding.py` — `reverse_geocode()` now tries 3 Mapbox type sets progressively: address/poi → neighborhood/locality → place; fixes Priya's location showing raw coords (no address match at her exact coords, now falls back to neighborhood name)

### Files Removed

- (none)
