"""
Run pending database migrations against InsForge.
Usage: python migrate.py
"""

import os
import sys
import glob
import httpx
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

INSFORGE_URL = os.getenv("INSFORGE_URL")
INSFORGE_API_KEY = os.getenv("INSFORGE_API_KEY")
MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "migrations")


def get_headers():
    return {
        "Authorization": f"Bearer {INSFORGE_API_KEY}",
        "Content-Type": "application/json",
    }


def run_sql(client: httpx.Client, sql: str) -> dict:
    resp = client.post(
        f"{INSFORGE_URL}/api/database/advance/rawsql",
        headers=get_headers(),
        json={"query": sql},
    )
    if resp.status_code >= 400:
        raise Exception(f"SQL error ({resp.status_code}): {resp.text}")
    return resp.json()


def get_applied(client: httpx.Client) -> set[str]:
    try:
        result = run_sql(client, "SELECT filename FROM _migrations ORDER BY id;")
        return {row["filename"] for row in result.get("rows", [])}
    except Exception:
        # _migrations table doesn't exist yet — create it
        run_sql(client, """
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                filename TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT now()
            );
        """)
        return set()


def get_pending(applied: set[str]) -> list[str]:
    files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))
    return [f for f in files if os.path.basename(f) not in applied]


def apply_migration(client: httpx.Client, filepath: str):
    filename = os.path.basename(filepath)
    with open(filepath) as f:
        sql = f.read()

    # Split on semicolons and run each statement
    statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]
    for stmt in statements:
        # Skip comment-only blocks
        lines = [l for l in stmt.split("\n") if l.strip() and not l.strip().startswith("--")]
        if not lines:
            continue
        run_sql(client, stmt + ";")

    # Record as applied
    run_sql(client, f"INSERT INTO _migrations (filename) VALUES ('{filename}');")
    print(f"  Applied: {filename}")


def main():
    if not INSFORGE_URL or not INSFORGE_API_KEY:
        print("Error: INSFORGE_URL and INSFORGE_API_KEY must be set in .env")
        sys.exit(1)

    client = httpx.Client(timeout=30.0)

    print("Checking migrations...")
    applied = get_applied(client)
    print(f"  Already applied: {len(applied)}")

    pending = get_pending(applied)
    if not pending:
        print("  No pending migrations.")
        return

    print(f"  Pending: {len(pending)}")
    for filepath in pending:
        apply_migration(client, filepath)

    print("Done.")


if __name__ == "__main__":
    main()
