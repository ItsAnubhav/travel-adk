"""
Response models for Travog API.
"""
from typing import Optional, List, Dict, Any
from pydantic import AliasChoices, BaseModel, Field


# ============================================================================
# Auth Response Models
# ============================================================================

class DataTokenResponse(BaseModel):
    """Data token response from Travog auth."""
    company_id: str = Field(alias="companyId")
    identity_token: str = Field(alias="identityToken")
    scope_token: str = Field(alias="scopeToken")
    refresh_token: str = Field(alias="refreshToken")
    access_token_expires_in: str = Field(alias="accessTokenExpiresIn")
    refresh_token_expires_in: str = Field(alias="refreshTokenExpiresIn")
    
    class Config:
        populate_by_name = True


class RootDataTokenResponse(BaseModel):
    """Root response for data token."""
    success: bool
    message: str
    data: Optional[DataTokenResponse] = None
    
    
class AuthResponse(BaseModel):
    """Auth response with access token."""
    access_token: str
    expires_in: int
    token_type: Optional[str] = "Bearer"


# ============================================================================
# Booking Detail Response Models
# ============================================================================

class CompanyDetails(BaseModel):
    """Company details."""
    code: Optional[str] = None
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    city_code: Optional[str] = Field(None, alias="cityCode")
    state_code: Optional[str] = Field(None, alias="stateCode")
    country_code: Optional[str] = Field(None, alias="countryCode")
    post_code: Optional[str] = Field(None, alias="postCode")
    web_site_url: Optional[str] = Field(None, alias="webSiteURL")
    company_lang: Optional[str] = Field(None, alias="companyLang")
    company_cur: Optional[str] = Field(None, alias="companyCur")
    
    class Config:
        populate_by_name = True


class PricingDetails(BaseModel):
    """Pricing details for booking."""
    total_net: Optional[float] = Field(None, alias="totalNet")
    total_ws_gross: Optional[float] = Field(None, alias="totalWsGross")
    total_b2b2b_net: Optional[float] = Field(None, alias="totalB2B2BNet")
    total_gross: Optional[float] = Field(None, alias="totalGross")
    total_net_tax: Optional[float] = Field(None, alias="totalNetTax")
    total_ws_gross_tax: Optional[float] = Field(None, alias="totalWSGrossTax")
    total_ws: Optional[float] = Field(None, alias="totalWS")
    total_tax: Optional[float] = Field(None, alias="totalTax")
    b2b2b_net_tax_charge: Optional[float] = Field(None, alias="b2B2BNetTaxCharge")
    gross_tax_charge: Optional[float] = Field(None, alias="grossTaxCharge")
    
    class Config:
        populate_by_name = True


class MasterDetails(BaseModel):
    """Master booking details."""
    booking_ref: Optional[int] = Field(None, alias="bookingRef")
    branch_id: Optional[int] = Field(None, alias="branchId")
    client_id: Optional[int] = Field(None, alias="clientId")
    is_subagent: Optional[bool] = Field(None, alias="isSubagent")
    b2b_branch_id: Optional[int] = Field(None, alias="b2bBranchId")
    language_code: Optional[str] = Field(None, alias="languageCode")
    date_of_booking: Optional[str] = Field(None, alias="dateOfBooking")
    trip_start_date: Optional[str] = Field(None, alias="tripStartDate")
    destination_code: Optional[str] = Field(None, alias="destinationCode")
    on_hold: Optional[bool] = Field(None, alias="onHold")
    agent_id: Optional[int] = Field(None, alias="agentId")
    agent_name: Optional[str] = Field(None, alias="agentName")
    agent_number: Optional[str] = Field(None, alias="agentNumber")
    agent_email: Optional[str] = Field(None, alias="agentEmail")
    source_name: Optional[str] = Field(None, alias="sourceName")
    booking_lock_status: Optional[bool] = Field(None, alias="bookingLockStatus")
    locked_by_id: Optional[int] = Field(None, alias="lockedById")
    locked_by_name: Optional[str] = Field(None, alias="lockedByName")
    status: Optional[str] = None
    balance_due_date: Optional[str] = Field(None, alias="balanceDueDate")
    services: Optional[str] = None
    sales_channel: Optional[str] = Field(None, alias="salesChannel")
    is_package: Optional[bool] = Field(None, alias="isPackage")
    group_booking: Optional[bool] = Field(None, alias="groupBooking")
    booking_mode: Optional[str] = Field(None, alias="bookingMode")
    pricing_details: Optional[PricingDetails] = Field(None, alias="pricingDetails")
    
    class Config:
        populate_by_name = True


