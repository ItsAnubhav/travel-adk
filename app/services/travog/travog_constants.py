"""
Travog API constants.
"""


class TravogConstants:
    """Constants for Travog API integration."""

    QL_AUTH_ENDPOINT = "/XChangeauth/api/auth/jwt/generateLoginToken"
    BASE_URL = "https://preprod.quadlabs.net"
    IMAGE_BASE_URL = "https://preprod.quadlabs.net/XChangeExpenseManagement/"
    AUTH_URL = f"{BASE_URL}/XChangeauth/api/auth/generateToken"
    FORGE_LOGIN_URL = f"{BASE_URL}/forge/api/v1/auth/jwt/login"
    FORGE_REFRESH_URL = f"{BASE_URL}/forge/api/v1/auth/jwt/refresh"
    TRIPS_URL = f"{BASE_URL}/forge/api/v1/trips"
    TRIP_APPROVALS_URL = f"{BASE_URL}/forge/api/v1/trips"
    TRIP_SEND_FOR_APPROVAL_URL = f"{BASE_URL}/forge/api/v1/trips"
    FORGE_BOOKINGS_URL = f"{BASE_URL}/forge/api/v1/bookings"
    FORGE_BOOKING_FARE_RULES_URL = f"{BASE_URL}/forge/api/v1/bookings/fare-rules"
    BOOKING_DETAILS_URL = f"{BASE_URL}/XchangeServices/api/XchangeBooking/getBookingDetails"
    FARE_RULES_URL = f"{BASE_URL}/XchangeServices/api/XchangeBooking/getFareRules"
    EXPENSES_URL = f"{BASE_URL}/forge/api/v1/expenses"
    CREATE_EXPENSE_RAW_URL = f"{BASE_URL}/forge/api/v1/expenses/create_expense"
    CREATE_EXPENSE_URL = CREATE_EXPENSE_RAW_URL
    UPDATE_EXPENSE_RAW_URL = f"{BASE_URL}/forge/api/v1/expenses/update_expense"
    EXPENSE_MASTERS_ALL_URL = f"{BASE_URL}/forge/api/v1/expensemasters/all"
    VALIDATE_INVOICE_URL = f"{BASE_URL}/forge/api/v1/expenses/validate-invoice"
    EXPENSE_CATEGORIES_URL = f"{BASE_URL}/XChangeExpenseManagement/api/ExpenseManagement/category-master/list"
    EXPENSE_SETTINGS_URL = f"{BASE_URL}/Travog/api/Expense/ExpenseSettings"

    # NDC Flight (XchangeFlightService v2)
    AIR_SHOPPING_URL = f"{BASE_URL}/XchangeFlightService/v2/offers/shop"
    OFFER_PRICE_URL = f"{BASE_URL}/XchangeFlightService/v2/offers/price"
    FARE_RULE_URL = f"{BASE_URL}/XchangeFlightService/v2/offers/fareRule"
    ORDER_CREATE_URL = f"{BASE_URL}/XchangeFlightService/v2/orders/create"
