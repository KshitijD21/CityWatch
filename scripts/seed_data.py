"""
Seed the database with hardcoded Phoenix/Tempe area incidents.
Usage: cd scripts && python seed_data.py
"""

import asyncio
import random
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from database import InsForgeClient
from normalize import normalize_category

# Area centers with names
LOCATIONS = [
    {"name": "Downtown Phoenix", "lat": 33.4484, "lng": -112.0740},
    {"name": "ASU Tempe Campus", "lat": 33.4242, "lng": -111.9281},
    {"name": "Tempe Town Lake", "lat": 33.4312, "lng": -111.8883},
    {"name": "Mill Avenue", "lat": 33.4256, "lng": -111.9400},
    {"name": "Sky Harbor Area", "lat": 33.4373, "lng": -112.0078},
    {"name": "Old Town Scottsdale", "lat": 33.4942, "lng": -111.9261},
    {"name": "South Mountain", "lat": 33.3700, "lng": -112.0650},
    {"name": "Camelback Corridor", "lat": 33.5100, "lng": -112.0200},
]

# Incident templates: (description, category, source, verified)
POLICE_INCIDENTS = [
    ("Aggravated assault reported near intersection", "assault", "police", True),
    ("Armed robbery at convenience store", "theft", "police", True),
    ("Vehicle stolen from parking lot", "vehicle_breakin", "police", True),
    ("Domestic disturbance call, officers responded", "disturbance", "police", True),
    ("Shoplifting incident at retail store", "theft", "police", True),
    ("Battery reported outside bar", "assault", "police", True),
    ("Bicycle theft from bike rack", "theft", "police", True),
    ("Criminal damage to vehicle, windows smashed", "vandalism", "police", True),
    ("Disorderly conduct near transit stop", "disturbance", "police", True),
    ("Theft from vehicle, items taken from unlocked car", "vehicle_breakin", "police", True),
    ("Trespassing reported at construction site", "disturbance", "police", True),
    ("Graffiti vandalism on commercial building", "vandalism", "police", True),
    ("Purse snatching in parking garage", "theft", "police", True),
    ("Road rage incident on freeway exit", "disturbance", "police", True),
    ("Catalytic converter theft from parked vehicle", "vehicle_breakin", "police", True),
    ("Aggravated assault with deadly weapon", "assault", "police", True),
    ("Package theft from residential porch", "theft", "police", True),
    ("DUI checkpoint arrest", "disturbance", "police", True),
    ("Stalking report filed", "harassment", "police", True),
    ("Threatening behavior at bus stop", "harassment", "police", True),
    ("Hit and run collision", "disturbance", "police", True),
    ("Burglary at residential property", "theft", "police", True),
    ("Indecent exposure near park", "harassment", "police", True),
    ("Vandalism to public restroom facility", "vandalism", "police", True),
    ("Shots fired call, no injuries reported", "assault", "police", True),
    ("Car break-in at trailhead parking", "vehicle_breakin", "police", True),
    ("Robbery at ATM location", "theft", "police", True),
    ("Physical altercation outside nightclub", "assault", "police", True),
    ("Stolen vehicle recovered", "vehicle_breakin", "police", True),
    ("Assault on transit passenger", "assault", "police", True),
    ("Larceny from retail establishment", "theft", "police", True),
    ("Property damage to park bench and signage", "vandalism", "police", True),
    ("Noise complaint at apartment complex", "disturbance", "police", True),
    ("Fight at intersection, multiple parties", "disturbance", "police", True),
    ("Theft of construction equipment", "theft", "police", True),
    ("Threatening messages reported", "harassment", "police", True),
    ("Smash and grab at electronics store", "theft", "police", True),
    ("Intoxicated individual causing disturbance", "disturbance", "police", True),
    ("Assault during attempted robbery", "assault", "police", True),
    ("Vehicle vandalism in residential area", "vandalism", "police", True),
    ("Attempted carjacking at gas station", "vehicle_breakin", "police", True),
    ("Sexual harassment complaint filed", "harassment", "police", True),
    ("Breaking and entering at office building", "theft", "police", True),
    ("Damaged streetlight reported", "infrastructure", "police", True),
    ("Power line down causing road closure", "infrastructure", "police", True),
    ("Pothole causing traffic hazard", "infrastructure", "police", True),
    ("Suspicious package investigation", "other", "police", True),
    ("Welfare check led to medical emergency", "other", "police", True),
    ("Warrant arrest during traffic stop", "other", "police", True),
    ("Missing person report filed", "other", "police", True),
]

