from functools import lru_cache

from app.services.travog.auth_service import TravogAuthService
from app.services.travog.booking_service import TravogBookingService
from app.services.travog.expense_service import TravogExpenseService
from app.services.travog.trip_service import TravogTripService
from app.services.travog.travog_api_service_new import TravogAPIServiceNew


@lru_cache
def get_travog_auth_service() -> TravogAuthService:
    return TravogAuthService()


@lru_cache
def get_travog_expense_service() -> TravogExpenseService:
    return TravogExpenseService(auth_service=get_travog_auth_service())


@lru_cache
def get_travog_trip_service() -> TravogTripService:
    return TravogTripService(auth_service=get_travog_auth_service())


@lru_cache
def get_travog_booking_service() -> TravogBookingService:
    return TravogBookingService(auth_service=get_travog_auth_service())


def get_ql_auth_service() -> TravogAuthService:
    return get_travog_auth_service()


@lru_cache
def get_travog_service_new() -> TravogAPIServiceNew:
    return TravogAPIServiceNew(auth_service=get_travog_auth_service())