class B2bBranch(BaseModel):
    """B2B branch information."""
    id: Optional[int] = None
    name: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    address3: Optional[str] = None
    city_code: Optional[str] = Field(None, alias="cityCode")
    state_code: Optional[str] = Field(None, alias="stateCode")
    post_code: Optional[str] = Field(None, alias="postCode")
    country_code: Optional[str] = Field(None, alias="countryCode")
    email: Optional[str] = None
    pool_type: Optional[bool] = Field(None, alias="poolType")
    
    class Config:
        populate_by_name = True


class B2bUser(BaseModel):
    """B2B user information."""
    user_id: Optional[int] = Field(None, alias="userId")
    user_title: Optional[str] = Field(None, alias="userTitle")
    user_fname: Optional[str] = Field(None, alias="userFName")
    user_lname: Optional[str] = Field(None, alias="userLName")
    user_phone_no: Optional[str] = Field(None, alias="userPhoneNo")
    user_email: Optional[str] = Field(None, alias="userEmail")
    
    class Config:
        populate_by_name = True


class ClientInfo(BaseModel):
    """Client information."""
    client_id: Optional[int] = Field(None, alias="clientId")
    client_name: Optional[str] = Field(None, alias="clientName")
    account_no: Optional[str] = Field(None, alias="accountNo")
    b2b_user_id: Optional[int] = Field(None, alias="b2bUserId")
    client_type: Optional[str] = Field(None, alias="clientType")
    address1: Optional[str] = None
    address2: Optional[str] = None
    address3: Optional[str] = None
    city_code: Optional[str] = Field(None, alias="cityCode")
    state_code: Optional[str] = Field(None, alias="stateCode")
    country_code: Optional[str] = Field(None, alias="countryCode")
    post_code: Optional[str] = Field(None, alias="postCode")
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    active: Optional[bool] = None
    payment_method: Optional[str] = Field(None, alias="paymentMethod")
    finance_email_address: Optional[str] = Field(None, alias="financeEmailAddress")
    finance_email_alternate: Optional[str] = Field(None, alias="financeEmailAlternate")
    financial_doc_printed: Optional[bool] = Field(None, alias="financialDocPrinted")
    b2b_branch: Optional[B2bBranch] = Field(None, alias="b2bBranch")
    b2b_user: Optional[B2bUser] = Field(None, alias="b2bUser")
    
    class Config:
        populate_by_name = True


class Passport(BaseModel):
    """Passport information."""
    number: Optional[str] = None
    expiry_date: Optional[str] = Field(None, alias="expiryDate")
    nationality_code: Optional[str] = Field(None, alias="nationalityCode")
    issue_country_code: Optional[str] = Field(None, alias="issueCountryCode")
    
    class Config:
        populate_by_name = True


class Preference(BaseModel):
    """Passenger preference."""
    meal_code: Optional[str] = Field(None, alias="mealCode")
    seat_code: Optional[str] = Field(None, alias="seatCode")
    other_pref: Optional[str] = Field(None, alias="otherPref")
    
    class Config:
        populate_by_name = True


