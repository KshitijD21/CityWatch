#!/usr/bin/env python3
"""
Pipeline preview: scrape all sources via TinyFish async bulk API,
classify + geocode, and output a CSV showing which events are ready for DB ingestion.

Uses AsyncTinyFish SDK: submit all URLs with client.agent.queue(),
then poll with client.runs.get().

Usage:
    cd backend && source venv/bin/activate
    python tests/test_pipeline_preview.py
"""

import asyncio
import csv
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

from tinyfish import AsyncTinyFish, RunStatus

from services.tinyfish_service import (
    _make_police_goal,
    _make_news_goal,
    _get_field,
    _parse_date,
    POLICE_SOURCES,
    NEWS_SOURCES,
)
from utils.normalize import classify_incident, normalize_location


def log(msg):
    print(msg, flush=True)


async def wait_for_completion(client, run_id, poll_interval=5, max_wait=300):
    """Poll a run until it completes or times out."""
    elapsed = 0
    while elapsed < max_wait:
        run = await client.runs.get(run_id)
        if run.status in (RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED):
            return run
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval
    return None


def process_police_item(raw: dict, source_name: str) -> dict:
    """Process a single police item into a row dict."""
    incident_type = _get_field(raw, "type", "type_of_incident", "incident_type", "offense", "crime_type")
    headline = _get_field(raw, "headline", "title")
    text = incident_type or headline or ""
    location = _get_field(raw, "location", "address")
    date_str = _get_field(raw, "date", "date_published", "published")
    time_str = _get_field(raw, "time")
    ext_id = _get_field(raw, "external_id")
    link = _get_field(raw, "url", "article_url", "link")

    category = classify_incident(text) if text else "other"

    lat, lng = 0.0, 0.0
    if location:
        loc_q = location if ("az" in location.lower() or "arizona" in location.lower()) else f"{location}, Phoenix, AZ"
        coords = normalize_location(loc_q)
        lat, lng = coords["lat"], coords["lng"]

    dt = _parse_date(date_str, time_str)

    issues = []
    if category == "other":
        issues.append("category=other")
    if lat == 0.0 and lng == 0.0:
        issues.append("no_coords")
    if dt is None:
        issues.append("no_date")
    if not location:
        issues.append("no_location")

    return {
        "source": source_name,
        "type": "police",
        "text": text[:80],
        "category": category,
        "location": (location or "")[:60],
        "lat": f"{lat:.4f}" if lat else "0",
        "lng": f"{lng:.4f}" if lng else "0",
        "date": dt.strftime("%Y-%m-%d %H:%M") if dt else "",
        "external_id": (ext_id or link or "")[:30],
        "ready": "YES" if not issues else "NO",
        "issues": "; ".join(issues),
    }


def process_news_item(raw: dict, source_name: str) -> dict:
    """Process a single news item into a row dict."""
    headline = _get_field(raw, "headline", "title", "heading")
    location = _get_field(raw, "location", "address", "area")
    date_str = _get_field(raw, "date", "date_published", "published")
    summary = _get_field(raw, "summary", "description", "snippet")
    link = _get_field(raw, "url", "article_url", "link")

    category = classify_incident(headline) if headline else "other"
    if category == "other" and summary:
        category = classify_incident(summary)

    lat, lng = 0.0, 0.0
    if location:
        loc_q = location if ("az" in location.lower() or "arizona" in location.lower()) else f"{location}, AZ"
        coords = normalize_location(loc_q)
        lat, lng = coords["lat"], coords["lng"]

    dt = _parse_date(date_str)

    issues = []
    if category == "other":
        issues.append("category=other")
    if lat == 0.0 and lng == 0.0:
        issues.append("no_coords")
    if dt is None:
        issues.append("no_date")
    if not location:
        issues.append("no_location")

    return {
        "source": source_name,
        "type": "news",
        "text": (headline or "")[:80],
        "category": category,
        "location": (location or "")[:60],
        "lat": f"{lat:.4f}" if lat else "0",
        "lng": f"{lng:.4f}" if lng else "0",
        "date": dt.strftime("%Y-%m-%d %H:%M") if dt else "",
        "external_id": (link or "")[:30],
        "ready": "YES" if not issues else "NO",
        "issues": "; ".join(issues),
    }


