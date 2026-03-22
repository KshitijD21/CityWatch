# Setup & Commands

## First Time Setup

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
pnpm install
```

### Root (for concurrently)
```bash
pnpm install
```

### Env
Copy `.env.example` to `.env` and fill in:
- `INSFORGE_URL`
- `INSFORGE_API_KEY`
- `OPENAI_API_KEY`
- `MAPBOX_TOKEN`

---

## Running

### Both (frontend + backend together)
```bash
pnpm dev
```
Frontend → http://localhost:3000
Backend → http://localhost:8000

### Frontend only
```bash
pnpm dev:frontend
```

### Backend only
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```
Or from root:
```bash
pnpm dev:backend
```

---

## Build & Lint

```bash
pnpm build          # Build frontend
pnpm lint           # Lint frontend (ESLint)
```

---

## Data Scripts

```bash
pnpm seed             # Seed DB via scripts/seed_data.py
pnpm scrape:police    # Run police data scraper
pnpm scrape:news      # Run news data scraper
```

---

## Test Pages

| Page | URL | Purpose |
|---|---|---|
| Chat test | http://localhost:3000/test/chat | Test hybrid chat assistant |

---

## Useful Backend URLs

| Endpoint | Method | Purpose |
|---|---|---|
| /api/health | GET | Health check |
| /api/chat/ | POST | Chat (SSE streaming) |
| /api/incidents/nearby | GET | Nearby incidents |
| /api/incidents/stats | GET | Incident stats |
| /api/auth/signup | POST | Sign up |
| /api/auth/login | POST | Login |
| /api/groups/ | GET/POST | Groups CRUD |
| /api/reports/ | POST | Community reports |
| /api/places/ | GET/POST | Saved places |
| /api/briefs/ | GET | Area briefs |

---

## If venv breaks
```bash
cd backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
