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
