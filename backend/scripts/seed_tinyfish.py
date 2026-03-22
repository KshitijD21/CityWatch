#!/usr/bin/env python3
"""
Scrape police + news + Reddit data and insert into DB.

Sources:
  - Phoenix PD press releases → TinyFish
  - ABC15 crime news → TinyFish
  - AZFamily crime news → TinyFish
  - Reddit r/phoenix → direct HTTP (free, no TinyFish steps)

Usage:
    cd backend/scripts && python3 seed_tinyfish.py
    cd backend/scripts && python3 seed_tinyfish.py --hours 48   # last 48 hours
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


async def main():
    from services.tinyfish_service import scrape_all

    # Parse --hours flag (default 24)
    hours = 24
    if "--hours" in sys.argv:
        idx = sys.argv.index("--hours")
        if idx + 1 < len(sys.argv):
            hours = int(sys.argv[idx + 1])

    print(f"Scraping police + news via TinyFish (last {hours} hours)...\n", flush=True)

    result = await scrape_all(since_hours=hours)

    print(f"\nDone:", flush=True)
    print(f"  Inserted: {result['inserted']}", flush=True)
    print(f"  Linked:   {result['linked']}", flush=True)
    print(f"  Skipped:  {result['skipped']} (duplicates)", flush=True)
    print(f"  Errors:   {result['errors']}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
