"""Geocoding via Nominatim (OpenStreetMap) — free, no API key needed."""
from __future__ import annotations
import httpx

_NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
_HEADERS = {"User-Agent": "CityWatch/1.0"}

# Cache reverse geocode results to avoid repeated API calls for same coords
_reverse_cache: dict[str, str] = {}


async def geocode_location(place_name: str) -> dict | None:
    """Geocode a place name to lat/lng using Nominatim.
    Returns {"lat": float, "lng": float, "place_name": str} or None.
    """
    params = {
        "q": place_name,
        "format": "json",
        "limit": "1",
        # Bias toward Phoenix/Tempe area
        "viewbox": "-112.2,33.6,-111.6,33.2",
        "bounded": "0",
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{_NOMINATIM_BASE}/search",
                params=params,
                headers=_HEADERS,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if not data:
                return None
            result = data[0]
            return {
                "lat": float(result["lat"]),
                "lng": float(result["lon"]),
                "place_name": result.get("display_name", place_name),
            }
    except Exception:
        return None


async def reverse_geocode(lat: float, lng: float) -> str:
    """Convert lat/lng to a human-readable street/place name via Nominatim.
    Returns a short address string like "123 E University Dr, Tempe".
    Falls back to "lat, lng" if API call fails.
    """
    cache_key = f"{lat:.4f},{lng:.4f}"
    if cache_key in _reverse_cache:
        return _reverse_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{_NOMINATIM_BASE}/reverse",
                params={
                    "lat": str(lat),
                    "lon": str(lng),
                    "format": "json",
                    "zoom": "18",
                },
                headers=_HEADERS,
            )
            if resp.status_code != 200:
                raise ValueError("API error")
            data = resp.json()
            display = data.get("display_name", "")
            if display:
                # Shorten: keep first 2-3 parts for brevity
                parts = display.split(", ")
                short = ", ".join(parts[:3]) if len(parts) > 3 else display
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
