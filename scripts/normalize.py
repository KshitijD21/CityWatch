"""
Shared normalization functions for scraped data.
"""

def normalize_category(raw_category: str) -> str:
    """Map raw category strings to standard categories."""
    # TODO
    return "other"

def normalize_location(address: str) -> dict:
    """Geocode an address to lat/lng."""
    # TODO
    return {"lat": 0.0, "lng": 0.0}
