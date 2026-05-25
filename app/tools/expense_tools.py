from typing import Any

from google.adk.tools import ToolContext

from app.core.dependencies import get_travog_expense_service, get_travog_trip_service
from app.tools.tool_contracts import compact_error, compact_success, ui_tool_payload
from app.ui_artifacts.store import ui_artifact_store


def _auth_from_context(
    access_token: str = "",
    refresh_token: str = "",
    tool_context: ToolContext | None = None,
) -> tuple[str, str]:
    if tool_context is None:
        return access_token, refresh_token

    state_access_token = tool_context.state.get("travog_access_token")
    state_refresh_token = tool_context.state.get("travog_refresh_token")

    return (
        access_token or (state_access_token if isinstance(state_access_token, str) else ""),
        refresh_token or (state_refresh_token if isinstance(state_refresh_token, str) else ""),
    )


def _pick(d: dict, *keys: str) -> Any:
    for key in keys:
        value = d.get(key)
        if value not in (None, "", []):
            return value
    return None


def _format_amount(value: Any) -> str:
    if isinstance(value, bool):
        return ""
    if isinstance(value, (int, float)):
        return str(int(value)) if float(value).is_integer() else f"{value:g}"
    return str(value or "")


def _format_date(value: Any) -> str:
    text = str(value or "")
    return text.split(" ", 1)[0] if " " in text else text


def _extract_expense_candidates(payload: Any, limit: int = 20) -> list[dict[str, str]]:
    """Flatten a get_expense_report payload into a compact LLM-visible candidate list."""
    if not isinstance(payload, dict):
        return []

    items: list[dict] = []
    # Travog current shape: {"data": {"data": [...]}}
    outer_data = payload.get("data")
    if isinstance(outer_data, dict) and isinstance(outer_data.get("data"), list):
        items.extend(outer_data["data"])
    elif isinstance(outer_data, list):
        items.extend(outer_data)
    elif isinstance(payload.get("items"), list):
        items.extend(payload["items"])
    else:
        data_root = payload.get("report") if isinstance(payload.get("report"), dict) else payload
        buckets_root = data_root.get("Data") if isinstance(data_root.get("Data"), dict) else data_root
        for bucket_key in ("TripExpense", "FiledTrip", "PersonalTrip", "DeletedTrip"):
            bucket = buckets_root.get(bucket_key) if isinstance(buckets_root, dict) else None
            if isinstance(bucket, list):
                items.extend(bucket)

    candidates: list[dict[str, str]] = []
    for entry in items[:limit]:
        if not isinstance(entry, dict):
            continue
        expense_id = _pick(entry, "Expense_Id", "expenseId", "id")
        if expense_id is None:
            continue
        candidates.append({
            "expense_id": str(expense_id),
            "merchant": str(_pick(entry, "Merchant", "merchant", "merchantName") or ""),
            "date": _format_date(_pick(entry, "ExpenseDate", "expenseDate", "sort_start_date", "fromDate", "FromDate")),
            "category": str(_pick(entry, "CategoryName", "categoryName", "category") or ""),
            "amount": _format_amount(_pick(entry, "Amount", "amount")),
            "currency": str(_pick(entry, "Currency", "currency", "currencyCode") or ""),
        })
    return candidates


def _parse_approver_ids(value: list[int] | list[str] | str | int) -> list[int]:
    if isinstance(value, int):
        return [value]
    if isinstance(value, str):
        raw_items = [item.strip() for item in value.split(",")]
    else:
        raw_items = [str(item).strip() for item in value]

    approver_ids: list[int] = []
    for item in raw_items:
        if item:
            approver_ids.append(int(item))
    return approver_ids


