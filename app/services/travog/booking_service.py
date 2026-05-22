"""Travog Forge booking API service."""

import logging
from typing import Any, Dict, Optional

import httpx

from app.services.travog.auth_service import TravogAuthService
from app.services.travog.travog_constants import TravogConstants

logger = logging.getLogger(__name__)


class TravogBookingService:
    """Booking endpoints for Travog Forge v1."""

    def __init__(
        self,
        http_client: Optional[httpx.AsyncClient] = None,
        auth_service: Optional[TravogAuthService] = None,
    ):
        self._http_client = http_client
        self._auth_service = auth_service or TravogAuthService()
        self._owns_client = http_client is None

    def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def get_booking(
        self,
        access_token: str,
        booking_ref: str | int,
        refresh_token: str = "",
    ) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Fetch booking details from /forge/api/v1/bookings/{bookingRef}."""
        if not access_token:
            logger.error("get_booking: missing access_token")
            return None, None
        if booking_ref is None or str(booking_ref).strip() == "":
            logger.error("get_booking: missing booking_ref")
            return None, None

        url = f"{TravogConstants.FORGE_BOOKINGS_URL}/{booking_ref}"

        try:
            logger.info("[TRAVOG_BOOKING_REQUEST] URL=%s", url)
            response, new_token = await self._auth_service.execute_with_retry(
                self._get_client(),
                "GET",
                url,
                access_token=access_token,
                refresh_token=refresh_token,
                headers={"accept": "application/json"},
            )
            logger.info(
                "[TRAVOG_BOOKING_RESPONSE] URL=%s status=%s body=%s",
                url,
                response.status_code,
                response.text,
            )

            if not response.is_success:
                logger.error(
                    "Booking API error: status=%s body=%s",
                    response.status_code,
                    response.text,
                )
                return None, new_token

            return response.json(), new_token
        except Exception as exc:
            logger.error("Booking fetch error: %s", exc)
            return None, None

    async def get_fare_rules(
        self,
        access_token: str,
        flight_id: str | int,
        refresh_token: str = "",
    ) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Fetch fare rules from /forge/api/v1/bookings/fare-rules/{flightId}."""
        if not access_token:
            logger.error("get_fare_rules: missing access_token")
            return None, None
        if flight_id is None or str(flight_id).strip() == "":
            logger.error("get_fare_rules: missing flight_id")
            return None, None

        url = f"{TravogConstants.FORGE_BOOKING_FARE_RULES_URL}/{flight_id}"

        try:
            logger.info("[TRAVOG_BOOKING_REQUEST] URL=%s", url)
            response, new_token = await self._auth_service.execute_with_retry(
                self._get_client(),
                "GET",
                url,
                access_token=access_token,
                refresh_token=refresh_token,
                headers={"accept": "application/json"},
            )
            logger.info(
                "[TRAVOG_BOOKING_RESPONSE] URL=%s status=%s body=%s",
                url,
                response.status_code,
                response.text,
            )

            if not response.is_success:
                logger.error(
                    "Fare rules API error: status=%s body=%s",
                    response.status_code,
                    response.text,
                )
                return None, new_token

            return response.json(), new_token
        except Exception as exc:
            logger.error("Fare rules fetch error: %s", exc)
            return None, None

    async def close(self):
        if self._owns_client and self._http_client:
            await self._http_client.aclose()
            self._http_client = None
