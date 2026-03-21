"""
Add lat/lng coordinates to downloaded Phoenix PD CSVs using grid centroids.

Reads the raw CSVs and grid_centroids.json, produces enriched CSVs with
lat/lng columns. Skips if enriched files already exist.

For rows where the grid code isn't found in the grid lookup, falls back to
Mapbox geocoding of the hundred-block address (rate-limited).

Usage: cd scripts && python geocode_data.py
"""

import csv
import json
import os
import time

import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN")

# Rate limit for Mapbox geocoding (free tier: 600/min)
MAPBOX_DELAY = 0.15  # seconds between calls


def load_grid_centroids() -> dict:
    """Load grid code -> {lat, lng} lookup."""
    path = os.path.join(DATA_DIR, "grid_centroids.json")
    if not os.path.exists(path):
        print("ERROR: grid_centroids.json not found. Run download_data.py first.")
        return {}
    with open(path) as f:
        return json.load(f)


def mapbox_geocode(address: str) -> tuple[float, float] | None:
    """Geocode an address via Mapbox. Returns (lat, lng) or None."""
    if not MAPBOX_TOKEN:
        return None

    # Clean up hundred-block addresses: "13XX E ALMERIA RD" -> "1300 E ALMERIA RD Phoenix AZ"
    clean = address.replace("XX", "00").replace("xx", "00")
    query = f"{clean}, Phoenix, AZ"

    try:
        resp = httpx.get(
            f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json",
            params={
                "access_token": MAPBOX_TOKEN,
                "limit": 1,
                "bbox": "-112.5,33.2,-111.5,33.8",  # Phoenix metro bounding box
            },
            timeout=10,
        )
        if resp.status_code == 200:
            features = resp.json().get("features", [])
            if features:
                coords = features[0]["geometry"]["coordinates"]
                return (round(coords[1], 6), round(coords[0], 6))
    except Exception as e:
        print(f"    Geocode error for '{address}': {e}")
    return None


def geocode_crime_data(grids: dict):
    """Enrich crime_data.csv with lat/lng from grid centroids."""
    input_path = os.path.join(DATA_DIR, "crime_data.csv")
    output_path = os.path.join(DATA_DIR, "crime_data_geo.csv")

    if os.path.exists(output_path):
        print("  SKIP crime_data_geo.csv (already exists)")
        return

    if not os.path.exists(input_path):
        print("  SKIP crime_data.csv (not downloaded yet)")
        return

    print("  Processing crime_data.csv...")
    matched = 0
    geocoded = 0
    missed = 0
    total = 0

    with open(input_path, newline="", encoding="utf-8-sig") as fin, \
         open(output_path, "w", newline="", encoding="utf-8") as fout:

        reader = csv.DictReader(fin)
        fieldnames = reader.fieldnames + ["lat", "lng"]
        writer = csv.DictWriter(fout, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            total += 1
            grid = row.get("GRID", "").strip()
            lat, lng = None, None

            # Try grid centroid first
            if grid and grid in grids:
                lat = grids[grid]["lat"]
                lng = grids[grid]["lng"]
                matched += 1
            else:
                # Fallback: geocode the hundred-block address
                addr = row.get("100 BLOCK ADDR", "").strip()
                if addr and MAPBOX_TOKEN:
                    result = mapbox_geocode(addr)
                    if result:
                        lat, lng = result
                        geocoded += 1
                        time.sleep(MAPBOX_DELAY)
                    else:
                        missed += 1
                else:
                    missed += 1

            row["lat"] = lat or ""
            row["lng"] = lng or ""
            writer.writerow(row)

            if total % 50000 == 0:
                print(f"    Processed {total} rows...")

    print(f"  DONE crime_data_geo.csv — {total} rows: {matched} grid-matched, {geocoded} geocoded, {missed} no coords")


def geocode_calls_data(grids: dict):
    """Enrich calls_for_service CSV with lat/lng from grid centroids."""
    input_path = os.path.join(DATA_DIR, "calls_for_service_2025.csv")
    output_path = os.path.join(DATA_DIR, "calls_for_service_2025_geo.csv")

    if os.path.exists(output_path):
        print("  SKIP calls_for_service_2025_geo.csv (already exists)")
        return

    if not os.path.exists(input_path):
        print("  SKIP calls_for_service_2025.csv (not downloaded yet)")
        return

    print("  Processing calls_for_service_2025.csv...")
    matched = 0
    geocoded = 0
    missed = 0
    total = 0

    with open(input_path, newline="", encoding="utf-8-sig") as fin, \
         open(output_path, "w", newline="", encoding="utf-8") as fout:

        reader = csv.DictReader(fin)
        fieldnames = reader.fieldnames + ["lat", "lng"]
        writer = csv.DictWriter(fout, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            total += 1
            grid = row.get("GRID", "").strip()
            lat, lng = None, None

            if grid and grid in grids:
                lat = grids[grid]["lat"]
                lng = grids[grid]["lng"]
                matched += 1
            else:
                addr = row.get("HUNDREDBLOCKADDR", "").strip()
                if addr and MAPBOX_TOKEN:
                    result = mapbox_geocode(addr)
                    if result:
                        lat, lng = result
                        geocoded += 1
                        time.sleep(MAPBOX_DELAY)
                    else:
                        missed += 1
                else:
                    missed += 1

            row["lat"] = lat or ""
            row["lng"] = lng or ""
            writer.writerow(row)

            if total % 50000 == 0:
                print(f"    Processed {total} rows...")

    print(f"  DONE calls_for_service_2025_geo.csv — {total} rows: {matched} grid-matched, {geocoded} geocoded, {missed} no coords")


def main():
    print("Loading grid centroids...")
    grids = load_grid_centroids()
    if not grids:
        return
    print(f"  Loaded {len(grids)} grid centroids\n")

    print("Geocoding CSVs:")
    geocode_crime_data(grids)
    geocode_calls_data(grids)

    print("\nGeocoding complete.")


if __name__ == "__main__":
    main()
