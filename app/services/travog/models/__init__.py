"""
Models package for Travog service.
"""
from app.services.travog.models.requests import QLAuthRequest
from app.services.travog.models.responses import (
    DataTokenResponse,
    RootDataTokenResponse,
    AuthResponse,
    BookingDetailResponse,
    BookingData,
    BookingDetails,
    FareRulesDetail,
    FareRules,
    FareRulesData
)

__all__ = [
    "QLAuthRequest",
    "DataTokenResponse",
    "RootDataTokenResponse",
    "AuthResponse",
    "BookingDetailResponse",
    "BookingData",
    "BookingDetails",
    "FareRulesDetail",
    "FareRules",
    "FareRulesData"
]
