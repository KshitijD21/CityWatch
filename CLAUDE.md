# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CityWatch is a real-time safety awareness app with a live map showing sourced incident data, AI-powered chat/area briefs, and community reporting with verification. Built for HackASU (March 20-22, 2026).

## Commands

```bash
pnpm dev                # Run frontend + backend concurrently
pnpm dev:frontend       # Next.js dev server (localhost:3000)
pnpm dev:backend        # FastAPI dev server (localhost:8000)
pnpm build              # Build frontend
pnpm lint               # Lint frontend (ESLint)
pnpm seed               # Seed database via scripts/seed_data.py
pnpm scrape:police      # Run police data scraper
pnpm scrape:news        # Run news data scraper
```

Backend setup (one-time):
```bash
cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

## Architecture

**Frontend (Next.js 16 / TypeScript)** → **Backend (FastAPI / Python)** → **InsForge (BaaS: PostgreSQL + Auth + Storage)**

- Frontend calls backend API at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`)
- Backend proxies all database operations through InsForge's REST API (`/api/database/records/{table}`) via `InsForgeClient` in `backend/services/insforge_service.py`
- Auth: InsForge issues JWT tokens. Backend validates tokens server-side via InsForge's `/api/auth/sessions/current` endpoint in `backend/utils/helpers.py`. User ID is in `payload["sub"]`
- InsForge auth endpoints: `/api/auth/users` (signup), `/api/auth/sessions` (login), `/api/auth/oauth/{provider}` (OAuth)
- All backend routes are prefixed with `/api/` — 10 routers: auth, incidents, chat, briefs, reports, groups, places, location, geocode, alerts
- Realtime: InsForge handles all WebSocket infrastructure. Backend has zero WebSocket code — it only receives webhook POSTs from InsForge for DB persistence

### Completed Backend Features

- **B5 (Auth):** signup, login, profile CRUD, onboarding flag, `POST /init` for idempotent profile creation — `backend/routers/auth.py`
- **B6 (Verification):** AI-powered community report verification via Claude (background task after report submit) — `backend/services/verification_service.py`
- **B8 (Groups):** create, list, get, join via invite, add/remove members, leave, rename, delete — `backend/routers/groups.py`
- **B10 (Location):** webhook receiver, location update, get group locations, toggle sharing — `backend/routers/location.py`
  - Uses WebSocket + webhook architecture: frontend publishes GPS via InsForge SDK WebSocket, InsForge broadcasts to subscribers and POSTs to our webhook for DB persistence
  - InsForge realtime channel `group:%:locations` is created with webhook URL
  - See `docs/B10_LOCATION_ARCHITECTURE.md` for full architecture
  - InsForge upsert requires `on_conflict` parameter for tables with unique constraints (e.g., `on_conflict="user_id"` for `locations_live`)
- **Incidents:** nearby (haversine), in-bounds, stats aggregation, TinyFish scrape trigger — `backend/routers/incidents.py`
- **Chat:** SSE streaming, two-lane routing, ReAct loop — `backend/routers/chat.py` + `backend/chat/`
- **Briefs:** AI-generated area safety briefs with caching — `backend/routers/briefs.py`
- **Reports:** community report submission, nearby reports (RPC), flagging — `backend/routers/reports.py`
- **Alerts:** recent incidents near user's saved places and live location — `backend/routers/alerts.py`

### InsForge Integration Rules

- **Always call `fetch-docs` or `fetch-sdk-docs` MCP tool before writing InsForge integration code**
- Use SDK (`@insforge/sdk`) for application logic (auth, DB CRUD, storage, AI)
- Use MCP tools for infrastructure (schema SQL, bucket management, function deployment)
- SDK returns `{data, error}` for all operations
- Database inserts require array format: `[{...}]`
- PostgREST filters use format: `{"column": "op.value"}` (e.g., `{"id": "eq.123"}`)
- Upsert uses `Prefer: resolution=merge-duplicates` header + `on_conflict` query param for specifying the unique constraint column
- InsForge realtime webhook sends payload directly as JSON body (not wrapped in `{"payload": {...}}`), with metadata in headers (`X-Insforge-Channel`, `X-Insforge-Event`, `X-Insforge-Message-Id`)
- InsForge realtime channel patterns use `%` as wildcard (not `*`), e.g., `group:%:locations`
- Use Tailwind CSS 3.4 — **do not upgrade to v4**

### Frontend Notes

