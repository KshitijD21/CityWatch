from __future__ import annotations

import httpx
from fastapi import HTTPException
from config import INSFORGE_URL, INSFORGE_API_KEY


class InsForgeClient:
    """Async HTTP client for InsForge REST API (Auth + PostgREST)."""

    def __init__(self) -> None:
        self.base_url = INSFORGE_URL or ""
        self.api_key = INSFORGE_API_KEY or ""
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "apikey": self.api_key,
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )
        return self._client

    def _auth_headers(self, token: str | None = None) -> dict:
        headers: dict[str, str] = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    async def get_auth_user(self, access_token: str) -> dict:
        client = await self._get_client()
        resp = await client.get(
            "/api/auth/sessions/current",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=401, detail="Invalid token")
        return resp.json()

    # ------------------------------------------------------------------
    # Database (PostgREST)
    # ------------------------------------------------------------------

    def _build_filters(self, filters: dict | None) -> dict[str, str]:
        """Convert {column: 'op.value'} to PostgREST query params."""
        if not filters:
            return {}
        return {k: v for k, v in filters.items()}

    async def query(
        self,
        table: str,
        *,
        select: str = "*",
        filters: dict | None = None,
        raw_params: list[tuple[str, str]] | None = None,
        order: str | None = None,
        limit: int | None = None,
        token: str | None = None,
        single: bool = False,
    ) -> list | dict:
        client = await self._get_client()
        if raw_params is not None:
            # Use raw list-of-tuples for params that need duplicate keys
            params_list: list[tuple[str, str]] = [("select", select)]
            params_list.extend(raw_params)
            if order:
                params_list.append(("order", order))
            if limit is not None:
                params_list.append(("limit", str(limit)))
            query_params: dict[str, str] | list[tuple[str, str]] = params_list
        else:
            params_dict: dict[str, str] = {"select": select}
            params_dict.update(self._build_filters(filters))
            if order:
                params_dict["order"] = order
            if limit is not None:
                params_dict["limit"] = str(limit)
            query_params = params_dict
        headers = self._auth_headers(token)
        if single:
            headers["Accept"] = "application/vnd.pgrst.object+json"
        resp = await client.get(
            f"/api/database/records/{table}",
            params=query_params,
            headers=headers,
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()

    async def insert(
        self,
        table: str,
        data: dict | list,
        *,
        token: str | None = None,
    ) -> dict | list:
        client = await self._get_client()
        headers = {
            **self._auth_headers(token),
            "Prefer": "return=representation",
        }
        resp = await client.post(
            f"/api/database/records/{table}",
            json=data if isinstance(data, list) else [data],
            headers=headers,
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        result = resp.json()
        if isinstance(data, dict) and isinstance(result, list) and len(result) == 1:
            return result[0]
        return result

    async def update(
        self,
        table: str,
        data: dict,
        *,
        filters: dict,
        token: str | None = None,
    ) -> dict | list:
        client = await self._get_client()
        params = self._build_filters(filters)
        headers = {
            **self._auth_headers(token),
            "Prefer": "return=representation",
        }
        resp = await client.patch(
            f"/api/database/records/{table}",
            params=params,
            json=data,
            headers=headers,
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        result = resp.json()
        if isinstance(result, list) and len(result) == 1:
            return result[0]
        return result

    async def upsert(
        self,
        table: str,
        data: dict,
        *,
        on_conflict: str | None = None,
        token: str | None = None,
    ) -> dict:
        client = await self._get_client()
        headers = {
            **self._auth_headers(token),
            "Prefer": "return=representation,resolution=merge-duplicates",
        }
        params = {}
        if on_conflict:
            params["on_conflict"] = on_conflict
        resp = await client.post(
            f"/api/database/records/{table}",
            json=[data],
            headers=headers,
            params=params,
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        result = resp.json()
        return result[0] if isinstance(result, list) and len(result) == 1 else result

    async def delete(
        self,
        table: str,
        *,
        filters: dict,
        token: str | None = None,
    ) -> None:
        client = await self._get_client()
        params = self._build_filters(filters)
        resp = await client.delete(
            f"/api/database/records/{table}",
            params=params,
            headers=self._auth_headers(token),
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

    async def rpc(
        self,
        function_name: str,
        params: dict,
        *,
        token: str | None = None,
    ) -> dict:
        client = await self._get_client()
        resp = await client.post(
            f"/api/database/rpc/{function_name}",
            json=params,
            headers=self._auth_headers(token),
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None


# Singleton
insforge = InsForgeClient()
