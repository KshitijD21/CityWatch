"""
Shared normalization functions for scraped data.
"""

CATEGORY_KEYWORDS = {
    "theft": ["theft", "larceny", "shoplifting", "stolen", "robbery", "burglary", "rob"],
    "assault": ["assault", "battery", "shooting", "stabbing", "attack", "homicide", "murder", "shot", "stabbed"],
    "vandalism": ["vandalism", "criminal damage", "graffiti", "property damage", "damaged"],
    "harassment": ["harassment", "indecent", "stalking", "threatening", "sexual", "threat"],
    "vehicle_breakin": ["vehicle", "break-in", "car theft", "auto theft", "carjack", "gta"],
    "disturbance": ["disturbance", "disorderly", "noise", "fight", "trespass", "dui", "intoxicated", "domestic"],
    "infrastructure": ["streetlight", "pothole", "road", "signal", "utility", "power outage"],
}


def normalize_category(raw_text: str) -> str:
    """Map raw offense/description text to one of 8 standard categories."""
    text = raw_text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
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
