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

    async def sign_up(self, email: str, password: str, name: str | None = None) -> dict:
        client = await self._get_client()
        body: dict = {"email": email, "password": password}
        if name:
            body["name"] = name
        resp = await client.post(
            "/api/auth/users",
            json=body,
        )
        if resp.status_code >= 400:
            try:
                err = resp.json()
                detail = err.get("message", resp.text)
            except Exception:
                detail = resp.text
            code = 409 if resp.status_code == 409 else resp.status_code
            raise HTTPException(status_code=code, detail=detail)
        return resp.json()

    async def sign_in_password(self, email: str, password: str) -> dict:
        client = await self._get_client()
        resp = await client.post(
            "/api/auth/sessions",
            json={"email": email, "password": password},
        )
        if resp.status_code >= 400:
            try:
                err = resp.json()
                detail = err.get("message", "Invalid credentials")
            except Exception:
                detail = "Invalid credentials"
            raise HTTPException(status_code=401, detail=detail)
        return resp.json()

    async def sign_in_google(self, google_token: str) -> dict:
        """Exchange Google OAuth code for InsForge tokens via PKCE flow."""
        client = await self._get_client()
        resp = await client.post(
            "/api/auth/oauth/exchange",
            json={"code": google_token, "code_verifier": ""},
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=401, detail="Google auth failed")
        return resp.json()

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
        token: str | None = None,
        single: bool = False,
    ) -> list | dict:
        client = await self._get_client()
        params: dict[str, str] = {"select": select}
        params.update(self._build_filters(filters))
        headers = self._auth_headers(token)
        if single:
            headers["Accept"] = "application/vnd.pgrst.object+json"
        resp = await client.get(
            f"/api/database/records/{table}",
            params=params,
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
        token: str | None = None,
    ) -> dict:
        client = await self._get_client()
        headers = {
            **self._auth_headers(token),
            "Prefer": "return=representation,resolution=merge-duplicates",
        }
        resp = await client.post(
            f"/api/database/records/{table}",
            json=[data],
            headers=headers,
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
