"""
Download Phoenix PD crime data and calls-for-service CSVs.
Also downloads police grid centroids from ArcGIS for geocoding.

Skips downloads if files already exist locally.

Usage: cd backend/scripts && python download_data.py
"""

import os
import json
import httpx

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

DOWNLOADS = {
    "crime_data.csv": (
        "https://www.phoenixopendata.com/dataset/cc08aace-9ca9-467f-b6c1-f0879ab1a358"
        "/resource/0ce3411a-2fc6-4302-a33f-167f68608a20/download/"
        "crime-data_crime-data_crimestat.csv"
    ),
    "calls_for_service_2025.csv": (
        "https://www.phoenixopendata.com/dataset/64a60154-3b2d-4583-8fb5-6d5e1b469c28"
        "/resource/00775c9c-026d-41e5-a4f4-057ad60bea90/download/"
        "calls-for-service_2025-calls-for-service_callsforsrvc2025.csv"
    ),
}

GRID_API_URL = (
    "https://maps.phoenix.gov/pub/rest/services/Public/PoliceCrimeGrid/MapServer/0/query"
)
GRID_FILE = "grid_centroids.json"

# Max records per ArcGIS query
ARCGIS_PAGE_SIZE = 1000


def compute_centroid(rings: list) -> tuple[float, float]:
    """Compute centroid of a polygon from its outer ring (first ring)."""
    ring = rings[0]
    n = len(ring)
    if n == 0:
        return (0.0, 0.0)
    lng_sum = sum(pt[0] for pt in ring)
    lat_sum = sum(pt[1] for pt in ring)
    return (round(lat_sum / n, 6), round(lng_sum / n, 6))


def download_csv(filename: str, url: str):
    """Download a CSV file, following redirects. Skip if already exists."""
    filepath = os.path.join(DATA_DIR, filename)
    if os.path.exists(filepath):
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f"  SKIP {filename} (already exists, {size_mb:.1f} MB)")
        return

    print(f"  Downloading {filename}...")
    with httpx.Client(follow_redirects=True, timeout=300) as client:
        with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with open(filepath, "wb") as f:
                for chunk in resp.iter_bytes(chunk_size=8192):
                    f.write(chunk)

    size_mb = os.path.getsize(filepath) / (1024 * 1024)
    print(f"  DONE {filename} ({size_mb:.1f} MB)")


def download_grid_centroids():
    """Download all police grid polygons from ArcGIS and compute centroids."""
    filepath = os.path.join(DATA_DIR, GRID_FILE)
    if os.path.exists(filepath):
        with open(filepath) as f:
            data = json.load(f)
        print(f"  SKIP {GRID_FILE} (already exists, {len(data)} grids)")
        return

    print("  Downloading police grid polygons from ArcGIS...")
    centroids = {}
    offset = 0

    with httpx.Client(timeout=60) as client:
        while True:
            resp = client.get(GRID_API_URL, params={
                "where": "1=1",
                "outFields": "GRID_NUMBER",
                "returnGeometry": "true",
                "outSR": "4326",
                "f": "json",
                "resultRecordCount": str(ARCGIS_PAGE_SIZE),
                "resultOffset": str(offset),
            })
            resp.raise_for_status()
            data = resp.json()

            features = data.get("features", [])
            if not features:
                break

            for feat in features:
                grid = feat["attributes"]["GRID_NUMBER"].strip()
                rings = feat["geometry"]["rings"]
                lat, lng = compute_centroid(rings)
                centroids[grid] = {"lat": lat, "lng": lng}

            offset += len(features)
            print(f"    Fetched {offset} grids...")

            if len(features) < ARCGIS_PAGE_SIZE:
                break

    with open(filepath, "w") as f:
        json.dump(centroids, f)

    print(f"  DONE {GRID_FILE} ({len(centroids)} grids)")


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"Data directory: {DATA_DIR}\n")

    print("Downloading CSVs:")
    for filename, url in DOWNLOADS.items():
        download_csv(filename, url)

    print("\nDownloading grid centroids:")
    download_grid_centroids()

    print("\nAll downloads complete.")


if __name__ == "__main__":
    main()