class Pax(BaseModel):
    """Passenger information."""
    id: Optional[int] = None
    type: Optional[str] = None
    sub_type: Optional[str] = Field(None, alias="subType")
    lead_pax: Optional[bool] = Field(None, alias="leadPax")
    title: Optional[str] = None
    first_name: Optional[str] = Field(None, alias="firstName")
    middle_name: Optional[str] = Field(None, alias="middleName")
    last_name: Optional[str] = Field(None, alias="lastName")
    status: Optional[str] = None
    email: Optional[str] = None
    alternate_email: Optional[str] = Field(None, alias="alternateEmail")
    phone_no: Optional[str] = Field(None, alias="phoneNo")
    date_of_birth: Optional[str] = Field(None, alias="dateOfBirth")
    age: Optional[int] = None
    passport: Optional[Passport] = None
    identity_no: Optional[str] = Field(None, alias="identityNo")
    visa_number: Optional[str] = Field(None, alias="visaNumber")
    visa_expiry: Optional[str] = Field(None, alias="visaExpiry")
    preference: Optional[Preference] = None
    
    class Config:
        populate_by_name = True


class PassengerInfo(BaseModel):
    """Passenger information summary."""
    no_of_adult: Optional[int] = Field(None, alias="noOfAdult")
    no_of_child: Optional[int] = Field(None, alias="noOfChild")
    no_of_infant: Optional[int] = Field(None, alias="noOfInfant")
    no_of_youth: Optional[int] = Field(None, alias="noOfYouth")
    no_of_senior: Optional[int] = Field(None, alias="noOfSenior")
    pax: Optional[List[Pax]] = None
    
    class Config:
        populate_by_name = True


class FlightSegment(BaseModel):
    """Flight segment details."""
    flight_number: Optional[str] = Field(None, alias="flightNumber")
    airline_code: Optional[str] = Field(None, alias="airlineCode")
    airline_pnr_no: Optional[str] = Field(None, alias="airlinePNRNo")
    segment_destination: Optional[str] = Field(None, alias="segmentDestination")
    dep_airport_code: Optional[str] = Field(None, alias="depAirportCode")
    dep_city_code: Optional[str] = Field(None, alias="depCityCode")
    dep_country_code: Optional[str] = Field(None, alias="depCountryCode")
    dep_date: Optional[str] = Field(None, alias="depDate")
    dep_time: Optional[str] = Field(None, alias="depTime")
    dep_day: Optional[str] = Field(None, alias="depDay")
    dep_terminal: Optional[str] = Field(None, alias="depTerminal")
    arr_airport_code: Optional[str] = Field(None, alias="arrAirportCode")
    arr_city_code: Optional[str] = Field(None, alias="arrCityCode")
    arr_country_code: Optional[str] = Field(None, alias="arrCountryCode")
    arrival_terminal: Optional[str] = Field(
        None,
        validation_alias=AliasChoices("arrivalTerminal", "arrivalterminal"),
        serialization_alias="arrivalTerminal",
    )
    arrival_date: Optional[str] = Field(None, alias="arrivalDate")
    arrival_time: Optional[str] = Field(None, alias="arrivalTime")
    arrival_day: Optional[str] = Field(None, alias="arrivalDay")
    elapsed_flight_time: Optional[str] = Field(None, alias="elapsedFlightTime")
    additional_reference: Optional[str] = Field(None, alias="additionalReference")
    class_: Optional[str] = Field(None, alias="class")
    no_of_seats: Optional[int] = Field(None, alias="noOfSeats")
    status: Optional[str] = None
    
    class Config:
        populate_by_name = True


class AirPassenger(BaseModel):
    """Air passenger reference."""
    id: Optional[int] = None
    inf_traveler_with: Optional[str] = Field(None, alias="infTravelerWith")
    
    class Config:
        populate_by_name = True


class Ticket(BaseModel):
    """Ticket information."""
    id: Optional[int] = None
    pax_id: Optional[int] = Field(None, alias="paxId")
    number: Optional[str] = None
    issue_date: Optional[str] = Field(None, alias="issueDate")
    validating_airline: Optional[str] = Field(None, alias="validatingAirline")
    airline_numeric_code: Optional[str] = Field(None, alias="airlineNumericCode")
    status: Optional[str] = None
    created_by_id: Optional[int] = Field(None, alias="createdById")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    
    class Config:
        populate_by_name = True


class TicketInfo(BaseModel):
    """Ticket information container."""
    ticket: Optional[List[Ticket]] = None