def extract_items(result) -> list[dict]:
    """Extract list of items from a run result (could be list, dict, or str)."""
    if isinstance(result, list):
        return result
    if isinstance(result, dict):
        for v in result.values():
            if isinstance(v, list):
                return v
        return [result]
    return []


async def main():
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    since = f"{yesterday} 06:00 AM"
    police_goal = _make_police_goal(since)
    news_goal = _make_news_goal(since)

    log(f"Fetching events since: {since}")

    # Build task list
    tasks = []
    for src in POLICE_SOURCES:
        tasks.append({"label": src["department"], "url": src["url"], "goal": police_goal, "src_type": "police"})
    for src in NEWS_SOURCES:
        tasks.append({"label": src["outlet"], "url": src["url"], "goal": news_goal, "src_type": "news"})

    log(f"Submitting {len(tasks)} TinyFish tasks...\n")

    client = AsyncTinyFish()

    # Submit all tasks concurrently
    submit_coros = [
        client.agent.queue(url=t["url"], goal=t["goal"])
        for t in tasks
    ]
    responses = await asyncio.gather(*submit_coros, return_exceptions=True)

    run_map = {}  # run_id -> task index
    for i, resp in enumerate(responses):
        if isinstance(resp, Exception):
            log(f"  FAILED {tasks[i]['label']}: {resp}")
        else:
            run_map[resp.run_id] = i
            log(f"  Submitted {tasks[i]['label']} → {resp.run_id[:16]}...")

    # Poll all concurrently
    log(f"\nPolling {len(run_map)} tasks (5s interval, 5min max)...")

    poll_coros = [
        wait_for_completion(client, run_id)
        for run_id in run_map.keys()
    ]
    completed_runs = await asyncio.gather(*poll_coros)

    # Process results
    rows = []
    for run_id, run in zip(run_map.keys(), completed_runs):
        idx = run_map[run_id]
        t = tasks[idx]

        if run is None:
            log(f"  {t['label']}: TIMEOUT")
            continue
        if run.status != RunStatus.COMPLETED:
            log(f"  {t['label']}: {run.status} — {getattr(run, 'error', '')}")
            continue

        items = extract_items(run.result)
        log(f"  {t['label']}: {len(items)} items")

        for raw in items:
            if t["src_type"] == "police":
                rows.append(process_police_item(raw, t["label"]))
            else:
                rows.append(process_news_item(raw, t["label"]))

    # --- Output CSV ---
    out_path = os.path.join(os.path.dirname(__file__), "pipeline_preview.csv")
    fields = ["source", "type", "text", "category", "location", "lat", "lng", "date", "external_id", "ready", "issues"]
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    # --- Print summary ---
    total = len(rows)
    ready_count = sum(1 for r in rows if r["ready"] == "YES")
    log(f"\n{'='*80}")
    log(f"TOTAL: {total} events | READY: {ready_count} | NOT READY: {total - ready_count}")
    log(f"CSV saved to: {out_path}")
    log(f"{'='*80}\n")

    # Print table
    log(f"{'Source':<12} {'Type':<7} {'Category':<15} {'Ready':<5} {'Date':<16} {'Text'}")
    log("-" * 120)
    for r in rows:
        log(f"{r['source']:<12} {r['type']:<7} {r['category']:<15} {r['ready']:<5} {r['date']:<16} {r['text'][:60]}")

    if any(r["ready"] == "NO" for r in rows):
        log(f"\n--- Issues ---")
        for r in rows:
            if r["ready"] == "NO":
                log(f"  {r['text'][:60]} → {r['issues']}")


if __name__ == "__main__":
    asyncio.run(main())
