"""
TinyFish AI browser agent scrapers for police and news data,
plus Reddit r/phoenix direct HTTP scraper.

Sources:
- Phoenix PD → TinyFish (PDF-heavy press releases)
- ABC15 → TinyFish (dynamic news site)
- AZFamily → TinyFish (replaced Fox 10 which always timed out)
- Reddit r/phoenix → direct HTTP JSON API (free, no TinyFish steps)
"""

import asyncio
import hashlib
import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone

# Add backend/ to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import InsForgeClient
from utils.db_helpers import get_existing_ids, insert_batch, BATCH_SIZE
from utils.normalize import classify_incident, normalize_location

logger = logging.getLogger(__name__)

# Max concurrent TinyFish tasks (free tier = 2)
MAX_CONCURRENT = 2
# Max seconds to wait for a single run
RUN_TIMEOUT = int(os.getenv("TINYFISH_RUN_TIMEOUT", "180"))
# Poll interval in seconds
POLL_INTERVAL = 5

# --- TinyFish Sources ---
POLICE_SOURCES = [
    {
        "url": "https://www.phoenix.gov/police/news-and-media/press-releases",
        "name": "Phoenix PD",
    },
]

NEWS_SOURCES = [
    {
        "url": "https://www.abc15.com/news/crime",
        "name": "ABC15",
    },
    {
        "url": "https://www.azfamily.com/news/crime/",
        "name": "AZFamily",
    },
]

# --- Reddit config ---
REDDIT_SUBREDDITS = [
    {"subreddit": "phoenix", "name": "r/phoenix"},
]
REDDIT_USER_AGENT = "CityWatch-HackASU/1.0 (safety-app)"


# --- Goal prompts (timestamp injected dynamically) ---


def _make_police_goal(since: str) -> str:
    return f"""Extract all crime/safety incidents from this page. Return a JSON array where each element has these exact fields:
{{
  "date": "YYYY-MM-DD",
  "time": "HH:MM" or null,
  "type": "description of crime type",
  "location": "street address or intersection, city, AZ",
  "description": "2-3 sentence summary of the incident",
  "external_id": "any case number, incident number, or unique identifier from the page",
  "url": "link to the specific article/report if available, otherwise null"
}}
Only include incidents that occurred AFTER {since}. Skip anything older. Return ONLY the JSON array, no other text."""


def _make_news_goal(since: str) -> str:
    return f"""Find all safety-related news articles on this page about Phoenix, Tempe, Scottsdale, or Mesa, AZ. Return a JSON array where each element has these exact fields:
{{
  "headline": "article headline",
  "summary": "2-3 sentence summary of the incident",
  "location": "street address, intersection, or neighborhood mentioned, city, AZ",
  "date": "YYYY-MM-DD",
  "url": "link to the full article"
}}
Only include articles published AFTER {since} about crime, safety incidents, or public safety concerns. Return ONLY the JSON array, no other text."""


# ---------------------------------------------------------------------------
# TinyFish SDK client
# ---------------------------------------------------------------------------


async def _wait_for_run(client, run_id: str, label: str) -> dict | None:
    """Poll a TinyFish run until completion or timeout."""
    from tinyfish import RunStatus

    elapsed = 0
    while elapsed < RUN_TIMEOUT:
        run = await client.runs.get(run_id)
        if run.status in (RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED):
            if run.status == RunStatus.COMPLETED:
                return run.result
            logger.warning(f"{label}: run {run.status} — {getattr(run, 'error', '')}")
            return None
        await asyncio.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

    logger.warning(f"{label}: timed out after {RUN_TIMEOUT}s")
    return None


def _extract_items(result) -> list[dict]:
    """Extract list of items from a run result."""
    if isinstance(result, list):
        return result
    if isinstance(result, dict):
        for v in result.values():
            if isinstance(v, list):
                return v
        return [result]
    return []


