"""Travog Forge expense API service."""

import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

from app.services.travog.auth_service import TravogAuthService
from app.services.travog.travog_constants import TravogConstants

logger = logging.getLogger(__name__)


class TravogExpenseService:
    """Expense endpoints for Travog Forge v1."""

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

    async def _execute_with_retry(
        self,
        method: str,
        url: str,
        access_token: str,
        refresh_token: str = "",
        **kwargs,
    ) -> tuple[httpx.Response, Optional[str]]:
        return await self._auth_service.execute_with_retry(
            self._get_client(),
            method,
            url,
            access_token,
            refresh_token,
            **kwargs,
        )

    async def get_expense_settings(
        self,
        access_token: str,
        client_id: str | int,
    ) -> Optional[Dict[str, Any]]:
        """Fetch all expense masters from /forge/api/v1/expensemasters/all."""
        if not access_token:
            logger.error("get_expense_settings: missing access_token")
            return None

        try:
            client_id_int = int(client_id) if str(client_id).strip() else 0
        except (TypeError, ValueError):
            client_id_int = 0

        headers = {
            "accept": "application/json",
            "Authorization": f"Bearer {access_token}",
        }
        params = {"clientId": client_id_int}

        try:
            logger.info(
                "[TRAVOG_EXPENSE_REQUEST] URL=%s params=%s",
                TravogConstants.EXPENSE_MASTERS_ALL_URL,
                params,
            )
            response = await self._get_client().get(
                TravogConstants.EXPENSE_MASTERS_ALL_URL,
                params=params,
                headers=headers,
            )
            logger.info(
                "[TRAVOG_EXPENSE_RESPONSE] URL=%s status=%s body=%s",
                TravogConstants.EXPENSE_MASTERS_ALL_URL,
                response.status_code,
                response.text,
            )

            if not response.is_success:
                logger.error("Expense masters API error: %s", response.text)
                return None

            return response.json()
        except Exception as exc:
            logger.error("Expense masters fetch error: %s", exc)
            return None

    @staticmethod
    def _coerce_bool_param(value: Any) -> Optional[str]:
        """Normalize tri-state bool params for query string serialization."""
        if value is None or value == "":
            return None
        if isinstance(value, bool):
            return "true" if value else "false"
        text = str(value).strip().lower()
        if text in ("true", "1", "yes", "y"):
            return "true"
        if text in ("false", "0", "no", "n"):
            return "false"
        return None

    async def get_expense_report(
        self,
        access_token: str,
        client_id: str = "",
        trip_name: str = "",
        from_date: str = "",
        to_date: str = "",
        mode_of_payment: str = "",
        billable: Any = None,
        reimbursable: Any = None,
        category: str = "",
        merchant_name: str = "",
        invoice_no: str = "",
        page_number: int = 1,
        page_size: int = 10,
        refresh_token: str = "",
    ) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Fetch expenses from /forge/api/v1/expenses using the supplied JWT."""
        if not access_token:
            logger.error("get_expense_report: missing access_token")
            return None, None

        logger.info(
            "Fetching expenses client_id=%s merchant=%s category=%s page=%s/%s",
            client_id,
            merchant_name,
            category,
            page_number,
            page_size,
        )

        params: Dict[str, Any] = {
            "PageNumber": page_number,
            "PageSize": page_size,
        }
        if client_id:
            params["ClientId"] = client_id
        if trip_name:
            params["TripName"] = trip_name
        if from_date:
            params["FromDate"] = from_date
        if to_date:
            params["ToDate"] = to_date
        if mode_of_payment:
            params["ModeOfPayment"] = mode_of_payment
        billable_param = self._coerce_bool_param(billable)
        if billable_param is not None:
            params["Billable"] = billable_param
        reimbursable_param = self._coerce_bool_param(reimbursable)
        if reimbursable_param is not None:
            params["Reimbursable"] = reimbursable_param
        if category:
            params["Category"] = category
        if merchant_name:
            params["MerchantName"] = merchant_name
        if invoice_no:
            params["InvoiceNo"] = invoice_no

        try:
            logger.info("[TRAVOG_EXPENSE_REQUEST] URL=%s params=%s", TravogConstants.EXPENSES_URL, params)
            response, new_token = await self._execute_with_retry(
                "GET",
                TravogConstants.EXPENSES_URL,
                access_token=access_token,
                refresh_token=refresh_token,
                params=params,
                headers={"accept": "application/json"},
            )

            logger.info(
                "[TRAVOG_EXPENSE_RESPONSE] URL=%s status=%s body=%s",
                TravogConstants.EXPENSES_URL,
                response.status_code,
                response.text,
            )

            if not response.is_success:
                logger.error("Expenses API error: %s", response.text)
                return None, new_token

            return response.json(), new_token
        except Exception as exc:
            logger.error("Expenses fetch error: %s", exc)
            return None, None

    @staticmethod
    def _interpret_validate_invoice_payload(raw: Any) -> Optional[bool]:
        """Extract duplicate invoice status from Travog's varied response shapes."""
        if isinstance(raw, bool):
            return raw

        if isinstance(raw, dict):
            for key in (
                "isDuplicate",
                "duplicate",
                "exists",
                "isExist",
                "isExists",
                "alreadyExists",
                "isAlreadyExists",
            ):
                if key in raw and isinstance(raw[key], bool):
                    return raw[key]

            inner = raw.get("data")
            if inner is None:
                inner = raw.get("Data")
            if inner is not None and inner is not raw:
                return TravogExpenseService._interpret_validate_invoice_payload(inner)

            for key in ("message", "Message"):
                value = raw.get(key)
                if isinstance(value, str):
                    lower = value.lower()
                    if "duplicate" in lower or "already exist" in lower:
                        return True
                    if "not exist" in lower or "available" in lower or "unique" in lower:
                        return False

        return None

    async def validate_invoice(
        self,
        access_token: str,
        client_id: str | int,
        invoice_no: str,
        refresh_token: str = "",
    ) -> tuple[Optional[bool], Optional[str]]:
        """POST /forge/api/v1/expenses/validate-invoice."""
        if not access_token:
            logger.error("validate_invoice: missing access_token")
            return None, None

        try:
            client_id_int = int(client_id) if str(client_id).strip() else 0
        except (TypeError, ValueError):
            client_id_int = 0

        payload: Dict[str, Any] = {
            "clientId": client_id_int,
            "invoiceNo": str(invoice_no or ""),
        }

        try:
            logger.info("[TRAVOG_EXPENSE_REQUEST] POST %s payload=%s", TravogConstants.VALIDATE_INVOICE_URL, payload)
            response, new_token = await self._execute_with_retry(
                "POST",
                TravogConstants.VALIDATE_INVOICE_URL,
                access_token=access_token,
                refresh_token=refresh_token,
                json=payload,
                headers={"accept": "application/json", "Content-Type": "application/json"},
            )

            logger.info(
                "[TRAVOG_EXPENSE_RESPONSE] POST %s status=%s body=%s",
                TravogConstants.VALIDATE_INVOICE_URL,
                response.status_code,
                response.text,
            )
            if not response.is_success:
                logger.error(
                    "validate_invoice API error: status=%s body=%s",
                    response.status_code,
                    response.text,
                )
                return None, new_token

            try:
                body = response.json()
            except Exception:
                logger.warning("validate_invoice: non-JSON response: %s", response.text)
                return None, new_token

            return self._interpret_validate_invoice_payload(body), new_token
        except Exception as exc:
            logger.error("validate_invoice exception: %s", exc)
            return None, None

    @staticmethod
    def _format_ddmmyyyy_date(value: str) -> str:
        """Normalize YYYY-MM-DD to DD-MM-YYYY; pass through if already DD-MM-YYYY."""
        if not value:
            return ""
        from datetime import datetime

        try:
            return datetime.strptime(value, "%Y-%m-%d").strftime("%d-%m-%Y")
        except ValueError:
            return value

    async def create_expense(
        self,
        access_token: str,
        category: str = "",
        merchant: str = "",
        date_from: str = "",
        date_to: str = "",
        amount: str = "",
        currency: str = "",
        tax_amount: str = "",
        invoice_number: str = "",
        gst_number: str = "",
        mode_of_payment: str = "",
        payment_mode: str = "",
        comment: str = "",
        expense_sheet_id: str = "",
        is_personal: str = "",
        is_billable: str = "",
        image_path: str = "",
    ) -> Optional[Dict[str, Any]]:
        """Create a raw expense via POST /forge/api/v1/expenses/create_expense."""
        if not access_token:
            logger.error("create_expense: missing access_token")
            return None

        headers = {
            "accept": "application/json",
            "Authorization": f"Bearer {access_token}",
        }

        form_fields: Dict[str, tuple] = {
            "category": (None, str(category)),
            "Merchant": (None, str(merchant)),
            "DateFrom": (None, self._format_ddmmyyyy_date(date_from)),
            "DateTo": (None, self._format_ddmmyyyy_date(date_to)),
            "Amount": (None, str(amount)),
            "currency": (None, str(currency)),
            "TaxAmount": (None, str(tax_amount)),
            "InvoiceNumber": (None, str(invoice_number)),
            "GstNumber": (None, str(gst_number)),
            "payment_mode": (None, str(payment_mode or mode_of_payment or "PC")),
            "ExpenseSheetId": (None, str(expense_sheet_id)),
            "IsPersonal": (None, str(is_personal).lower() if is_personal != "" else ""),
            "IsBillable": (None, str(is_billable).lower() if is_billable != "" else ""),
        }

        opened_files = []
        try:
            if image_path and os.path.exists(image_path):
                img_path = Path(image_path)
                file_handle = open(img_path, "rb")
                opened_files.append(file_handle)
                form_fields["ImageFile"] = (img_path.name, file_handle, "image/jpeg")

            log_form = {
                key: value[1] if isinstance(value, tuple) and value[0] is None else f"<file:{value[0]}>"
                for key, value in form_fields.items()
            }
            logger.info("[TRAVOG_EXPENSE_REQUEST] POST %s payload=%s", TravogConstants.CREATE_EXPENSE_RAW_URL, log_form)

            response = await self._get_client().post(
                TravogConstants.CREATE_EXPENSE_RAW_URL,
                headers=headers,
                files=form_fields,
                timeout=60.0,
            )
            logger.info(
                "[TRAVOG_EXPENSE_RESPONSE] POST %s status=%s body=%s",
                TravogConstants.CREATE_EXPENSE_RAW_URL,
                response.status_code,
                response.text,
            )

            if not response.is_success:
                logger.error(
                    "Create expense API error: status=%s body=%s",
                    response.status_code,
                    response.text,
                )
                return None

            try:
                return response.json()
            except Exception:
                return {"success": True, "raw": response.text}
        except Exception as exc:
            logger.error("Create expense exception: %s", exc)
            return None
        finally:
            for file_handle in opened_files:
                file_handle.close()

    async def update_expense(
        self,
        access_token: str,
        expense_id: str | int,
        client_id: str = "",
        user_id: str = "",
        category: str = "",
        merchant: str = "",
        date_from: str = "",
        date_to: str = "",
        amount: str = "",
        currency: str = "",
        tax_amount: str = "",
        invoice_number: str = "",
        gst_number: str = "",
        payment_mode: str = "",
        comment: str = "",
        expense_sheet_id: str = "",
        is_personal: str = "",
        is_billable: str = "",
        image_path: str = "",
        refresh_token: str = "",
    ) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Update an existing expense via PUT /forge/api/v1/expenses/update_expense/{id}."""
        if not access_token:
            logger.error("update_expense: missing access_token")
            return None, None
        if expense_id is None or str(expense_id).strip() == "":
            logger.error("update_expense: missing expense_id")
            return None, None

        url = f"{TravogConstants.UPDATE_EXPENSE_RAW_URL}/{expense_id}"

        def safe_str(value: Any) -> str:
            return str(value).strip() if value is not None else ""

        candidate_fields: list[tuple[str, str]] = [
            ("ClientId", safe_str(client_id)),
            ("UserId", safe_str(user_id)),
            ("category", safe_str(category)),
            ("Merchant", safe_str(merchant)),
            ("DateFrom", safe_str(date_from)),
            ("DateTo", safe_str(date_to)),
            ("Amount", safe_str(amount)),
            ("currency", safe_str(currency)),
            ("TaxAmount", safe_str(tax_amount)),
            ("InvoiceNumber", safe_str(invoice_number)),
            ("GstNumber", safe_str(gst_number)),
            ("payment_mode", safe_str(payment_mode)),
            ("Comment", safe_str(comment)),
            ("ExpenseSheetId", safe_str(expense_sheet_id)),
            ("IsPersonal", safe_str(is_personal)),
            ("IsBillable", safe_str(is_billable)),
        ]
        form_fields: Dict[str, tuple] = {
            name: (None, value) for name, value in candidate_fields if value
        }

        opened_files = []
        try:
            if image_path and os.path.exists(image_path):
                img_path = Path(image_path)
                file_handle = open(img_path, "rb")
                opened_files.append(file_handle)
                form_fields["ImageFile"] = (img_path.name, file_handle, "image/jpeg")

            log_form = {
                key: value[1] if isinstance(value, tuple) and value[0] is None else f"<file:{value[0]}>"
                for key, value in form_fields.items()
            }
            logger.info("[TRAVOG_EXPENSE_REQUEST] PUT %s payload=%s", url, log_form)

            response, new_token = await self._execute_with_retry(
                "PUT",
                url,
                access_token=access_token,
                refresh_token=refresh_token,
                files=form_fields,
                headers={"accept": "application/json"},
                timeout=60.0,
            )

            logger.info(
                "[TRAVOG_EXPENSE_RESPONSE] PUT %s status=%s body=%s",
                url,
                response.status_code,
                response.text,
            )

            if not response.is_success:
                logger.error(
                    "Update expense API error: status=%s body=%s",
                    response.status_code,
                    response.text,
                )
                return None, new_token

            try:
                return response.json(), new_token
            except Exception:
                return {"success": True, "raw": response.text}, new_token
        except Exception as exc:
            logger.error("Update expense exception: %s", exc)
            return None, None
        finally:
            for file_handle in opened_files:
                file_handle.close()

    async def close(self):
        if self._owns_client and self._http_client:
            await self._http_client.aclose()
            self._http_client = None
