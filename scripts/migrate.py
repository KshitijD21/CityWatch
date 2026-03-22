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


def split_sql(sql: str) -> list[str]:
    """Split SQL into statements, respecting dollar-quoted blocks ($$..$$)."""
    import re
    statements = []
    current = []
    in_dollar_quote = False
    dollar_tag = None

    for line in sql.split("\n"):
        stripped = line.strip()
        # Skip pure comment lines outside statements
        if not current and (not stripped or stripped.startswith("--")):
            continue

        # Track $$ dollar quoting
        dollar_matches = re.findall(r'\$[a-zA-Z_]*\$', line)
        for tag in dollar_matches:
            if not in_dollar_quote:
                in_dollar_quote = True
                dollar_tag = tag
            elif tag == dollar_tag:
                in_dollar_quote = False
                dollar_tag = None

        current.append(line)

        # Statement ends at semicolon (only outside $$ blocks)
        if not in_dollar_quote and stripped.endswith(";"):
            stmt = "\n".join(current).strip()
            if stmt and not all(l.strip().startswith("--") or not l.strip() for l in current):
                statements.append(stmt)
            current = []

    # Handle trailing statement without semicolon
    if current:
        stmt = "\n".join(current).strip()
        if stmt and not all(l.strip().startswith("--") or not l.strip() for l in current):
            if not stmt.endswith(";"):
                stmt += ";"
            statements.append(stmt)

    return statements


def apply_migration(client: httpx.Client, filepath: str):
    filename = os.path.basename(filepath)
    with open(filepath) as f:
        sql = f.read()

    # Split on semicolons, respecting $$ dollar-quoted blocks
    statements = split_sql(sql)
    for stmt in statements:
        run_sql(client, stmt)

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
