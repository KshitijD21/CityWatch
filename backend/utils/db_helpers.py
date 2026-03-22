"""
Shared database helper functions for data pipeline scripts.
Extracted from seed_data.py for reuse across scrapers.
"""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import InsForgeClient


BATCH_SIZE = 200


async def get_existing_ids(db: InsForgeClient, source_name: str) -> set[str]:
    """Fetch all external_ids already in DB for a given source."""
    existing = set()
    limit = 1000

    while True:
        rows = await db.select(
            "incident_sources",
            columns="external_id",
            filters={"source_name": source_name},
            limit=limit,
        )
        for r in rows:
            existing.add(r["external_id"])
        if len(rows) < limit:
            break

    return existing


async def insert_batch(db: InsForgeClient, pairs: list[tuple[dict, dict]]):
    """Insert a batch of (incident, source) pairs using bulk inserts."""
    incidents = [p[0] for p in pairs]
    sources = [p[1] for p in pairs]

    # Bulk insert all incidents, get back IDs
    results = await db.insert("incidents", incidents)

    # Link source records to their incident IDs
    for source, result in zip(sources, results):
        source["incident_id"] = result["id"]

    # Bulk insert all sources
    await db.insert("incident_sources", sources)
