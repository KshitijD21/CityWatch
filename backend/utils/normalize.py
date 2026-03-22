"""
Shared normalization functions for scraped data.
"""

CATEGORY_KEYWORDS = {
    "assault": [
        "assault", "battery", "shooting", "stabbing", "attack", "homicide",
        "murder", "shot", "stabbed", "manslaughter", "rape", "shots fired",
        "domestic violence", "aggravated",
    ],
    "theft": [
        "theft", "larceny", "shoplifting", "stolen", "robbery", "burglary",
        "rob", "shoplift", "identity theft", "fraud",
    ],
    "vehicle_breakin": [
        "motor vehicle theft", "car theft", "auto theft", "carjack",
        "stolen vehicle", "vehicle theft", "break-in", "burglary from vehicle",
    ],
    "vandalism": [
        "vandalism", "criminal damage", "graffiti", "property damage",
        "damaged", "arson",
    ],
    "harassment": [
        "harassment", "indecent", "stalking", "threatening", "sexual",
        "threat", "sexual abuse",
    ],
    "disturbance": [
        "disturbance", "disorderly", "noise", "fight", "trespass", "dui",
        "intoxicated", "domestic", "drunk driver", "hit & run", "hit and run",
        "unwanted guest", "neighbor dispute", "loud party",
    ],
    "infrastructure": [
        "streetlight", "pothole", "road", "signal", "utility", "power outage",
        "traffic hazard",
    ],
}


def normalize_category(raw_text: str) -> str:
    """Map raw offense/description text to one of 8 standard categories."""
    text = raw_text.lower()

    # Check longer phrases first across ALL categories to avoid
    # substring collisions (e.g. "motor vehicle theft" matching "theft" before "vehicle_breakin")
    all_pairs = []
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            all_pairs.append((keyword, category))
    all_pairs.sort(key=lambda p: len(p[0]), reverse=True)

    for keyword, category in all_pairs:
        if keyword in text:
            return category
    return "other"


def normalize_location(address: str) -> dict:
    """Geocode an address to lat/lng via Mapbox. Returns {"lat": ..., "lng": ...}."""
    import httpx
    import os

    token = os.getenv("MAPBOX_TOKEN")
    if not token:
        return {"lat": 0.0, "lng": 0.0}

    resp = httpx.get(
        f"https://api.mapbox.com/geocoding/v5/mapbox.places/{address}.json",
        params={"access_token": token, "limit": 1, "bbox": "-112.4,33.2,-111.5,33.7"},
    )
    if resp.status_code == 200:
        features = resp.json().get("features", [])
        if features:
            coords = features[0]["geometry"]["coordinates"]
            return {"lat": coords[1], "lng": coords[0]}
    return {"lat": 0.0, "lng": 0.0}
