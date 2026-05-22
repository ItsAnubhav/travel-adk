"""Backward-compatible Travog Forge service facade.

New code should depend on domain-specific services such as
``TravogExpenseService`` and ``TravogAuthService``. This class remains so older
imports continue to work while the integration grows.
"""

import httpx

from app.services.travog.auth_service import TravogAuthService
from app.services.travog.expense_service import TravogExpenseService
from app.services.travog.ql_auth_service import QLAuthService


class TravogAPIServiceNew(TravogExpenseService):
    """Compatibility alias for the expense-focused Forge service."""

    def __init__(
        self,
        http_client: httpx.AsyncClient | None = None,
        ql_auth_service: QLAuthService | None = None,
        auth_service: TravogAuthService | None = None,
    ):
        selected_auth_service = auth_service
        if selected_auth_service is None:
            selected_auth_service = (
                ql_auth_service
                if isinstance(ql_auth_service, TravogAuthService)
                else TravogAuthService()
            )

        super().__init__(
            http_client=http_client,
            auth_service=selected_auth_service,
        )