class PaxType(BaseModel):
    """Passenger type fare information."""
    type: Optional[str] = None
    sub_type: Optional[str] = Field(None, alias="subType")
    no_of_adult: Optional[int] = Field(None, alias="noOfAdult")
    fare_type: Optional[str] = Field(None, alias="fareType")
    base_fare: Optional[float] = Field(None, alias="baseFare")
    commission: Optional[float] = None
    commission_on: Optional[str] = Field(None, alias="commissionOn")
    transaction_fee: Optional[float] = Field(None, alias="transactionFee")
    tds: Optional[float] = None
    b2b_discount: Optional[float] = Field(None, alias="b2bDiscount")
    b2b_markup: Optional[float] = Field(None, alias="b2bMarkup")
    b2b2b_discount: Optional[float] = Field(None, alias="b2b2bDiscount")
    b2b2b_markup: Optional[float] = Field(None, alias="b2b2bMarkup")
    ws_nett: Optional[float] = Field(None, alias="wsNett")
    ws_gross: Optional[float] = Field(None, alias="wsGross")
    b2b2b_net: Optional[float] = Field(None, alias="b2b2bNet")
    net_tax: Optional[float] = Field(None, alias="netTax")
    yq: Optional[float] = None
    
    class Config:
        populate_by_name = True


class Fares(BaseModel):
    """Fares information."""
    pax_type: Optional[List[PaxType] | PaxType] = Field(None, alias="paxType")
    
    class Config:
        populate_by_name = True


class TaxDetail(BaseModel):
    """Tax detail information."""
    id: Optional[int] = None
    key: Optional[str] = None
    name: Optional[str] = None
    passenger_type: Optional[str] = Field(None, alias="passengerType")
    supp_curr_tax: Optional[float] = Field(None, alias="suppCurrTax")
    comp_curr_tax: Optional[float] = Field(None, alias="compCurrTax")
    supplier_tax: Optional[bool] = Field(None, alias="supplierTax")
    
    class Config:
        populate_by_name = True


class AdtTaxBreakUp(BaseModel):
    """Adult tax breakup."""
    tax_details: Optional[List[TaxDetail]] = Field(None, alias="taxDetails")
    
    class Config:
        populate_by_name = True


class TaxBreakUp(BaseModel):
    """Tax breakup container."""
    adt_tax_break_up: Optional[AdtTaxBreakUp] = Field(None, alias="adtTaxBreakUp")
    
    class Config:
        populate_by_name = True


class AirInfo(BaseModel):
    """Air product information."""
    flight_id: Optional[int] = Field(None, alias="flightId")
    origin_code: Optional[str] = Field(None, alias="originCode")
    destination_code: Optional[str] = Field(None, alias="destinationCode")
    airline_code: Optional[str] = Field(None, alias="airlineCode")
    market: Optional[str] = None
    refundable: Optional[str] = None
    start_date: Optional[str] = Field(None, alias="startDate")
    supplier_code: Optional[int] = Field(None, alias="supplierCode")
    ticket_supplier: Optional[str] = Field(None, alias="ticketSupplier")
    gds: Optional[str] = None
    gds_name: Optional[str] = Field(None, alias="gdsName")
    gds_pnr: Optional[str] = Field(None, alias="gdsPNR")
    display_supplier_name: Optional[str] = Field(None, alias="displaySupplierName")
    ticket_deadline_date: Optional[str] = Field(None, alias="ticketDeadlineDate")
    supplier_pay_due_date: Optional[str] = Field(None, alias="supplierPayDueDate")
    ticket_supplier_po_generate: Optional[bool] = Field(None, alias="ticketSupplierPOGenerate")
    tour_type: Optional[str] = Field(None, alias="tourType")
    is_package: Optional[bool] = Field(None, alias="isPackage")
    last_tix_date: Optional[str] = Field(None, alias="lastTixDate")
    is_invoiced: Optional[bool] = Field(None, alias="isInvoiced")
    is_exits_supplier_credential: Optional[bool] = Field(None, alias="isExitsSupplierCredential")
    status: Optional[str] = None
    no_of_passenger: Optional[int] = Field(None, alias="noOfPassenger")
    cust_currency: Optional[str] = Field(None, alias="custCurrency")
    cust_currency_roe: Optional[float] = Field(None, alias="custCurrencyROE")
    flight_segment: Optional[List[FlightSegment]] = Field(None, alias="flightSegment")
    passenger_info: Optional[List[AirPassenger]] = Field(None, alias="passengerInfo")
    ticket_info: Optional[TicketInfo] = Field(None, alias="ticketInfo")
    fares: Optional[Fares] = None
    tax_break_up: Optional[TaxBreakUp] = Field(None, alias="taxBreakUp")
    
    class Config:
        populate_by_name = True


