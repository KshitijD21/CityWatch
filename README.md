# StreetSense

> See what's happening around you. For real. With sources.

Real-time safety awareness app. Live map with sourced incident data, AI-powered chat and area briefs, community reporting with verification.

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, Mapbox GL
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL (Supabase)
- **AI:** Claude (Anthropic)
- **Data:** TinyFish
- **Maps:** Mapbox

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- Python 3.11+

### Install

```bash
# Clone and install frontend dependencies
pnpm install

# Set up backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

### Run Dev

```bash
# Run both frontend and backend
pnpm dev

# Or separately
pnpm dev:frontend   # localhost:3000
pnpm dev:backend    # localhost:8000
```

## Team

_TBD_

## Hackathon

**HackASU — Claude Builder Club — March 20-22, 2026**