async def call_tinyfish_batch(tasks: list[dict]) -> dict[str, list[dict]]:
    """Submit TinyFish tasks in batches of MAX_CONCURRENT and return results.

    Args:
        tasks: list of {"label": str, "url": str, "goal": str}

    Returns:
        dict mapping label -> list of parsed items
    """
    from tinyfish import AsyncTinyFish

    client = AsyncTinyFish()
    results = {}

    # Process in batches of MAX_CONCURRENT
    for i in range(0, len(tasks), MAX_CONCURRENT):
        batch = tasks[i : i + MAX_CONCURRENT]
        print(f"  Submitting batch {i // MAX_CONCURRENT + 1} ({len(batch)} tasks)...", flush=True)

        # Submit batch concurrently
        submit_coros = [
            client.agent.queue(url=t["url"], goal=t["goal"])
            for t in batch
        ]
        responses = await asyncio.gather(*submit_coros, return_exceptions=True)

        # Map run_ids to labels
        polls = []
        for t, resp in zip(batch, responses):
            if isinstance(resp, Exception):
                print(f"    FAILED to submit {t['label']}: {resp}", flush=True)
                results[t["label"]] = []
                continue
            print(f"    Submitted {t['label']} → {resp.run_id[:16]}...", flush=True)
            polls.append((t["label"], resp.run_id))

        # Poll batch concurrently
        if polls:
            poll_coros = [_wait_for_run(client, rid, label) for label, rid in polls]
            poll_results = await asyncio.gather(*poll_coros)

            for (label, _), raw_result in zip(polls, poll_results):
                if raw_result is None:
                    print(f"    {label}: no result", flush=True)
                    results[label] = []
                else:
                    items = _extract_items(raw_result)
                    print(f"    {label}: {len(items)} items", flush=True)
                    results[label] = items

    return results


# ---------------------------------------------------------------------------
# Reddit r/phoenix scraper (direct HTTP — no TinyFish steps burned)
# ---------------------------------------------------------------------------


async def scrape_reddit(since_dt: datetime) -> list[dict]:
    """Fetch recent posts from r/phoenix and filter for safety-related content.

    Uses Reddit's public JSON API (no auth needed, 30 req/min).
    Returns list of parsed raw dicts matching news item format.
    """
    import httpx

    all_items = []

    for src in REDDIT_SUBREDDITS:
        subreddit = src["subreddit"]
        label = src["name"]
        url = f"https://www.reddit.com/r/{subreddit}/new.json?limit=50"

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    url,
                    headers={"User-Agent": REDDIT_USER_AGENT},
                    timeout=15.0,
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            print(f"    {label}: fetch failed — {e}", flush=True)
            continue

        posts = data.get("data", {}).get("children", [])
        count = 0

        for post in posts:
            p = post.get("data", {})

            # Filter by time
            created_utc = p.get("created_utc", 0)
            post_dt = datetime.fromtimestamp(created_utc, tz=timezone.utc)
            if post_dt < since_dt.replace(tzinfo=timezone.utc):
                continue

            title = p.get("title", "")
            selftext = p.get("selftext", "")
            permalink = p.get("permalink", "")

            # Extract location from title or selftext
            location = _extract_phoenix_location(title + " " + selftext)
            if not location:
                continue

            all_items.append({
                "headline": title[:300],
                "summary": selftext[:500] if selftext else title,
                "location": location,
                "date": post_dt.strftime("%Y-%m-%d"),
                "url": f"https://www.reddit.com{permalink}" if permalink else "",
                "_reddit_id": p.get("id", ""),
            })
            count += 1

        print(f"    {label}: {count} safety-related posts", flush=True)

    return all_items