class Products(BaseModel):
    """Products container."""
    air_info: Optional[List[AirInfo]] = Field(None, alias="airInfo")
    
    class Config:
        populate_by_name = True


class Payment(BaseModel):
    """Payment information."""
    payment_id: Optional[int] = Field(None, alias="paymentId")
    amount: Optional[float] = None
    pay_mode: Optional[str] = Field(None, alias="payMode")
    pay_date: Optional[str] = Field(None, alias="payDate")
    pay_allocation_id: Optional[str] = Field(None, alias="payAllocationId")
    eft_seq_no: Optional[str] = Field(None, alias="eftSeqNo")
    document_no: Optional[str] = Field(None, alias="documentNo")
    document_type: Optional[str] = Field(None, alias="documentType")
    receipt_no: Optional[str] = Field(None, alias="receiptNo")
    security_key: Optional[str] = Field(None, alias="securityKey")
    auth_code: Optional[str] = Field(None, alias="authCode")
    agent_id: Optional[int] = Field(None, alias="agentId")
    company_id: Optional[str] = Field(None, alias="companyId")
    export_record: Optional[bool] = Field(None, alias="exportRecord")
    txn_verifier: Optional[str] = Field(None, alias="txnVerifier")
    subagent_payment_collection: Optional[bool] = Field(None, alias="subagentPaymentCollection")
    transaction_id: Optional[str] = Field(None, alias="transactionId")
    third_party_invoice_no: Optional[str] = Field(None, alias="thirdPartyInvoiceNo")
    payment_collection_id: Optional[str] = Field(None, alias="paymentCollectionId")
    xero_payment_status: Optional[str] = Field(None, alias="xeroPaymentStatus")
    supp_master_payment_id: Optional[str] = Field(None, alias="suppMasterPaymentId")
    
    class Config:
        populate_by_name = True


class PaymentAllocation(BaseModel):
    """Payment allocation information."""
    payment_mode: Optional[str] = Field(None, alias="paymentMode")
    payment_mode_display: Optional[str] = Field(None, alias="paymentModeDisplay")
    payment_type: Optional[str] = Field(None, alias="paymentType")
    card_name: Optional[str] = Field(None, alias="cardName")
    balance_due_date: Optional[str] = Field(None, alias="balanceDueDate")
    payment_allocation_date: Optional[str] = Field(None, alias="paymentAllocationDate")
    method: Optional[str] = None
    card_company: Optional[str] = Field(None, alias="cardCompany")
    ibt_booking_ref: Optional[str] = Field(None, alias="ibtBookingRef")
    payment_gateway: Optional[str] = Field(None, alias="paymentGateway")
    status: Optional[str] = None
    payment_received_date: Optional[str] = Field(None, alias="paymentReceivedDate")
    pay_allocation_id: Optional[str] = Field(None, alias="payAllocationId")
    actual_pay_alloc_id_for_pmt_reversal: Optional[str] = Field(None, alias="actualPayAllocIdForPmtReversal")
    doc_no: Optional[str] = Field(None, alias="docNo")
    reconciled: Optional[str] = None
    amount: Optional[float] = None
    no_of_installments: Optional[int] = Field(None, alias="noOfInstallments")
    transaction_id: Optional[str] = Field(None, alias="transactionId")
    fraud_check_order_id: Optional[str] = Field(None, alias="fraudCheckOrderId")
    fraud_check_status: Optional[str] = Field(None, alias="fraudCheckStatus")
    boleto_url: Optional[str] = Field(None, alias="boletoURL")
    boleto_order_key: Optional[str] = Field(None, alias="boletoOrderKey")
    boleto_tran_key: Optional[str] = Field(None, alias="boletoTranKey")
    bifurcation: Optional[List[Any]] = None
    
    class Config:
        populate_by_name = True


