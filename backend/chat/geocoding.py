"""Geocoding via Mapbox API."""
from __future__ import annotations
import httpx
from config import MAPBOX_TOKEN

# Cache reverse geocode results to avoid repeated API calls for same coords
_reverse_cache: dict[str, str] = {}


async def geocode_location(place_name: str) -> dict | None:
    """Geocode a place name to lat/lng using Mapbox.
    Returns {"lat": float, "lng": float, "place_name": str} or None.
    """
    if not MAPBOX_TOKEN:
        return None

    url = "https://api.mapbox.com/geocoding/v5/mapbox.places"
    params = {
        "access_token": MAPBOX_TOKEN,
        "limit": "1",
        "types": "place,neighborhood,locality,poi,address",
        # Bias toward Phoenix/Tempe area
        "proximity": "-111.94,33.42",
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(f"{url}/{place_name}.json", params=params)
        if resp.status_code != 200:
            return None
        data = resp.json()
        features = data.get("features", [])
        if not features:
            return None
        coords = features[0]["geometry"]["coordinates"]
        return {
            "lat": coords[1],
            "lng": coords[0],
            "place_name": features[0].get("place_name", place_name),
        }


async def reverse_geocode(lat: float, lng: float) -> str:
    """Convert lat/lng to a human-readable street/place name via Mapbox.
    Returns a short address string like "123 E University Dr, Tempe".
    Falls back to neighborhood/place if no street address found.
    Falls back to "lat, lng" only if all API calls fail.
    """
    cache_key = f"{lat:.4f},{lng:.4f}"
    if cache_key in _reverse_cache:
        return _reverse_cache[cache_key]

    if not MAPBOX_TOKEN:
        return f"{lat:.4f}, {lng:.4f}"

    # Try progressively broader location types
    type_sets = [
        "address,poi",
        "neighborhood,locality",
        "place",
    ]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            for types in type_sets:
                url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json"
                params = {
                    "access_token": MAPBOX_TOKEN,
                    "limit": "1",
                    "types": types,
                }
                resp = await client.get(url, params=params)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                features = data.get("features", [])
                if features:
                    place = features[0].get("place_name", "")
                    if place:
                        # Shorten: remove country/state suffix for brevity
                        parts = place.split(", ")
                        short = ", ".join(parts[:2]) if len(parts) > 2 else place
                        _reverse_cache[cache_key] = short
                        return short
    except Exception:
        pass
    fallback = f"{lat:.4f}, {lng:.4f}"
    _reverse_cache[cache_key] = fallback
    return fallback


async def reverse_geocode_batch(coords: list[tuple[float, float]]) -> dict[str, str]:
    """Reverse geocode multiple coordinates. Returns {cache_key: place_name}.
    Deduplicates by rounding to 4 decimal places.
    """
    unique_coords: dict[str, tuple[float, float]] = {}
    for lat, lng in coords:
        key = f"{lat:.4f},{lng:.4f}"
        if key not in _reverse_cache:
            unique_coords[key] = (lat, lng)

    results: dict[str, str] = {}

    # Copy cached results
    for lat, lng in coords:
        key = f"{lat:.4f},{lng:.4f}"
        if key in _reverse_cache:
            results[key] = _reverse_cache[key]

    # Reverse geocode uncached (parallel)
    if unique_coords:
        import asyncio
        tasks = [reverse_geocode(lat, lng) for lat, lng in unique_coords.values()]
        resolved = await asyncio.gather(*tasks)
        for key, place in zip(unique_coords.keys(), resolved):
            results[key] = place

    return results
