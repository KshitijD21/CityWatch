"""
Shared normalization functions for scraped data.

- normalize_category: fast keyword match
- classify_incident: OpenAI-powered classifier (fallback when keywords return "other")
- normalize_location: Nominatim (OpenStreetMap) free geocoding
"""

import logging
import time

logger = logging.getLogger(__name__)

# Valid categories
VALID_CATEGORIES = [
    "theft", "assault", "vandalism", "harassment",
    "vehicle_breakin", "disturbance", "infrastructure", "other",
]

CATEGORY_KEYWORDS = {
    "assault": [
        "assault", "battery", "shooting", "stabbing", "attack", "homicide",
        "murder", "shot", "stabbed", "manslaughter", "rape", "shots fired",
        "domestic violence", "aggravated", "armed robbery",
        "officer-involved shooting", "deadly shooting", "fatal shooting",
        "armed suspect", "deadly force",
    ],
    "theft": [
        "theft", "larceny", "shoplifting", "stolen", "robbery", "burglary",
        "rob", "shoplift", "identity theft", "fraud", "package theft",
        "catalytic converter",
    ],
    "vehicle_breakin": [
        "motor vehicle theft", "car theft", "auto theft", "carjack",
        "stolen vehicle", "vehicle theft", "break-in", "burglary from vehicle",
        "vehicle burglary", "smash and grab", "car break-in", "auto burglary",
    ],
    "vandalism": [
        "vandalism", "criminal damage", "graffiti", "property damage",
        "damaged", "arson",
    ],
    "harassment": [
        "harassment", "indecent", "stalking", "threatening", "sexual",
        "threat", "sexual abuse", "indecent exposure", "kidnapping",
        "abduction", "amber alert",
    ],
    "disturbance": [
        "disturbance", "disorderly", "noise", "fight", "trespass", "dui",
        "intoxicated", "domestic", "drunk driver", "hit & run", "hit and run",
        "unwanted guest", "neighbor dispute", "loud party", "road rage",
        "pedestrian struck", "fatal crash", "wrong-way driver", "pursuit",
        "police chase", "standoff", "barricade",
    ],
    "infrastructure": [
        "streetlight", "pothole", "road", "signal", "utility", "power outage",
        "traffic hazard",
    ],
}


def normalize_category(raw_text: str) -> str:
    """Map raw offense/description text to one of 8 standard categories.

    Fast keyword-based matching. Use classify_incident() for AI-powered fallback.
    """
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


# ---------------------------------------------------------------------------
# OpenAI-powered classifier
# ---------------------------------------------------------------------------

_openai_client = None


def _get_openai_client():
    """Lazy-init OpenAI client."""
    global _openai_client
    if _openai_client is None:
        import os
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        try:
            import config
            api_key = config.OPENAI_API_KEY
        except (ImportError, AttributeError):
            api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None
        from openai import OpenAI
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


# Simple in-memory cache for classifications
_classify_cache: dict[str, str] = {}


def classify_incident(text: str) -> str:
    """Classify incident text using OpenAI. Returns a valid category.

    Tries keyword matching first, falls back to OpenAI if result is "other".
    Results are cached in-memory.
    """
    # Fast path: keyword match
    keyword_result = normalize_category(text)
    if keyword_result != "other":
        return keyword_result

    # Check cache
    cache_key = text.strip().lower()[:200]
    if cache_key in _classify_cache:
        return _classify_cache[cache_key]

    # Call OpenAI
    client = _get_openai_client()
    if client is None:
        logger.warning("No OpenAI API key — falling back to keyword classification")
        return "other"

    try:
        resp = client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a crime/safety incident classifier. "
                        "Given an incident description, classify it into exactly ONE of these categories:\n"
                        "- theft: stealing, larceny, shoplifting, robbery, burglary, fraud\n"
                        "- assault: shooting, stabbing, attack, homicide, murder, domestic violence, armed robbery\n"
                        "- vandalism: property damage, graffiti, arson, criminal damage\n"
                        "- harassment: stalking, threats, sexual offenses, kidnapping\n"
                        "- vehicle_breakin: car theft, carjacking, vehicle burglary\n"
                        "- disturbance: traffic incidents, collisions, DUI, hit-and-run, fatal crash, pursuit, standoff, road rage, fights\n"
                        "- infrastructure: road/utility/signal issues\n"
                        "- other: does not fit any category above (weather, community events, non-safety items)\n\n"
                        "Respond with ONLY the category name, nothing else."
                    ),
                },
                {"role": "user", "content": text[:500]},
            ],
            temperature=0,
            max_tokens=20,
        )
        result = resp.choices[0].message.content.strip().lower()

        # Validate
        if result not in VALID_CATEGORIES:
            result = "other"

        _classify_cache[cache_key] = result
        return result

    except Exception as e:
        logger.error(f"OpenAI classification failed: {e}")
        return "other"


