# CityWatch Chat Module — Backend Architecture

## Overview

A hybrid AI safety assistant with two-lane routing, server-side card rendering, and conversation memory. Lives in `backend/chat/` as a self-contained module.

## Module Structure

```
backend/chat/
├── __init__.py          # Module init
├── schemas.py           # Pydantic models (ChatRequest, ChatMessage, IncidentCard, etc.)
├── prompts.py           # System prompts + prompt builders for Lane 1 & Lane 2
├── state.py             # In-memory session store (SessionState, get/update)
├── geocoding.py         # Mapbox forward + reverse geocoding with caching
├── data_access.py       # All DB queries via InsForge (incidents, users, groups, locations, places)
├── routing.py           # Pure-Python lane classifier (no LLM call)
├── llm.py               # OpenAI client wrapper (gpt-4o-mini / gpt-4o)
├── react_loop.py        # Lane 2 ReAct loop (max 5 tool-call iterations)
└── handler.py           # Main orchestrator — ties everything together
```

Thin router at `backend/routers/chat.py` — only does SSE streaming, delegates to `handler.py`.

## Two-Lane Routing

### Lane 1 — Location Queries (cheap model: gpt-4o-mini)
- "show me incidents near Downtown Phoenix"
- "is McDowell Rd safe at night?"
- "incidents near me"

**Flow:**
1. `_extract_location()` resolves location (geocode → GPS → live location → saved home → session → default Phoenix)
2. `get_nearby_incidents()` queries DB within bounding box + haversine filter (5mi, 30 days)
3. `get_incident_stats()` aggregates by category/source/time-of-day
4. `_should_show_cards()` detects card vs narrative intent via keyword matching
5. **Card mode**: builds cards server-side from real DB data, LLM only generates summary sentence
6. **Text mode**: streams response via SSE token-by-token

### Lane 2 — People / ReAct Queries (smart model: gpt-4o)
- "where is Anirudh?"
- "what's my name?"
- "is everyone in my group safe?"

**Flow:**
1. Pre-fetches: user profile, group members, live locations, saved places
2. Injects all pre-fetched data into system prompt (avoids wasted tool calls)
3. Runs ReAct loop (up to 5 iterations) with 6 available tools
4. Returns final answer as text or cards

### Routing Logic (`routing.py`)
Pure Python — no LLM call. Checks in order:
1. Group member name in message → Lane 2
2. Lane 2 keywords ("my group", "my name", "who am i", etc.) → Lane 2
3. Previous turn was Lane 2 + pronoun reference ("he", "she", "which group") → Lane 2
4. Previous turn was Lane 2 + short follow-up pattern → Lane 2
5. Default → Lane 1

## Key Components

### Session State (`state.py`)
- In-memory dict keyed by session_id (max 500 sessions, LRU eviction)
- Tracks: last_location, last_person, last_lane, last 6 messages (3 turns)
- Session ID emitted in SSE stream so frontend can persist it across requests

### Geocoding (`geocoding.py`)
- **Forward**: `geocode_location(place_name)` — Mapbox geocoding API, biased toward Phoenix/Tempe
- **Reverse**: `reverse_geocode(lat, lng)` — converts coordinates to street names (e.g., "E University Dr, Tempe")
- **Batch**: `reverse_geocode_batch(coords)` — parallel reverse geocoding with deduplication
- All results cached in-memory (`_reverse_cache` dict)

### Data Access (`data_access.py`)
All queries go through `InsForgeClient` (PostgREST):
- `get_user_profile(user_id)` — fetch user row from `users` table
- `get_nearby_incidents(lat, lng, radius, days)` — bounding box + haversine filter, sorted by recency
- `get_incident_stats(lat, lng)` — category/source/time-of-day aggregation
- `get_group_members(user_id)` — all members across user's groups (deduplicated)
- `get_live_location(user_id)` — single user's latest coordinates
- `get_saved_places(user_id)` — user's saved locations (home, work, etc.)

### Server-Side Card Building (`handler.py`)
Cards are built from **real DB incident data**, not LLM output. The LLM only generates a summary sentence.
Each card includes: id, category, description, occurred_at, source, verified, lat, lng, location_name (reverse geocoded), distance_miles.

### Location Fallback Chain (`handler.py → _extract_location`)
When the user says "near me" or doesn't specify a location:
1. Geocode the message text (Mapbox)
2. Browser GPS coordinates (if sent by frontend)
3. User's live location from `locations_live` table
4. User's saved "Home" place from `saved_places` table
5. Session's last used location
6. Default: Downtown Phoenix (33.4610, -112.0780)

### Auth Bypass (`DEFAULT_USER_ID`)
- `DEFAULT_USER_ID` env var in `.env` — set to a user UUID
- `get_optional_user()` in `helpers.py` falls back to this when no auth token provided
- For dev/demo only — always acts as this user without login

### Prompt Engineering (`prompts.py`)
- `SYSTEM_PROMPT` (Lane 1): safety communication rules, card/text mode detection, current time
- `REACT_SYSTEM_PROMPT` (Lane 2): tool descriptions, safety rules, current time
- Both inject: user profile (CURRENT USER), conversation context (last_person for pronoun resolution), auth state
- Unauthenticated users get explicit instruction to not pretend personal knowledge