- Next.js 16 has breaking changes vs prior versions — read `node_modules/next/dist/docs/` before modifying Next.js patterns
- UI: shadcn/ui components, MapLibre GL for maps (not Mapbox GL)
- InsForge SDK: two instances in `frontend/lib/insforge.ts` — `insforge` (direct URL, for realtime WebSocket) and `insforgeAuth` (proxied via Next.js rewrites, for httpOnly cookie auth)
- API client wrapper in `frontend/lib/api.ts`
- TypeScript types in `frontend/types/index.ts` mirror backend Pydantic schemas in `backend/models/schemas.py`

### Database Schema

Defined in `scripts/schema.sql`. Key tables: users, groups, group_members, saved_places, incidents, incident_sources, community_reports, locations_live, brief_cache. Incident categories: theft, assault, vandalism, harassment, vehicle_breakin, disturbance, infrastructure, other. Sources: police, news, community.

## Environment Variables

Frontend needs: `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `NEXT_PUBLIC_API_URL`

Backend needs: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MAPBOX_TOKEN`, `TINYFISH_API_KEY`, `INSFORGE_URL`, `INSFORGE_API_KEY`

See `.env.example` for the full template.

## Rules

### Progress Tracking (MANDATORY)
After every prompt where you add, change, or remove files, update `refer/progress.md`:
- Add a dated section header (e.g., `## 2026-03-21 — Feature Name`)
- Under **Files Added**: list each new file with a one-liner per function/class describing what it does
- Under **Files Changed**: list each modified file with what was changed (function names, config keys, etc.)
- Under **Files Removed**: list any deleted files
- NO paragraphs — bullet points only, concise, function-level detail

### Chat Module
- Chat backend lives in `backend/chat/` (separate module, not in routers/ except the thin router)
- Two lanes: Lane 1 (simple location queries, cheap model), Lane 2 (people/ReAct, smarter model)
- Currently using OpenAI (gpt-4o-mini / gpt-4o) — will switch to Claude later
- Real chat UI at `frontend/app/chat/page.tsx`; test/sandbox UI at `frontend/app/test/chat/`
- Card mode is built server-side from real DB data — LLM only generates the summary sentence. LLM NEVER generates card JSON.
- `_should_show_cards()` in handler.py detects card intent — only explicit phrases like "show incidents", "list incidents". Skips if a person name is in the message.
- Reverse geocoding via Mapbox converts lat/lng to street names for: incident cards (Lane 1), people locations (Lane 2 ReAct tools), and incident results in ReAct tools
- Chat uses `get_optional_user()` — authenticated users get personalized responses (group members, saved places, profile); unauthenticated users can still query location safety but without personalization
- Location fallback chain: geocode message → extract location from patterns ("near X", "Is X safe") → session location (for follow-ups) → GPS (only for "near me") → user's live location → saved home → default Phoenix
- Personal queries ("my name", "who am i", "my group") route to Lane 2 for profile-aware answers
- `get_user_profile()` in data_access.py fetches user row; injected into both lane prompts as CURRENT USER context
- `_extract_radius_from_message()` parses user-requested radius (e.g. "20 miles"), capped at 25mi
- `_extract_days_from_message()` parses time ranges: "today" (1d), "last week" (7d), "last 3 months" (90d), "last year" (365d), hours ("last 48 hr", "24 hours"), date ranges ("from march 10 to march 20", "from 20 march to now"), "since march 10". Default is 7 days when user doesn't specify.
- Session state preserves `last_days` and `last_radius` — follow-up queries ("I want details") reuse the previous time window and radius instead of resetting to defaults.
- Lane 1 text mode streams + collects tokens in one pass (no double LLM call)
- ReAct tool `get_live_location` returns `address` (reverse geocoded), `updated_ago` (relative), `is_stale` flag — never raw coords/timestamps
- ReAct tool `get_nearby_incidents` returns `location_name` and `occurred_ago` on each incident
- `run_react_loop()` returns `ReActResult` with answer + resolved locations; `handle_lane2()` saves resolved lat/lng to session so follow-ups ("check around 20 miles") use the correct center point
- Both lane prompts instruct LLM to never show raw lat/lng or UTC timestamps, always use street names and relative times
- Reverse geocoding tries 3 Mapbox type sets progressively: address/poi → neighborhood/locality → place (avoids raw coords fallback)
- `handle_lane2()` resolves person location from 3 sources: ReAct tool calls → prefetched_locations[mentioned_person] → prefetched_locations[session.last_person] (for pronoun follow-ups)
