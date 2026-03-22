"""Geocoding via Mapbox — uses MAPBOX_TOKEN from config."""
from __future__ import annotations
import asyncio
import httpx
from config import MAPBOX_TOKEN

_MAPBOX_GEOCODE = "https://api.mapbox.com/geocoding/v5/mapbox.places"

# Cache reverse geocode results to avoid repeated API calls for same coords
_reverse_cache: dict[str, str] = {}


async def geocode_location(place_name: str) -> dict | None:
    """Geocode a place name to lat/lng using Mapbox.
    Returns {"lat": float, "lng": float, "place_name": str} or None.
    """
    if not MAPBOX_TOKEN:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{_MAPBOX_GEOCODE}/{place_name}.json",
                params={
                    "access_token": MAPBOX_TOKEN,
                    "limit": 1,
                    "bbox": "-112.2,33.2,-111.6,33.6",  # Phoenix metro
                },
            )
            if resp.status_code != 200:
                return None
            features = resp.json().get("features", [])
            if not features:
                return None
            coords = features[0]["geometry"]["coordinates"]
            return {
                "lat": coords[1],
                "lng": coords[0],
                "place_name": features[0].get("place_name", place_name),
            }
    except Exception:
        return None


async def reverse_geocode(lat: float, lng: float) -> str:
    """Convert lat/lng to a human-readable street/place name via Mapbox.
    Tries 3 type sets progressively: address/poi → neighborhood/locality → place.
    Falls back to "lat, lng" if all fail.
    """
    cache_key = f"{lat:.4f},{lng:.4f}"
    if cache_key in _reverse_cache:
        return _reverse_cache[cache_key]

    if not MAPBOX_TOKEN:
        fallback = f"{lat:.4f}, {lng:.4f}"
        _reverse_cache[cache_key] = fallback
        return fallback

    type_sets = [
        "address,poi",
        "neighborhood,locality",
        "place",
    ]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            for types in type_sets:
                resp = await client.get(
                    f"{_MAPBOX_GEOCODE}/{lng},{lat}.json",
                    params={
                        "access_token": MAPBOX_TOKEN,
                        "types": types,
                        "limit": 1,
                    },
                )
                if resp.status_code != 200:
                    continue
                features = resp.json().get("features", [])
                if features:
                    place_name = features[0].get("place_name", "")
                    if place_name:
                        # Shorten: keep first 3 parts
                        parts = place_name.split(", ")
                        short = ", ".join(parts[:3]) if len(parts) > 3 else place_name
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
    Uses bounded concurrency to avoid overwhelming the API.
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

    # Reverse geocode uncached with bounded concurrency (10 at a time)
    if unique_coords:
        sem = asyncio.Semaphore(10)

        async def _limited(lat: float, lng: float) -> str:
            async with sem:
                return await reverse_geocode(lat, lng)

        tasks = [_limited(lat, lng) for lat, lng in unique_coords.values()]
        resolved = await asyncio.gather(*tasks)
        for key, place in zip(unique_coords.keys(), resolved):
            results[key] = place

    return results