async def list_trip(
    b2b_client_id: str = "1",
    trip_name: str = "",
    status: str = "",
    from_date: str = "",
    to_date: str = "",
    page_number: str = "",
    page_size: str = "",
    access_token: str = "",
    refresh_token: str = "",
    ui_display: str = "chat",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """List/filter trips. Set ui_display to chat or split_view to choose where the UI artifact opens."""
    access_token, refresh_token = _auth_from_context(access_token, refresh_token, tool_context)
    if not access_token:
        return compact_error("Travog access token is missing. Open the app with ?access_token=YOUR_TOKEN.")

    normalized_status = status.strip().upper() if status else ""
    if normalized_status and normalized_status not in get_travog_trip_service().ALLOWED_STATUSES:
        return compact_error(
            "Invalid trip status",
            {
                "status": status,
                "allowed": sorted(get_travog_trip_service().ALLOWED_STATUSES),
            },
        )

    payload, new_token = await get_travog_trip_service().get_trips(
        access_token=access_token,
        b2b_client_id=b2b_client_id,
        trip_name=trip_name,
        status=normalized_status,
        from_date=from_date,
        to_date=to_date,
        page_number=page_number,
        page_size=page_size,
        refresh_token=refresh_token,
    )
    if payload is None:
        return compact_error("Trip lookup failed")

    artifact_id = ui_artifact_store.put(
        "trip_list",
        payload,
        summary={
            "b2b_client_id": b2b_client_id,
            "trip_name": trip_name,
            "status": normalized_status,
            "page_number": page_number,
            "page_size": page_size,
        },
    )
    return compact_success(
        "Trips ready",
        ui_tool_payload(
            "trip_list",
            artifact_id,
            ui_display=ui_display,
            new_access_token=new_token,
        ),
    )


list_trips = list_trip


async def get_trip_approvers(
    trip_id: str,
    access_token: str = "",
    refresh_token: str = "",
    ui_display: str = "chat",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Get approvers for a trip by trip_id. Set ui_display to chat or split_view."""
    access_token, refresh_token = _auth_from_context(access_token, refresh_token, tool_context)
    if not access_token:
        return compact_error("Travog access token is missing. Open the app with ?access_token=YOUR_TOKEN.")
    if not str(trip_id or "").strip():
        return compact_error("trip_id is required")

    payload, new_token = await get_travog_trip_service().get_trip_approvers(
        access_token=access_token,
        trip_id=trip_id,
        refresh_token=refresh_token,
    )
    if payload is None:
        return compact_error("Trip approvers lookup failed")

    artifact_id = ui_artifact_store.put(
        "trip_approvers",
        payload,
        summary={"trip_id": trip_id},
    )
    return compact_success(
        "Trip approvers ready",
        ui_tool_payload(
            "trip_approvers",
            artifact_id,
            ui_display=ui_display,
            new_access_token=new_token,
        ),
    )


async def send_trip_for_approval(
    trip_id: str,
    approver_ids: list[int] | list[str] | str | int,
    workflow_type: str = "",
    access_token: str = "",
    refresh_token: str = "",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Send a trip for approval with one or more approver IDs."""
    access_token, refresh_token = _auth_from_context(access_token, refresh_token, tool_context)
    if not access_token:
        return compact_error("Travog access token is missing. Open the app with ?access_token=YOUR_TOKEN.")
    if not str(trip_id or "").strip():
        return compact_error("trip_id is required")

    try:
        parsed_approver_ids = _parse_approver_ids(approver_ids)
    except (TypeError, ValueError):
        return compact_error("approver_ids must be an integer, comma-separated string, or list of integers")

    if not parsed_approver_ids:
        return compact_error("At least one approver_id is required")

    payload, new_token = await get_travog_trip_service().send_trip_for_approval(
        access_token=access_token,
        trip_id=trip_id,
        approver_ids=parsed_approver_ids,
        workflow_type=workflow_type or None,
        refresh_token=refresh_token,
    )
    if payload is None:
        return compact_error("Send trip for approval failed")

    return compact_success(
        "Trip sent for approval",
        {
            "result": payload,
            "trip_id": trip_id,
            "approver_ids": parsed_approver_ids,
            "new_access_token": new_token,
        },
    )


async def list_expenses(
    access_token: str = "",
    client_id: str = "",
    trip_name: str = "",
    from_date: str = "",
    to_date: str = "",
    category: str = "",
    merchant_name: str = "",
    page_number: int = 1,
    page_size: int = 10,
    refresh_token: str = "",
    ui_display: str = "chat",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """List expense reports with filters. Set ui_display to chat or split_view."""
    access_token, refresh_token = _auth_from_context(access_token, refresh_token, tool_context)
    if not access_token:
        return compact_error("Travog access token is missing. Open the app with ?access_token=YOUR_TOKEN.")

    payload, new_token = await get_travog_expense_service().get_expense_report(
        access_token=access_token,
        client_id=client_id,
        trip_name=trip_name,
        from_date=from_date,
        to_date=to_date,
        category=category,
        merchant_name=merchant_name,
        page_number=page_number,
        page_size=page_size,
        refresh_token=refresh_token,
    )
    if payload is None:
        return compact_error("Expense report lookup failed")
    artifact_id = ui_artifact_store.put(
        "expense_report",
        payload,
        summary={"page_number": page_number, "page_size": page_size, "category": category},
    )
    candidates = _extract_expense_candidates(payload)
    return compact_success(
        "Expense report ready",
        ui_tool_payload(
            "expense_report",
            artifact_id,
            ui_display=ui_display,
            new_access_token=new_token,
            candidates=candidates,
            candidate_count=len(candidates),
        ),
    )


async def get_expense_settings(
    client_id: str,
    access_token: str = "",
    ui_display: str = "chat",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Fetch expense masters/settings for a client. Set ui_display to chat or split_view."""
    access_token, _ = _auth_from_context(access_token, tool_context=tool_context)
    if not access_token:
        return compact_error("Travog access token is missing. Open the app with ?access_token=YOUR_TOKEN.")

    payload = await get_travog_expense_service().get_expense_settings(
        access_token=access_token,
        client_id=client_id,
    )
    if payload is None:
        return compact_error("Expense settings lookup failed")
    artifact_id = ui_artifact_store.put(
        "expense_settings",
        payload,
        summary={"client_id": client_id},
    )
    return compact_success(
        "Expense settings ready",
        ui_tool_payload("expense_settings", artifact_id, ui_display=ui_display),
    )


async def create_expense(
    category: str,
    merchant: str,
    date_from: str,
    amount: str,
    currency: str,
    invoice_number: str = "",
    payment_mode: str = "PC",
    comment: str = "",
    access_token: str = "",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Create a new expense entry."""
    access_token, _ = _auth_from_context(access_token, tool_context=tool_context)
    if not access_token:
        return compact_error("Travog access token is missing. Open the app with ?access_token=YOUR_TOKEN.")

    payload = await get_travog_expense_service().create_expense(
        access_token=access_token,
        category=category,
        merchant=merchant,
        date_from=date_from,
        date_to=date_from,
        amount=amount,
        currency=currency,
        invoice_number=invoice_number,
        payment_mode=payment_mode,
        comment=comment,
    )
    if payload is None:
        return compact_error("Expense creation failed")
    return compact_success("Expense created", {"result": payload})


async def update_expense(
    expense_id: str,
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
    access_token: str = "",
    refresh_token: str = "",
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """Update an existing expense using the current Travog update_expense API."""
    access_token, refresh_token = _auth_from_context(access_token, refresh_token, tool_context)
    if not access_token:
        return compact_error("Travog access token is missing. Open the app with ?access_token=YOUR_TOKEN.")
    if not str(expense_id or "").strip():
        return compact_error("expense_id is required")

    payload, new_token = await get_travog_expense_service().update_expense(
        access_token=access_token,
        expense_id=expense_id,
        client_id=client_id,
        user_id=user_id,
        category=category,
        merchant=merchant,
        date_from=date_from,
        date_to=date_to,
        amount=amount,
        currency=currency,
        tax_amount=tax_amount,
        invoice_number=invoice_number,
        gst_number=gst_number,
        payment_mode=payment_mode,
        comment=comment,
        expense_sheet_id=expense_sheet_id,
        is_personal=is_personal,
        is_billable=is_billable,
        image_path=image_path,
        refresh_token=refresh_token,
    )
    if payload is None:
        return compact_error("Expense update failed")

    return compact_success(
        "Expense updated",
        {
            "result": payload,
            "expense_id": expense_id,
            "new_access_token": new_token,
        },
    )