def classify_batch(texts: list[str]) -> list[str]:
    """Classify multiple incident texts in a single OpenAI call.

    More efficient than calling classify_incident() for each item.
    """
    if not texts:
        return []

    # First pass: keyword match + cache check
    results = []
    needs_ai = []  # (index, text) pairs that need AI classification
    for i, text in enumerate(texts):
        keyword_result = normalize_category(text)
        if keyword_result != "other":
            results.append(keyword_result)
        else:
            cache_key = text.strip().lower()[:200]
            if cache_key in _classify_cache:
                results.append(_classify_cache[cache_key])
            else:
                results.append(None)  # placeholder
                needs_ai.append((i, text))

    if not needs_ai:
        return results

    client = _get_openai_client()
    if client is None:
        for i, _ in needs_ai:
            results[i] = "other"
        return results

    # Build batch prompt
    numbered = "\n".join(f"{j+1}. {t[:200]}" for j, (_, t) in enumerate(needs_ai))
    categories_str = ", ".join(VALID_CATEGORIES)

    try:
        resp = client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a crime/safety incident classifier. "
                        f"Valid categories: {categories_str}\n"
                        "- theft: stealing, larceny, shoplifting, robbery, burglary, fraud\n"
                        "- assault: shooting, stabbing, attack, homicide, murder, domestic violence\n"
                        "- vandalism: property damage, graffiti, arson, criminal damage, destruction\n"
                        "- harassment: stalking, threats, sexual offenses, kidnapping\n"
                        "- vehicle_breakin: car theft, carjacking, vehicle burglary\n"
                        "- disturbance: traffic collisions, hit-and-run, fatal crash, DUI, pursuit, standoff, road rage, fights\n"
                        "- infrastructure: road/utility/signal issues\n"
                        "- other: does not fit any category\n\n"
                        "For each numbered item, respond with ONLY the category name, one per line. "
                        "Example response:\nassault\ndisturbance\ntheft"
                    ),
                },
                {"role": "user", "content": numbered},
            ],
            temperature=0,
            max_tokens=len(needs_ai) * 20,
        )

        lines = resp.choices[0].message.content.strip().lower().split("\n")
        for j, (i, text) in enumerate(needs_ai):
            if j < len(lines):
                cat = lines[j].strip().rstrip(".")
                # Strip numbering like "1. assault" → "assault"
                if ". " in cat:
                    cat = cat.split(". ", 1)[1]
                if cat in VALID_CATEGORIES:
                    results[i] = cat
                    _classify_cache[text.strip().lower()[:200]] = cat
                else:
                    results[i] = "other"
            else:
                results[i] = "other"

    except Exception as e:
        logger.error(f"OpenAI batch classification failed: {e}")
        for i, _ in needs_ai:
            if results[i] is None:
                results[i] = "other"

    return results


# ---------------------------------------------------------------------------
# Geocoding — Nominatim (OpenStreetMap) — free, no API key
# ---------------------------------------------------------------------------

# Track last request time for rate limiting (1 req/sec per Nominatim policy)
_last_nominatim_request = 0.0


def _nominatim_query(query: str) -> dict | None:
    """Single Nominatim API call. Returns {"lat": ..., "lng": ...} or None."""
    import httpx

    global _last_nominatim_request

    elapsed = time.time() - _last_nominatim_request
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)

    try:
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": query,
                "format": "json",
                "limit": 1,
                "viewbox": "-112.4,33.2,-111.5,33.7",
                "bounded": 1,
            },
            headers={
                "User-Agent": "CityWatch-HackASU/1.0 (safety-app; contact@citywatch.dev)",
            },
            timeout=10.0,
        )
        _last_nominatim_request = time.time()

        if resp.status_code == 200:
            results = resp.json()
            if results:
                return {
                    "lat": float(results[0]["lat"]),
                    "lng": float(results[0]["lon"]),
                }
    except Exception as e:
        logger.warning(f"Nominatim geocoding failed for '{query}': {e}")

    return None


import re

def _rewrite_intersection(address: str) -> list[str]:
    """Generate alternative queries for intersection-style addresses.

    Nominatim struggles with "X and Y Road" format. This generates:
    - "X & Y, City, State" (Nominatim intersection format)
    - Just the first street + city/state (fallback to nearest point)
    """
    alternatives = []

    # Strip "roads", "Road" etc. from generic suffixes that confuse Nominatim
    cleaned = address

    # "Cave Creek and Greenway roads, Phoenix" → "Cave Creek & Greenway, Phoenix"
    # Match "X and Y" pattern
    m = re.match(
        r"^(.+?)\s+and\s+(.+?)(?:\s+roads?)?[,\s]+(.+)$",
        cleaned,
        re.IGNORECASE,
    )
    if m:
        st1, st2, rest = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
        alternatives.append(f"{st1} & {st2}, {rest}")
        alternatives.append(f"{st1}, {rest}")

    # "Interstate 17 and Thunderbird Road" → "I-17 & Thunderbird Road"
    cleaned2 = re.sub(r"Interstate\s+(\d+)", r"I-\1", cleaned)
    if cleaned2 != cleaned:
        alternatives.append(cleaned2)

    # Try with "street" appended if it looks like a number-only address
    # "4000 West Grand Avenue" is fine, but "19th Avenue and Thunderbird Road" might need help
    return alternatives


def normalize_location(address: str) -> dict:
    """Geocode an address to lat/lng via Nominatim (free OpenStreetMap geocoder).

    Returns {"lat": ..., "lng": ...}. Returns 0.0/0.0 on failure.
    Rate-limited to 1 request per second per Nominatim usage policy.

    Tries the original address first, then rewrites for intersection formats.
    """
    if not address or not address.strip():
        return {"lat": 0.0, "lng": 0.0}

    # Try original address
    result = _nominatim_query(address)
    if result:
        return result

    # Try alternative formulations
    for alt in _rewrite_intersection(address):
        result = _nominatim_query(alt)
        if result:
            return result

    return {"lat": 0.0, "lng": 0.0}
