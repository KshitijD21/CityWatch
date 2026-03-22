#!/usr/bin/env python3
"""
Scrape police + news data via TinyFish. Wrapper around seed_tinyfish.py.

Usage: cd backend/scripts && python3 scrape_news.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


async def main():
    from services.tinyfish_service import scrape_all

    print("Scraping via TinyFish...\n", flush=True)
    result = await scrape_all(since_hours=24)
    print(
        f"\nDone: {result['inserted']} inserted, "
        f"{result['linked']} linked, "
        f"{result['skipped']} skipped, "
        f"{result['errors']} errors"
    )


if __name__ == "__main__":
    asyncio.run(main())