class PaymentDetails(BaseModel):
    """Payment details container."""
    payment: Optional[List[Payment]] = None
    payment_allocation: Optional[List[PaymentAllocation]] = Field(None, alias="paymentAllocation")
    
    class Config:
        populate_by_name = True


class Airport(BaseModel):
    """Airport information."""
    code: Optional[str] = None
    name: Optional[str] = None
    city_code: Optional[str] = Field(None, alias="cityCode")
    city_name: Optional[str] = Field(None, alias="cityName")
    country_code: Optional[str] = Field(None, alias="countryCode")
    country_name: Optional[str] = Field(None, alias="countryName")
    zone_code: Optional[str] = Field(None, alias="zoneCode")
    zone_name: Optional[str] = Field(None, alias="zoneName")
    
    class Config:
        populate_by_name = True


class City(BaseModel):
    """City information."""
    code: Optional[str] = None
    name: Optional[str] = None
    country_code: Optional[str] = Field(None, alias="countryCode")
    country_name: Optional[str] = Field(None, alias="countryName")
    zone_code: Optional[str] = Field(None, alias="zoneCode")
    zone_name: Optional[str] = Field(None, alias="zoneName")
    
    class Config:
        populate_by_name = True


class Country(BaseModel):
    """Country information."""
    code: Optional[str] = None
    name: Optional[str] = None
    nationality: Optional[str] = None


class Airline(BaseModel):
    """Airline information."""
    code: Optional[str] = None
    name: Optional[str] = None
    normal_logo: Optional[str] = Field(None, alias="normalLogo")
    square_logo: Optional[str] = Field(None, alias="squareLogo")
    
    class Config:
        populate_by_name = True


class Dictionaries(BaseModel):
    """Dictionaries for lookup data."""
    airport: Optional[Dict[str, Airport]] = None
    city: Optional[Dict[str, City]] = None
    country: Optional[Dict[str, Country]] = None
    airline: Optional[Dict[str, Airline]] = None


class BookingDetails(BaseModel):
    """Main booking details container."""
    company_details: Optional[CompanyDetails] = Field(None, alias="companyDetails")
    master_details: Optional[MasterDetails] = Field(None, alias="masterDetails")
    client_info: Optional[ClientInfo] = Field(None, alias="clientInfo")
    passenger_info: Optional[PassengerInfo] = Field(None, alias="passengerInfo")
    products: Optional[Products] = None
    payment_details: Optional[PaymentDetails] = Field(None, alias="paymentDetails")
    
    class Config:
        populate_by_name = True


class BookingData(BaseModel):
    """Booking data container."""
    booking_details: Optional[BookingDetails] = Field(None, alias="bookingDetails")
    dictionaries: Optional[Dictionaries] = None
    
    class Config:
        populate_by_name = True


class BookingDetailResponse(BaseModel):
    """Root booking detail response."""
    success: bool
    message: str
    data: Optional[BookingData] = None


# ============================================================================
# Fare Rules Response Models
# ============================================================================

class XHostCharges(BaseModel):
    """X-Host charges information."""
    adt_before_departure_charge_amount: Optional[Any] = Field(None, alias="AdtBeforeDepartureChargeAmount")
    adt_after_departure_charge_amount: Optional[Any] = Field(None, alias="AdtAfterDepartureChargeAmount")
    adt_voluntary_change_charge_amount: Optional[Any] = Field(None, alias="AdtVoluntaryChangeChargeAmount")
    adt_involuntary_change_charge_amount: Optional[Any] = Field(None, alias="AdtInvoluntaryChangeChargeAmount")
    adt_canx_charge: Optional[Any] = Field(None, alias="AdtCanxCharge")
    adt_re_issue_charge: Optional[Any] = Field(None, alias="AdtReIssueCharge")
    adt_rerouting_charge_amount: Optional[Any] = Field(None, alias="AdtReroutingChargeAmount")
    adt_no_show_charges_charge_amount: Optional[Any] = Field(None, alias="AdtNoShowChargesChargeAmount")
    
    class Config:
        populate_by_name = True


