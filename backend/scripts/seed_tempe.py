#!/usr/bin/env python3
"""
Pull Tempe PD Calls for Service from ArcGIS REST API and insert into DB.

Source: data.tempe.gov — Police Transparency Calls for Service (NIBRS, 2022+)
API: ArcGIS FeatureServer (free, no auth, paginated at 2000 records/request)

Data already has lat/lng — no geocoding needed.

Usage:
    cd backend/scripts && python3 seed_tempe.py
    cd backend/scripts && python3 seed_tempe.py --days 30    # only last 30 days
    cd backend/scripts && python3 seed_tempe.py --force       # re-scan even if already seeded
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

from database import InsForgeClient
from utils.normalize import normalize_category
from utils.db_helpers import get_existing_ids, insert_batch, BATCH_SIZE

# ArcGIS FeatureServer endpoint
FEATURE_SERVER = (
    "https://services.arcgis.com/lQySeXwbBg53XWDi/arcgis/rest/services/"
    "Calls_For_Service/FeatureServer/0/query"
)
PAGE_SIZE = 2000  # ArcGIS max per request
SOURCE_NAME = "tempe_pd_calls"

# Map Tempe CallCategory to our categories (fast path before keyword matching)
CATEGORY_MAP = {
    "Assault/Homicide/Sex Related": "assault",
    "Property": "theft",
    "Vehicle": "vehicle_breakin",
    "Domestic": "disturbance",
    "Threat": "harassment",
    "Drugs/Alcohol": "disturbance",
    "Traffic": "disturbance",
    "Fraud": "theft",
    "Fire": "infrastructure",
}

# Skip these CallCategory values — not safety-relevant
SKIP_CATEGORIES = {
    "Administrative",
    "Health and Welfare",
    "Code Violation",
    "Juvenile",
    "Undefined",
}


def parse_tempe_record(attrs: dict) -> tuple[dict, dict] | None:
    """Parse an ArcGIS feature into (incident, source) tuple."""
    lat = attrs.get("Latitude")
    lng = attrs.get("Longitude")
    if not lat or not lng or lat == 0.0 or lng == 0.0:
        return None

    call_category = attrs.get("CallCategory", "") or ""
    case_type_trans = attrs.get("FinalCaseTypeTrans", "") or ""
    case_type = attrs.get("FinalCaseType", "") or ""

    # Skip non-safety categories
    if call_category in SKIP_CATEGORIES:
        return None

    # Map category: first try direct mapping, then keyword match
    category = CATEGORY_MAP.get(call_category)
    if not category:
        # Try keyword matching on the case type description
        classify_text = case_type_trans or case_type or call_category
        category = normalize_category(classify_text)

    if category == "other":
        # "Other" CallCategory is huge (182K) — try keyword match on case type
        classify_text = case_type_trans or case_type
        if classify_text:
            category = normalize_category(classify_text)
        if category == "other":
            return None

    # Parse timestamp (ArcGIS returns epoch ms)
    ts = attrs.get("OccurrenceDatetime")
    if not ts:
        return None
    occurred_at = datetime.fromtimestamp(ts / 1000)

    primary_key = attrs.get("PrimaryKey", "")
    if not primary_key:
        return None

    address = attrs.get("ObfuscatedAddress", "") or ""
    neighborhood = attrs.get("NeighborhoodName", "") or ""
    description = case_type_trans or case_type or call_category
    if address:
        description = f"{description} at {address}"
    if neighborhood:
        description = f"{description} ({neighborhood})"

    incident = {
        "category": category,
        "description": description[:500],
        "lat": float(lat),
        "lng": float(lng),
        "occurred_at": occurred_at.isoformat(),
        "source": "police",
        "verified": True,
        "report_count": 1,
    }

    source = {
        "source_name": SOURCE_NAME,
        "source_type": "police",
        "external_id": primary_key,
        "url": "https://data.tempe.gov/maps/d2937ee4e83140559d94080237a6e84c",
    }

    return (incident, source)


async def fetch_tempe_data(since_days: int = 200) -> list[dict]:
    """Fetch Tempe calls for service from ArcGIS API with pagination."""
    import httpx

    cutoff = datetime.now(timezone.utc) - timedelta(days=since_days)
    cutoff_str = cutoff.strftime("%Y-%m-%d")

    all_features = []
    offset = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            params = {
                "where": f"OccurrenceDatetime > DATE '{cutoff_str}'",
                "outFields": (
                    "PrimaryKey,OccurrenceDatetime,FinalCaseType,FinalCaseTypeTrans,"
                    "CallCategory,ObfuscatedAddress,Latitude,Longitude,"
                    "NeighborhoodName,CaseStatus"
                ),
                "orderByFields": "OccurrenceDatetime DESC",
                "resultRecordCount": PAGE_SIZE,
                "resultOffset": offset,
                "f": "json",
            }

            resp = await client.get(
                FEATURE_SERVER,
                params=params,
                headers={"User-Agent": "CityWatch-HackASU/1.0"},
            )
            resp.raise_for_status()
            data = resp.json()

            features = data.get("features", [])
            if not features:
                break

            all_features.extend(features)
            print(f"    Fetched {len(all_features)} records...", flush=True)

            # ArcGIS signals no more data when fewer than PAGE_SIZE returned
            if len(features) < PAGE_SIZE:
                break

            offset += PAGE_SIZE

    return all_features


async def main():
    # Parse flags
    days = 200
    force = "--force" in sys.argv
    if "--days" in sys.argv:
        idx = sys.argv.index("--days")
        if idx + 1 < len(sys.argv):
            days = int(sys.argv[idx + 1])

    print(f"Seeding Tempe PD calls for service (last {days} days)\n", flush=True)

    db = InsForgeClient()

    # Check existing records
    print("  Loading existing IDs...", flush=True)
    existing_ids = await get_existing_ids(db, SOURCE_NAME)
    print(f"  Found {len(existing_ids)} existing records", flush=True)

    if existing_ids and not force:
        print(f"  SKIP — already seeded ({len(existing_ids)} records). Use --force to re-scan.")
        return

    # Fetch from ArcGIS API
    print("  Fetching from ArcGIS API...", flush=True)
    features = await fetch_tempe_data(since_days=days)
    print(f"  Total fetched: {len(features)}\n", flush=True)

    # Parse and insert
    inserted = 0
    skipped_parse = 0
    skipped_dup = 0
    batch = []

    for feat in features:
        attrs = feat.get("attributes", {})
        parsed = parse_tempe_record(attrs)

        if parsed is None:
            skipped_parse += 1
            continue

        incident, source = parsed
        if source["external_id"] in existing_ids:
            skipped_dup += 1
            continue

        batch.append((incident, source))
        existing_ids.add(source["external_id"])

        if len(batch) >= BATCH_SIZE:
            await insert_batch(db, batch)
            inserted += len(batch)
            batch = []
            if inserted % 1000 == 0:
                print(f"    Inserted {inserted} records...", flush=True)

    # Final batch
    if batch:
        await insert_batch(db, batch)
        inserted += len(batch)

    print(f"\nDone:", flush=True)
    print(f"  Fetched:   {len(features)}", flush=True)
    print(f"  Inserted:  {inserted}", flush=True)
    print(f"  Skipped:   {skipped_parse} (no coords/category)", flush=True)
    print(f"  Duplicate: {skipped_dup}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