def _extract_phoenix_location(text: str) -> str:
    """Try to extract a Phoenix-area location from Reddit post text.

    Looks for intersection patterns, street addresses, and neighborhood names.
    Returns empty string if no location found.
    """
    # Common Phoenix neighborhoods/areas
    areas = [
        "Downtown Phoenix", "Midtown", "Uptown", "Arcadia", "Biltmore",
        "Maryvale", "Laveen", "Ahwatukee", "South Mountain", "North Phoenix",
        "Central Phoenix", "West Phoenix", "East Phoenix", "Encanto",
        "Camelback", "Paradise Valley", "Deer Valley", "Anthem",
        "Sunnyslope", "Alhambra", "Estrella", "North Gateway",
        "Desert Ridge", "Norterra", "South Phoenix",
        "Tempe", "Scottsdale", "Mesa", "Chandler", "Gilbert", "Glendale",
        "Peoria", "Surprise", "Avondale", "Goodyear", "Buckeye",
    ]

    text_lower = text.lower()

    # Look for street address pattern: "1234 W Main St"
    addr_match = re.search(
        r"\b(\d{2,5}\s+[NSEW]\.?\s+\w[\w\s]{2,30}(?:St|Ave|Blvd|Dr|Rd|Way|Ln|Pkwy|Ct|Pl|Loop)\.?)\b",
        text, re.IGNORECASE,
    )
    if addr_match:
        return f"{addr_match.group(1)}, Phoenix, AZ"

    # Look for intersection: "19th Ave and Camelback" or "I-17 & Northern"
    intersection_match = re.search(
        r"\b([\w\d]+(?:st|nd|rd|th)?\s+(?:Ave|St|Blvd|Dr|Rd|Way)\s*(?:and|&)\s*[\w\s]+(?:Ave|St|Blvd|Dr|Rd|Way)?)\b",
        text, re.IGNORECASE,
    )
    if intersection_match:
        return f"{intersection_match.group(1)}, Phoenix, AZ"

    # Look for freeway references: "I-17", "I-10", "Loop 101", "Loop 202"
    freeway_match = re.search(
        r"\b((?:I-\d+|Loop\s+\d+|SR\s+\d+|US\s+\d+)\s*(?:and|&|near|at)\s+[\w\s]+)\b",
        text, re.IGNORECASE,
    )
    if freeway_match:
        return f"{freeway_match.group(1)}, Phoenix, AZ"

    # Look for named areas
    for area in areas:
        if area.lower() in text_lower:
            return f"{area}, AZ"

    return ""


def parse_reddit_item(raw: dict) -> tuple[dict, dict] | None:
    """Convert a Reddit post into (incident, source) tuple."""
    headline = raw.get("headline", "")
    location = raw.get("location", "")

    if not headline or not location:
        return None

    date_str = raw.get("date", "")
    occurred_at = _parse_date(date_str)
    if not occurred_at:
        return None

    # Classify from headline, fall back to summary
    category = classify_incident(headline)
    if category == "other":
        summary = raw.get("summary", "")
        if summary:
            category = classify_incident(summary)
        if category == "other":
            return None

    coords = normalize_location(location)
    if coords["lat"] == 0.0 and coords["lng"] == 0.0:
        return None

    reddit_url = raw.get("url", "")
    reddit_id = raw.get("_reddit_id", "")
    external_id = reddit_url or f"reddit:{reddit_id}" if reddit_id else _generate_external_id("reddit", raw)

    description = raw.get("summary", "") or headline

    incident = {
        "category": category,
        "description": description[:500],
        "lat": coords["lat"],
        "lng": coords["lng"],
        "occurred_at": occurred_at.isoformat(),
        "source": "community",
        "verified": False,
        "report_count": 1,
    }

    source = {
        "source_name": "reddit",
        "source_type": "community",
        "external_id": external_id,
        "url": reddit_url or None,
    }

    return (incident, source)


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _generate_external_id(source_prefix: str, raw: dict) -> str:
    """Generate a stable external_id from raw data when none exists."""
    ext_id = raw.get("external_id", "")
    if ext_id and str(ext_id).strip():
        return str(ext_id).strip()

    key = f"{source_prefix}:{raw.get('date', '')}:{raw.get('description', raw.get('headline', ''))[:50]}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _parse_date(date_str: str, time_str: str | None = None) -> datetime | None:
    """Parse date and optional time strings into a datetime."""
    if not date_str:
        return None

    date_str = date_str.strip()
    formats = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%I:%M %p, %b %d, %Y",
        "%I:%M %p, %B %d, %Y",
        "%b %d, %Y %I:%M %p",
        "%B %d, %Y %I:%M %p",
    ]

    dt = None
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            break
        except ValueError:
            continue

    if dt is None:
        return None

    if time_str and time_str.strip():
        try:
            t = datetime.strptime(time_str.strip(), "%H:%M")
            dt = dt.replace(hour=t.hour, minute=t.minute)
        except ValueError:
            pass

    return dt


def _get_field(raw: dict, *keys: str) -> str:
    """Get the first non-empty value from multiple possible field names."""
    for key in keys:
        val = raw.get(key, "")
        if val and str(val).strip():
            return str(val).strip()
    return ""


