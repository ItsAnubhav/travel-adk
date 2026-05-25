from __future__ import annotations

import base64
import json
import logging

logger = logging.getLogger(__name__)


# Maps JWT claim name -> session-state key. user_id is handled separately
# because it overrides the request's user_id (used as the session owner).
_CLAIM_TO_STATE_KEY: dict[str, str] = {
    "userName": "name",
    "companyId": "company_id",
    "clientId": "client_id",
    "branchId": "branch_id",
    "b2bBranchId": "b2b_branch_id",
    "companyCurrency": "company_currency",
    "accountNo": "account_no",
    "decimalPreference": "decimal_preference",
    "loginSessionId": "login_session_id",
    "duplicateLogin": "duplicate_login",
    "source": "source",
}

IDENTITY_FIELDS: tuple[str, ...] = tuple(_CLAIM_TO_STATE_KEY.values())


def _decode_segment(segment: str) -> dict:
    padding = "=" * (-len(segment) % 4)
    decoded = base64.urlsafe_b64decode(segment + padding)
    return json.loads(decoded)


def decode_jwt_claims(token: str | None) -> dict:
    """Decode the payload of a JWT without verifying its signature.

    Intended for extracting identity claims from a token we've already trusted
    via our auth flow. Returns an empty dict on any decoding failure.
    """
    if not token or not isinstance(token, str):
        return {}
    parts = token.split(".")
    if len(parts) < 2:
        return {}
    try:
        return _decode_segment(parts[1])
    except Exception:
        logger.warning("Failed to decode JWT claims", exc_info=True)
        return {}


def extract_identity(token: str | None) -> dict[str, str]:
    """Return canonical identity fields from a Xchange access token."""
    claims = decode_jwt_claims(token)
    identity: dict[str, str] = {"user_id": str(claims.get("userId", ""))}
    for claim_key, state_key in _CLAIM_TO_STATE_KEY.items():
        identity[state_key] = str(claims.get(claim_key, ""))
    return identity