class AirlineCharges(BaseModel):
    """Airline charges information."""
    adt_charge: Optional[str] = Field(None, alias="AdtCharge")
    yth_charge: Optional[str] = Field(None, alias="YthCharge")
    chd_charge: Optional[str] = Field(None, alias="ChdCharge")
    inf_charge: Optional[str] = Field(None, alias="InfCharge")
    
    class Config:
        populate_by_name = True


class CancellationReply(BaseModel):
    """Cancellation reply information."""
    x_host_charges: Optional[XHostCharges] = Field(None, alias="XHostCharges")
    airline_charges: Optional[AirlineCharges] = Field(None, alias="AirlineCharges")
    canx_remarks: Optional[Any] = Field(None, alias="CanxRemarks")
    refund_type: Optional[str] = Field(None, alias="RefundType")
    fare_basis_code: Optional[str] = Field(None, alias="FareBasisCode")
    airline: Optional[str] = Field(None, alias="Airline")
    fare_type: Optional[str] = Field(None, alias="FareType")
    booking_class: Optional[str] = Field(None, alias="BookingClass")
    
    class Config:
        populate_by_name = True


class Description(BaseModel):
    """Rule description."""
    title: Optional[str] = Field(None, alias="Title")
    text: Optional[str] = None
    
    class Config:
        populate_by_name = True


class RuleInfo(BaseModel):
    """Rule information."""
    title: Optional[str] = Field(None, alias="Title")
    description: Optional[List[Description]] = Field(None, alias="Description")
    
    class Config:
        populate_by_name = True


class BaggagePax(BaseModel):
    """Baggage passenger information."""
    cabin: Optional[str] = Field(None, alias="Cabin")
    check_in: Optional[str] = Field(None, alias="CheckIn")
    text: Optional[str] = None
    
    class Config:
        populate_by_name = True


class BaggageSegment(BaseModel):
    """Baggage segment information."""
    name: Optional[str] = Field(None, alias="Name")
    pax: Optional[BaggagePax] = Field(None, alias="Pax")
    
    class Config:
        populate_by_name = True


class BaggageInfo(BaseModel):
    """Baggage information."""
    segment: Optional[List[BaggageSegment]] = Field(None, alias="Segment")
    
    class Config:
        populate_by_name = True


class FaresRulesReply(BaseModel):
    """Fares rules reply."""
    rule_info: Optional[RuleInfo] = Field(None, alias="RuleInfo")
    baggage_info: Optional[BaggageInfo] = Field(None, alias="BaggageInfo")
    
    class Config:
        populate_by_name = True


class Currency(BaseModel):
    """Currency information."""
    curr_c: Optional[str] = Field(None, alias="CurrC")
    curr_n: Optional[str] = Field(None, alias="CurrN")
    
    class Config:
        populate_by_name = True


class FareRules(BaseModel):
    """Fare rules container."""
    cancellation_reply: Optional[CancellationReply] = Field(None, alias="CancellationReply")
    fares_rules_reply: Optional[FaresRulesReply] = Field(None, alias="FaresRulesReply")
    curr: Optional[Currency] = Field(None, alias="Curr")
    journy_type: Optional[str] = Field(None, alias="JournyType")
    company_id: Optional[str] = Field(None, alias="CompanyID")
    noa: Optional[str] = None
    noc: Optional[str] = None
    noy: Optional[str] = None
    noi: Optional[str] = None
    
    class Config:
        populate_by_name = True


class FareRulesData(BaseModel):
    """Fare rules data container."""
    fare_rules: Optional[FareRules] = Field(None, alias="FareRules")
    
    class Config:
        populate_by_name = True


class FareRulesDetail(BaseModel):
    """Root fare rules detail response."""
    success: Optional[bool] = None
    message: str
    data: Optional[FareRulesData] = None