### LLM Integration (`llm.py`)
- `LANE1_MODEL = "gpt-4o-mini"` — cheap, fast for location queries
- `LANE2_MODEL = "gpt-4o"` — smart for multi-step ReAct reasoning
- `stream_lane1()` — streaming token generator
- `call_lane1_no_stream()` — single call for card detection / summary generation
- `call_react_step()` — single ReAct step with tool definitions

### ReAct Loop (`react_loop.py`)
- `execute_tool()` — dispatches tool calls to data_access/geocoding functions
- `run_react_loop()` — iterates up to 5 times, appends tool results to messages
- Force-generates answer if max iterations hit

## SSE Event Protocol

The `/api/chat/` endpoint returns Server-Sent Events:

```
data: {"type": "session", "session_id": "uuid"}
data: {"type": "stream_start", "lane": 1}
data: {"type": "token", "content": "word"}     ← repeated
data: {"type": "cards", "data": {...}}          ← card mode (single event)
data: {"type": "stream_end"}
data: {"type": "error", "content": "..."}
```

## Database Tables Used

- `users` — user profile (display_name, email, age_group)
- `groups` — group metadata (name, type, invite_code)
- `group_members` — membership + display_name + sharing_location flag
- `locations_live` — real-time member coordinates + updated_at
- `saved_places` — user's labeled locations (home, work, etc.)
- `incidents` — incident records (category, description, lat/lng, source, verified, occurred_at)

---

## Issues Faced & Resolved

### 1. KeyError: `"mode"` in SYSTEM_PROMPT (format crash)
**Symptom**: `SYSTEM_PROMPT.format(current_time=now)` raised `KeyError: '"mode"'`
**Cause**: The JSON example `{"mode": "cards"...}` inside the prompt string was interpreted as Python format placeholders
**Fix**: Escaped all curly braces in the JSON example: `{}` → `{{}}`

### 2. No incidents returned (0 results from DB)
**Symptom**: "show incidents near me" returned empty
**Causes** (3 bugs compounded):
1. **Duplicate dict key**: `filters={"lat": "gte...", "lat": "lte..."}` — second key overwrote first, so only upper bound applied
2. **Radius too small**: 0.5mi default missed most data; changed to 5mi
3. **Location mismatch**: Test user locations were in Tempe but 94K incidents are Phoenix PD data
**Fix**: Used PostgREST `and(...)` filter syntax, expanded defaults to 5mi/30 days, moved all test locations to Phoenix hotspots

### 3. LLM pretends to know unauthenticated users
**Symptom**: Without login, chat says "your location", "near you" — user has no identity
**Cause**: `user_id` was always None without auth token, but prompts didn't differentiate
**Fix**: Added `is_authenticated` flag to both prompt builders; unauthenticated prompts explicitly instruct LLM to not reference personal data

### 4. Incident cards show raw lat/lng instead of street names
**Symptom**: Cards display "33.4140, -111.9071" instead of a human-readable address
**Cause**: No reverse geocoding existed; the LLM was asked to generate `location_name` but hallucinated generic text
**Fix**: Added Mapbox reverse geocoding (`reverse_geocode()`) with caching; cards now built server-side from real DB data with proper street names

### 5. LLM fabricates card data
**Symptom**: Card IDs, coordinates, and descriptions didn't match real DB records
**Cause**: The LLM was generating the entire card JSON (including incidents), making up IDs and locations
**Fix**: Moved card building server-side — handler constructs cards from real incident data, LLM only generates a summary sentence

### 6. Session not persisted across messages (no conversation memory)
**Symptom**: Follow-up like "he is in which group?" → "I don't know who you mean"
**Causes**:
1. Backend never emitted `session_id` in SSE events
2. Frontend had `setSessionId` but never called it
3. Every message created a new session — zero history
**Fix**: Backend emits `{"type": "session", "session_id": "..."}` event; frontend captures and reuses it

### 7. Pronoun follow-ups not routed to Lane 2
**Symptom**: "he is in which group?" routes to Lane 1 instead of Lane 2
**Cause**: Routing only checked for explicit member names and keywords; didn't handle pronouns or conversation continuity
**Fix**: Added pronoun detection (`he/she/they/them`) and `which group` to Lane 2 follow-up routing; added `last_person` tracking to session state and prompt context

### 8. NameError: `is_card_mode` not defined
**Symptom**: Server crash on third message with `NameError`
**Cause**: Variable `is_card_mode` was removed during server-side card refactor but `update_session()` still referenced it
**Fix**: Replaced with unconditional `full_response` (always set in both card and text branches)

### 9. "near me" defaults to Downtown Phoenix instead of user's actual location
**Symptom**: Authenticated user says "incidents near me" but gets Downtown Phoenix data
**Cause**: `_extract_location()` only checked GPS and geocoding, not user's DB location
**Fix**: Added fallbacks to user's live location (`locations_live`) and saved home place (`saved_places`) in the cascade