def parse_police_item(raw: dict) -> tuple[dict, dict] | None:
    """Convert a TinyFish police result into (incident, source) tuple."""
    incident_type = _get_field(raw, "type", "type_of_incident", "incident_type", "offense", "crime_type")
    location = _get_field(raw, "location", "address")
    headline = _get_field(raw, "headline", "title")

    categorize_text = incident_type or headline
    if not categorize_text or not location:
        return None

    date_str = _get_field(raw, "date", "date_published", "published")
    time_str = _get_field(raw, "time")
    occurred_at = _parse_date(date_str, time_str)
    if not occurred_at:
        return None

    category = classify_incident(categorize_text)
    if category == "other":
        return None

    loc_for_geocode = location
    if "az" not in location.lower() and "arizona" not in location.lower():
        loc_for_geocode = f"{location}, Phoenix, AZ"
    coords = normalize_location(loc_for_geocode)
    if coords["lat"] == 0.0 and coords["lng"] == 0.0:
        return None

    external_id = _generate_external_id("police", raw)
    description = _get_field(raw, "description", "summary") or f"{categorize_text} at {location}"

    incident = {
        "category": category,
        "description": description[:500],
        "lat": coords["lat"],
        "lng": coords["lng"],
        "occurred_at": occurred_at.isoformat(),
        "source": "police",
        "verified": True,
        "report_count": 1,
    }

    source = {
        "source_name": "tinyfish_police",
        "source_type": "police",
        "external_id": external_id,
        "url": _get_field(raw, "url", "article_url", "link"),
    }

    return (incident, source)


def parse_news_item(raw: dict) -> tuple[dict, dict] | None:
    """Convert a TinyFish news result into (incident, source) tuple."""
    headline = _get_field(raw, "headline", "title", "heading")
    location = _get_field(raw, "location", "address", "area")

    if not headline or not location:
        return None

    date_str = _get_field(raw, "date", "date_published", "published")
    occurred_at = _parse_date(date_str)
    if not occurred_at:
        return None

    category = classify_incident(headline)
    if category == "other":
        summary = _get_field(raw, "summary", "description", "snippet")
        if summary:
            category = classify_incident(summary)
        if category == "other":
            return None

    loc_for_geocode = location
    if "az" not in location.lower() and "arizona" not in location.lower():
        loc_for_geocode = f"{location}, AZ"
    coords = normalize_location(loc_for_geocode)
    if coords["lat"] == 0.0 and coords["lng"] == 0.0:
        return None

    article_url = _get_field(raw, "url", "article_url", "link")
    external_id = article_url if article_url else _generate_external_id("news", raw)

    description = _get_field(raw, "summary", "description", "snippet") or headline

    incident = {
        "category": category,
        "description": description[:500],
        "lat": coords["lat"],
        "lng": coords["lng"],
        "occurred_at": occurred_at.isoformat(),
        "source": "news",
        "verified": False,
        "report_count": 1,
    }

    source = {
        "source_name": "tinyfish_news",
        "source_type": "news",
        "external_id": external_id,
        "url": article_url or None,
    }

    return (incident, source)


# ---------------------------------------------------------------------------
# Smart-linking (news → existing police incident)
# ---------------------------------------------------------------------------


async def find_matching_incident(
    db: InsForgeClient,
    category: str,
    lat: float,
    lng: float,
    occurred_at: str,
    window_hours: int = 48,
) -> str | None:
    """Find an existing incident matching by category, location (~0.5mi), and time (±48h)."""
    DELTA = 0.007  # ~0.5 miles in degrees

    dt = datetime.fromisoformat(occurred_at)
    dt_min = (dt - timedelta(hours=window_hours)).isoformat()
    dt_max = (dt + timedelta(hours=window_hours)).isoformat()

    try:
        candidates = await db.select(
            "incidents",
            columns="id,lat,lng,occurred_at",
            filters={"category": category},
            limit=100,
        )

        for row in candidates:
            r_lat = float(row["lat"])
            r_lng = float(row["lng"])
            r_dt = row["occurred_at"]

            if abs(r_lat - lat) > DELTA or abs(r_lng - lng) > DELTA:
                continue
            if r_dt < dt_min or r_dt > dt_max:
                continue

            return row["id"]

    except Exception as e:
        logger.warning(f"Smart-linking query failed: {e}")

    return None


