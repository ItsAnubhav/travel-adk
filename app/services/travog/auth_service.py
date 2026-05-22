"""Travog auth helpers for Forge API calls."""

import logging
from typing import Optional

import httpx

from app.services.travog.ql_auth_service import QLAuthService

logger = logging.getLogger(__name__)


class TravogAuthService(QLAuthService):
    """Auth service with bearer-token retry helpers for Travog Forge APIs."""

    async def execute_with_retry(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        access_token: str,
        refresh_token: str = "",
        **kwargs,
    ) -> tuple[httpx.Response, Optional[str]]:
        """Execute a request and retry once with a refreshed token on 401."""
        headers = kwargs.get("headers", {}).copy()
        headers["Authorization"] = f"Bearer {access_token}"
        kwargs["headers"] = headers

        new_token = None
        try:
            response = await client.request(method, url, **kwargs)

            if response.status_code == 401 and refresh_token:
                logger.warning("[TRAVOG_AUTH] Token expired for URL=%s. Attempting refresh.", url)
                refresh_result = await self.refresh_forge_token(access_token, refresh_token)

                if refresh_result and "accessToken" in refresh_result:
                    new_token = refresh_result["accessToken"]
                    logger.info("[TRAVOG_AUTH] Token refreshed successfully. Retrying request.")
                    headers["Authorization"] = f"Bearer {new_token}"
                    kwargs["headers"] = headers
                    response = await client.request(method, url, **kwargs)

            return response, new_token

        except Exception as exc:
            logger.error("[TRAVOG_AUTH] Request failed for URL=%s: %s", url, exc)
            raise