NEWS_INCIDENTS = [
    ("Police investigating string of car break-ins near ASU campus", "vehicle_breakin", "news", True),
    ("Armed robbery at downtown Phoenix convenience store caught on camera", "theft", "news", True),
    ("Shooting near Mill Avenue leaves one injured", "assault", "news", True),
    ("Multiple vehicles vandalized in Tempe apartment complex", "vandalism", "news", True),
    ("Phoenix PD increases patrols after series of thefts near Sky Harbor", "theft", "news", True),
    ("Scottsdale police arrest suspect in assault case", "assault", "news", True),
    ("Road closure due to downed power lines in South Mountain area", "infrastructure", "news", True),
    ("DUI arrests spike near Tempe Town Lake over weekend", "disturbance", "news", True),
    ("Community concern grows over porch package thefts in Camelback area", "theft", "news", True),
    ("Tempe police investigate harassment incidents near campus", "harassment", "news", True),
]

COMMUNITY_INCIDENTS = [
    ("Saw someone break into a car on my street", "vehicle_breakin", "community", False),
    ("Loud argument and yelling near the park, felt unsafe", "disturbance", "community", False),
    ("Graffiti appeared overnight on multiple buildings", "vandalism", "community", True),
    ("Person aggressively panhandling and following people", "harassment", "community", False),
    ("Broken streetlight making the sidewalk very dark", "infrastructure", "community", True),
    ("Suspicious activity near the bike racks at night", "other", "community", False),
    ("Witnessed a hit and run at the intersection", "disturbance", "community", True),
]


def jitter(center: float, max_offset: float = 0.005) -> float:
    """Add random offset to a coordinate (±max_offset degrees ≈ ±500m)."""
    return round(center + random.uniform(-max_offset, max_offset), 6)


def random_time(days_back: int = 30) -> str:
    """Generate a random timestamp within the last N days."""
    now = datetime.now(timezone.utc)
    offset = timedelta(
        days=random.randint(0, days_back),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )
    return (now - offset).isoformat()


def build_incidents() -> list[tuple[dict, dict]]:
    """Build incident + source record pairs."""
    results = []
    all_templates = POLICE_INCIDENTS + NEWS_INCIDENTS + COMMUNITY_INCIDENTS

    for i, (desc, category, source, verified) in enumerate(all_templates):
        loc = random.choice(LOCATIONS)
        occurred_at = random_time()

        incident = {
            "category": category,
            "description": f"{desc} — near {loc['name']}",
            "lat": jitter(loc["lat"]),
            "lng": jitter(loc["lng"]),
            "occurred_at": occurred_at,
            "source": source,
            "verified": verified,
            "report_count": random.randint(1, 3) if source == "community" else 1,
        }

        source_record = {
            "source_name": f"seed_{source}",
            "source_type": source,
            "external_id": f"seed_{i:04d}",
        }

        results.append((incident, source_record))

    return results


async def main():
    db = InsForgeClient()
    pairs = build_incidents()

    print(f"Inserting {len(pairs)} seed incidents...")

    # Check for existing seed data to avoid duplicates
    existing = await db.select(
        "incident_sources",
        columns="external_id",
        filters={"source_name": "like.seed_*"},
    )
    existing_ids = {r["external_id"] for r in existing}

    inserted = 0
    skipped = 0

    for incident, source_rec in pairs:
        if source_rec["external_id"] in existing_ids:
            skipped += 1
            continue

        # Insert incident, get back the ID
        result = await db.insert("incidents", incident)
        incident_id = result[0]["id"]

        # Insert source record linked to incident
        source_rec["incident_id"] = incident_id
        await db.insert("incident_sources", source_rec)
        inserted += 1

    print(f"Done: {inserted} inserted, {skipped} skipped (already exist)")
    print(f"Total incidents in DB: {inserted + skipped}")


if __name__ == "__main__":
    asyncio.run(main())