# ---------------------------------------------------------------------------
# Orchestrators
# ---------------------------------------------------------------------------


async def scrape_all(since_hours: int = 24) -> dict:
    """Scrape all sources: TinyFish (police + news) + Reddit.

    Args:
        since_hours: only include incidents from the last N hours

    Returns:
        {"inserted": N, "linked": N, "skipped": N, "errors": N}
    """
    since_dt = datetime.now() - timedelta(hours=since_hours)
    since = since_dt.strftime("%Y-%m-%d %I:%M %p")
    print(f"  Filtering incidents since: {since}", flush=True)

    # Build TinyFish tasks
    police_goal = _make_police_goal(since)
    news_goal = _make_news_goal(since)

    tf_tasks = []
    for src in POLICE_SOURCES:
        tf_tasks.append({"label": src["name"], "url": src["url"], "goal": police_goal, "type": "police"})
    for src in NEWS_SOURCES:
        tf_tasks.append({"label": src["name"], "url": src["url"], "goal": news_goal, "type": "news"})

    # Run TinyFish and Reddit concurrently
    print("  Fetching Reddit r/phoenix...", flush=True)
    tinyfish_coro = call_tinyfish_batch(
        [{"label": t["label"], "url": t["url"], "goal": t["goal"]} for t in tf_tasks]
    )
    reddit_coro = scrape_reddit(since_dt)

    raw_results, reddit_items = await asyncio.gather(tinyfish_coro, reddit_coro)

    # Build a type lookup
    type_map = {t["label"]: t["type"] for t in tf_tasks}

    # Parse all items
    all_parsed = []  # (incident, source, src_type)
    errors = 0

    # TinyFish results
    for label, items in raw_results.items():
        src_type = type_map.get(label, "news")
        for raw in items:
            if src_type == "police":
                parsed = parse_police_item(raw)
            else:
                parsed = parse_news_item(raw)

            if parsed is None:
                errors += 1
                continue
            all_parsed.append((*parsed, src_type))

    # Reddit results
    for raw in reddit_items:
        parsed = parse_reddit_item(raw)
        if parsed is None:
            errors += 1
            continue
        all_parsed.append((*parsed, "community"))

    if not all_parsed:
        return {"inserted": 0, "linked": 0, "skipped": 0, "errors": errors}

    # Dedup + insert
    db = InsForgeClient()
    existing_police = await get_existing_ids(db, "tinyfish_police")
    existing_news = await get_existing_ids(db, "tinyfish_news")
    existing_reddit = await get_existing_ids(db, "reddit")

    existing_map = {
        "police": existing_police,
        "news": existing_news,
        "community": existing_reddit,
    }

    new_pairs = []
    link_sources = []
    skipped = 0
    linked = 0

    for incident, source, src_type in all_parsed:
        existing = existing_map.get(src_type, existing_news)
        if source["external_id"] in existing:
            skipped += 1
            continue
        existing.add(source["external_id"])

        # News/community: try smart-linking to existing police incident
        if src_type in ("news", "community"):
            match_id = await find_matching_incident(
                db, incident["category"], incident["lat"], incident["lng"], incident["occurred_at"],
            )
            if match_id:
                source["incident_id"] = match_id
                link_sources.append(source)
                linked += 1
                print(f"    Linked {source['external_id'][:30]}... → {match_id[:8]}...", flush=True)
                continue

        new_pairs.append((incident, source))

    # Bulk insert new incidents
    if new_pairs:
        for i in range(0, len(new_pairs), BATCH_SIZE):
            chunk = new_pairs[i : i + BATCH_SIZE]
            await insert_batch(db, chunk)
        print(f"  Inserted {len(new_pairs)} new incidents", flush=True)

    # Insert linked source records
    if link_sources:
        await db.insert("incident_sources", link_sources)
        print(f"  Linked {len(link_sources)} to existing incidents", flush=True)

    return {
        "inserted": len(new_pairs),
        "linked": linked,
        "skipped": skipped,
        "errors": errors,
    }
