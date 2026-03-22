"""
InsForge REST API client wrapper.
Since no Python SDK exists, we use httpx to call the InsForge REST API directly.
"""

import httpx
from typing import Any


class InsForgeClient:
    """Thin client for InsForge's PostgREST-compatible database API."""

    def __init__(self, url: str = None, key: str = None):
        import config
        self.base_url = (url or config.INSFORGE_URL or "").rstrip("/")
        self.key = key or config.INSFORGE_API_KEY or ""
        self.db_url = f"{self.base_url}/api/database/records"
        self.headers = {
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    def _build_filter_params(self, filters: dict) -> dict:
        """Convert a dict of filters to PostgREST query params.

        Supports:
          - Simple equality: {"column": "value"}
          - Operators: {"column": "gt.10"}, {"column": "in.(a,b,c)"}
        """
        params = {}
        if not filters:
            return params
        for col, val in filters.items():
            params[col] = val if isinstance(val, str) and "." in val else f"eq.{val}"
        return params

    async def select(
        self,
        table: str,
        columns: str = "*",
        filters: dict = None,
        order: str = None,
        limit: int = None,
    ) -> list[dict]:
        """GET records from a table."""
        params = {"select": columns}
        params.update(self._build_filter_params(filters or {}))
        if order:
            params["order"] = order
        if limit:
            params["limit"] = str(limit)

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.db_url}/{table}",
                headers=self.headers,
                params=params,
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()

    async def insert(self, table: str, records: list[dict] | dict) -> list[dict]:
        """POST records into a table. Accepts a single dict or list of dicts."""
        body = records if isinstance(records, list) else [records]

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.db_url}/{table}",
                headers={**self.headers, "Prefer": "return=representation"},
                json=body,
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()

    async def update(self, table: str, updates: dict, filters: dict) -> list[dict]:
        """PATCH records matching filters."""
        params = self._build_filter_params(filters)

        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{self.db_url}/{table}",
                headers={**self.headers, "Prefer": "return=representation"},
                params=params,
                json=updates,
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()

    async def delete(self, table: str, filters: dict) -> list[dict]:
        """DELETE records matching filters."""
        params = self._build_filter_params(filters)

        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{self.db_url}/{table}",
                headers={**self.headers, "Prefer": "return=representation"},
                params=params,
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()

    async def rpc(self, function_name: str, params: dict = None) -> Any:
        """Call a stored PostgreSQL function via RPC."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/api/database/rpc/{function_name}",
                headers=self.headers,
                json=params or {},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()


# Singleton instance
db = InsForgeClient()
