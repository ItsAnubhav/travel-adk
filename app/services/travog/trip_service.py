"""Travog Forge trip API service."""

import logging
from typing import Any, Dict, Optional

import httpx

from app.services.travog.auth_service import TravogAuthService
from app.services.travog.travog_constants import TravogConstants

logger = logging.getLogger(__name__)


class TravogTripService:
    """Trip endpoints for Travog Forge v1."""

    ALLOWED_STATUSES = {
        "PENDING",
        "APPROVED",
        "REJECTED",
        "FINALREJECTED",
        "FINALAPPROVED",
        "OPEN",
    }

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

    async def get_trips(
        self,
        access_token: str,
        b2b_client_id: str | int = 1,
        trip_name: str = "",
        status: str = "",
        from_date: str = "",
        to_date: str = "",
        page_number: str | int = "",
        page_size: str | int = "",
        refresh_token: str = "",
    ) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Fetch/filter trips from /forge/api/v1/trips."""
        if not access_token:
            logger.error("get_trips: missing access_token")
            return None, None

        normalized_status = status.strip().upper() if status else ""
        if normalized_status and normalized_status not in self.ALLOWED_STATUSES:
            logger.error("get_trips: invalid status=%s", status)
            return None, None

        params: Dict[str, Any] = {
            "B2BClientId": b2b_client_id,
            "TripName": trip_name,
            "Status": normalized_status,
            "FromDate": from_date,
            "ToDate": to_date,
            "PageNumber": page_number,
            "PageSize": page_size,
        }

        try:
            logger.info("[TRAVOG_TRIP_REQUEST] URL=%s params=%s", TravogConstants.TRIPS_URL, params)
            response, new_token = await self._auth_service.execute_with_retry(
                self._get_client(),
                "GET",
                TravogConstants.TRIPS_URL,
                access_token=access_token,
                refresh_token=refresh_token,
                params=params,
                headers={"accept": "application/json"},
            )
            logger.info(
                "[TRAVOG_TRIP_RESPONSE] URL=%s status=%s body=%s",
                TravogConstants.TRIPS_URL,
                response.status_code,
                response.text,
            )

            if not response.is_success:
                logger.error("Trips API error: status=%s body=%s", response.status_code, response.text)
                return None, new_token

            return response.json(), new_token
        except Exception as exc:
            logger.error("Trips fetch error: %s", exc)
            return None, None

    async def get_trip_approvers(
        self,
        access_token: str,
        trip_id: str | int,
        refresh_token: str = "",
    ) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Fetch trip approvers from /forge/api/v1/trips/{tripid}/approvals."""
        if not access_token:
            logger.error("get_trip_approvers: missing access_token")
            return None, None
        if trip_id is None or str(trip_id).strip() == "":
            logger.error("get_trip_approvers: missing trip_id")
            return None, None

        url = f"{TravogConstants.TRIP_APPROVALS_URL}/{trip_id}/approvals"

        try:
            logger.info("[TRAVOG_TRIP_REQUEST] URL=%s", url)
            response, new_token = await self._auth_service.execute_with_retry(
                self._get_client(),
                "GET",
                url,
                access_token=access_token,
                refresh_token=refresh_token,
                headers={"accept": "application/json"},
            )
            logger.info(
                "[TRAVOG_TRIP_RESPONSE] URL=%s status=%s body=%s",
                url,
                response.status_code,
                response.text,
            )

            if not response.is_success:
                logger.error(
                    "Trip approvers API error: status=%s body=%s",
                    response.status_code,
                    response.text,
                )
                return None, new_token

            return response.json(), new_token
        except Exception as exc:
            logger.error("Trip approvers fetch error: %s", exc)
            return None, None

    async def send_trip_for_approval(
        self,
        access_token: str,
        trip_id: str | int,
        approver_ids: list[int],
        workflow_type: str | None = None,
        refresh_token: str = "",
    ) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """PUT /forge/api/v1/trips/{tripid}/send-for-approval."""
        if not access_token:
            logger.error("send_trip_for_approval: missing access_token")
            return None, None
        if trip_id is None or str(trip_id).strip() == "":
            logger.error("send_trip_for_approval: missing trip_id")
            return None, None
        if not approver_ids:
            logger.error("send_trip_for_approval: missing approver_ids")
            return None, None

        url = f"{TravogConstants.TRIP_SEND_FOR_APPROVAL_URL}/{trip_id}/send-for-approval"
        payload: Dict[str, Any] = {
            "workflowType": workflow_type,
            "approvers": [
                {
                    "approverId": approver_id,
                    "name": None,
                }
                for approver_id in approver_ids
            ],
        }

        try:
            logger.info("[TRAVOG_TRIP_REQUEST] PUT %s payload=%s", url, payload)
            response, new_token = await self._auth_service.execute_with_retry(
                self._get_client(),
                "PUT",
                url,
                access_token=access_token,
                refresh_token=refresh_token,
                json=payload,
                headers={"accept": "application/json", "Content-Type": "application/json"},
            )
            logger.info(
                "[TRAVOG_TRIP_RESPONSE] PUT %s status=%s body=%s",
                url,
                response.status_code,
                response.text,
            )

            if not response.is_success:
                logger.error(
                    "Send trip for approval API error: status=%s body=%s",
                    response.status_code,
                    response.text,
                )
                return None, new_token

            try:
                return response.json(), new_token
            except Exception:
                return {"success": True, "raw": response.text}, new_token
        except Exception as exc:
            logger.error("Send trip for approval error: %s", exc)
            return None, None

    async def close(self):
        if self._owns_client and self._http_client:
            await self._http_client.aclose()
            self._http_client = None
