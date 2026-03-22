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
- All backend routes are prefixed with `/api/` — 9 routers: auth, incidents, chat, briefs, reports, groups, places, location, geocode

### InsForge Integration Rules

- **Always call `fetch-docs` or `fetch-sdk-docs` MCP tool before writing InsForge integration code**
- Use SDK (`@insforge/sdk`) for application logic (auth, DB CRUD, storage, AI)
- Use MCP tools for infrastructure (schema SQL, bucket management, function deployment)
- SDK returns `{data, error}` for all operations
- Database inserts require array format: `[{...}]`
- PostgREST filters use format: `{"column": "op.value"}` (e.g., `{"id": "eq.123"}`)
- Use Tailwind CSS 3.4 — **do not upgrade to v4**

### Frontend Notes

- Next.js 16 has breaking changes vs prior versions — read `node_modules/next/dist/docs/` before modifying Next.js patterns
- UI: shadcn/ui components, Mapbox GL for maps
- InsForge SDK client initialized in `frontend/lib/insforge.ts`
- API client wrapper in `frontend/lib/api.ts`
- TypeScript types in `frontend/types/index.ts` mirror backend Pydantic schemas in `backend/models/schemas.py`

### Database Schema

Defined in `scripts/schema.sql`. Key tables: users, groups, group_members, saved_places, incidents, incident_sources, community_reports, locations_live, brief_cache. Incident categories: theft, assault, vandalism, harassment, vehicle_breakin, disturbance, infrastructure, other. Sources: police, news, community.

## Environment Variables

Frontend needs: `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `NEXT_PUBLIC_API_URL`

Backend needs: `ANTHROPIC_API_KEY`, `MAPBOX_TOKEN`, `TINYFISH_API_KEY`, `INSFORGE_URL`, `INSFORGE_API_KEY`

See `.env.example` for the full template.
