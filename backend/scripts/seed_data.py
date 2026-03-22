"""
Push geocoded Phoenix PD data into InsForge database.

Reads the enriched CSVs (crime_data_geo.csv, calls_for_service_2025_geo.csv),
normalizes categories, and inserts into the incidents + incident_sources tables.

Skips rows already in DB (dedup by external_id in incident_sources).
Skips rows without lat/lng.

Usage: cd backend/scripts && python seed_data.py
"""

import asyncio
import csv
import os
import sys
from datetime import datetime, timedelta, timezone

# Add backend/ to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

from database import InsForgeClient
from utils.normalize import normalize_category
from utils.db_helpers import get_existing_ids, insert_batch, BATCH_SIZE

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Only seed incidents from the last N days
# Crime CSV ends Sept 2025, calls CSV ends Dec 2025 — 200 days covers both
SEED_DAYS = 200

def parse_crime_row(row: dict) -> tuple[dict, dict] | None:
    """Parse a crime_data_geo.csv row into (incident, source) records."""
    lat = row.get("lat", "").strip()
    lng = row.get("lng", "").strip()
    if not lat or not lng:
        return None

    ucr = row.get("UCR CRIME CATEGORY", "").strip()
    if not ucr:
        return None

    # Parse date — format: "MM/DD/YYYY  HH:MM" (double space)
    date_str = row.get("OCCURRED ON", "").strip()
    if not date_str:
        return None
    try:
        occurred_at = datetime.strptime(date_str, "%m/%d/%Y  %H:%M")
    except ValueError:
        try:
            occurred_at = datetime.strptime(date_str, "%m/%d/%Y %H:%M")
        except ValueError:
            return None

    # Filter by date cutoff
    cutoff = datetime.now(timezone.utc) - timedelta(days=SEED_DAYS)
    if occurred_at < cutoff.replace(tzinfo=None):
        return None

    external_id = row.get("INC NUMBER", "").strip()
    if not external_id:
        return None

    category = normalize_category(ucr)
    addr = row.get("100 BLOCK ADDR", "").strip()
    premise = row.get("PREMISE TYPE", "").strip()
    description = f"{ucr} at {addr}" + (f" ({premise})" if premise else "")

    incident = {
        "category": category,
        "description": description,
        "lat": float(lat),
        "lng": float(lng),
        "occurred_at": occurred_at.isoformat(),
        "source": "police",
        "verified": True,
        "report_count": 1,
    }

    source = {
        "source_name": "phoenix_pd_crime",
        "source_type": "police",
        "external_id": external_id,
        "url": "https://www.phoenixopendata.com/dataset/crime-data",
    }

    return (incident, source)


def parse_calls_row(row: dict) -> tuple[dict, dict] | None:
    """Parse a calls_for_service_2025_geo.csv row into (incident, source) records."""
    lat = row.get("lat", "").strip()
    lng = row.get("lng", "").strip()
    if not lat or not lng:
        return None

    call_type = row.get("FINAL_CALL_TYPE", "").strip()
    if not call_type:
        return None

    # Skip non-actionable dispositions
    disp = row.get("DISPOSITION", "").strip().upper()
    if disp in ("CANCELLED", "DUPLICATE", "TEST"):
        return None

    # Only include safety-relevant call types (skip welfare checks, civil matters, etc.)
    category = normalize_category(call_type)
    if category == "other":
        return None

    date_str = row.get("CALL_RECEIVED", "").strip()
    if not date_str:
        return None
    try:
        occurred_at = datetime.strptime(date_str, "%m/%d/%Y %I:%M:%S %p")
    except ValueError:
        try:
            occurred_at = datetime.strptime(date_str, "%m/%d/%Y %H:%M:%S")
        except ValueError:
            return None

    # Filter by date cutoff
    cutoff = datetime.now(timezone.utc) - timedelta(days=SEED_DAYS)
    if occurred_at < cutoff.replace(tzinfo=None):
        return None

    external_id = row.get("INCIDENT_NUM", "").strip()
    if not external_id:
        return None

    addr = row.get("HUNDREDBLOCKADDR", "").strip()
    disposition = row.get("DISPOSITION", "").strip()
    description = f"{call_type} at {addr}" + (f" — {disposition}" if disposition else "")

    incident = {
        "category": category,
        "description": description,
        "lat": float(lat),
        "lng": float(lng),
        "occurred_at": occurred_at.isoformat(),
        "source": "police",
        "verified": True,
        "report_count": 1,
    }

    source = {
        "source_name": "phoenix_pd_calls",
        "source_type": "police",
        "external_id": external_id,
        "url": "https://www.phoenixopendata.com/dataset/calls-for-service",
    }

    return (incident, source)


async def process_csv(
    db: InsForgeClient,
    filename: str,
    source_name: str,
    parser,
):
    """Process a geocoded CSV and insert into DB."""
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        print(f"  SKIP {filename} (not found — run geocode_data.py first)")
        return

    print(f"  Loading existing IDs for {source_name}...")
    existing_ids = await get_existing_ids(db, source_name)
    print(f"  Found {len(existing_ids)} existing records")

    # Early exit if data already seeded (skip full CSV scan)
    if existing_ids and "--force" not in sys.argv:
        print(f"  SKIP {filename} — already seeded ({len(existing_ids)} records). Use --force to re-scan.")
        return

    print(f"  Processing {filename}...")
    total = 0
    skipped_no_coords = 0
    skipped_duplicate = 0
    skipped_parse = 0
    inserted = 0
    batch = []

    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1

            parsed = parser(row)
            if parsed is None:
                skipped_parse += 1
                continue

            incident, source = parsed
            if source["external_id"] in existing_ids:
                skipped_duplicate += 1
                continue

            batch.append((incident, source))
            existing_ids.add(source["external_id"])

            if len(batch) >= BATCH_SIZE:
                await insert_batch(db, batch)
                inserted += len(batch)
                batch = []

                if inserted % 500 == 0:
                    print(f"    Inserted {inserted} records...")

    # Final batch
    if batch:
        await insert_batch(db, batch)
        inserted += len(batch)

    print(
        f"  DONE {filename} — {total} rows: "
        f"{inserted} inserted, {skipped_duplicate} duplicates, "
        f"{skipped_parse} unparseable"
    )


async def main():
    db = InsForgeClient()

    print("Seeding InsForge database with Phoenix PD data\n")

    print("Crime data:")
    await process_csv(db, "crime_data_geo.csv", "phoenix_pd_crime", parse_crime_row)

    print("\nCalls for service:")
    await process_csv(db, "calls_for_service_2025_geo.csv", "phoenix_pd_calls", parse_calls_row)

    print("\nSeed complete.")


if __name__ == "__main__":
    asyncio.run(main())
