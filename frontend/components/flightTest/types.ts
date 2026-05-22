export interface Money {
    amount: number;
    currency: string;
}

export interface ParsedSegment {
    segmentID: string;
    sellKey?: string;
    airline: string;
    flightNumber: string;
    aircraft?: string;
    departureAirport: string;
    departureTerminal?: string;
    arrivalAirport: string;
    arrivalTerminal?: string;
    departureDate?: string;
    departureTime?: string;
    arrivalDate?: string;
    arrivalTime?: string;
    durationMinutes?: number;
}

export type TripType = 'OW' | 'RT' | 'MC';

export interface ParsedLeg {
    direction: 'OUT' | 'RET' | 'DEP' | 'MC';
    legIndex: number;
    departureAirport: string;
    arrivalAirport: string;
    departureDate?: string;
    departureTime?: string;
    arrivalDate?: string;
    arrivalTime?: string;
    durationMinutes?: number;
    stops: number;
    stopAirports: string[];
    segments: ParsedSegment[];
}

export interface ParsedPaxBreakdown {
    type: 'ADT' | 'CHD' | 'INF' | 'YOUTH' | 'SENIOR' | string;
    baseAmount: number;
    tax: number;
    fareBasis: string[];
    taxSummary?: Array<{ code: string; name?: string; amount: number }>;
    transactionFee?: number;
    autoChargeAdditional?: number;
    vat?: number;
    subtotal: number;
}

export interface ParsedFare {
    fareIndex: number;
    offerItemID?: string;
    brandId?: string;
    brandName?: string;
    fareType?: string;
    cabinClass?: string;
    refundable: boolean;
    totalAmount: number;
    totalTaxAmount: number;
    currency: string;
    rbd: string[];
    fareBasis: string[];
    paxBreakdown: ParsedPaxBreakdown[];
    rawFareDetail: any;
}

export interface ParsedOffer {
    offerID: string;
    ownerId?: string;
    ownerCode?: string;
    validatingCarrier: string;
    airlineName: string;
    cabinClass?: string;
    brandName?: string;
    fareType?: string;
    refundable: boolean;
    anyRefundable: boolean;
    totalAmount: number;
    totalTaxAmount: number;
    currency: string;
    rbd: string[];
    fareBasis: string[];
    paxBreakdown: ParsedPaxBreakdown[];
    legs: ParsedLeg[];
    tripType: TripType;
    fares: ParsedFare[];
    raw: any;
}

export interface ParsedSearch {
    offers: ParsedOffer[];
    metadata: Record<string, any>;
    paxCounts: { ADT: number; CHD: number; INF: number; total: number };
    currency: string;
    tripType: TripType;
    origin?: string;
    destination?: string;
    departDate?: string;
    returnDate?: string;
    messageId?: string;
}

export interface ParsedFareRuleSegment {
    segment: string;
    fareBasis?: string;
    rbd?: string;
    direction?: string;
    rules: Array<{ label: string; value: string; tone?: 'zero' | 'warn' | 'normal' | 'dash' }>;
}

export interface ParsedFareRuleSection {
    title: string;
    value: string;
}

export interface ParsedFareRuleRoute {
    title: string;
    sections: ParsedFareRuleSection[];
}

export type FareRulePaxType = 'ADT' | 'YTH' | 'CHD' | 'INF';

export interface ParsedFareRulePaxCharges {
    paxType: FareRulePaxType;
    beforeDeparture: number;
    afterDeparture: number;
    voluntaryChange: number;
    involuntaryChange: number;
    cancellation: number;
    reissue: number;
    rerouting: number;
    noShow: number;
    airlineCharge: number;
}

export interface ParsedFareRuleChargeBlock {
    airline?: string;
    fareType?: string;
    fareBasisCode?: string;
    bookingClass?: string;
    refundType?: string;
    canxRemarks?: string;
    pax: ParsedFareRulePaxCharges[];
}

export type FareRuleBadgeTone = 'success' | 'warning' | 'danger' | 'info';

export interface ParsedFareRuleAISummary {
    airline?: { code?: string; name?: string };
    fareInfo?: {
        fareType?: string;
        cabinClass?: string;
        bookingClass?: string;
        refundable?: string;
        changeable?: boolean;
    };
    changePolicy?: {
        allowed?: boolean;
        fee?: { amount?: number | null; currency?: string; description?: string };
        sameBrandOnly?: boolean;
        noShowChangeAllowed?: boolean;
        summary?: string;
    };
    cancellationPolicy?: {
        beforeDeparture?: { allowed?: boolean; fee?: { amount?: number; currency?: string }; summary?: string };
        afterDeparture?: { allowed?: boolean; summary?: string };
        noShow?: { allowed?: boolean; summary?: string };
    };
    refundPolicy?: {
        refundable?: string;
        unusedTaxesRefundable?: boolean;
        specialCases?: string[];
        summary?: string;
    };
    ticketingPolicy?: {
        advancePurchaseDays?: number;
        ticketingTimeLimitHours?: number;
        sameDayTicketingRequiredWithinHours?: number;
        summary?: string;
    };
    stayPolicy?: { minimumStay?: string | null; maximumStay?: string | null };
    stopoverPolicy?: {
        allowed?: boolean;
        freeStopovers?: number;
        paidStopovers?: number;
        paidStopoverFee?: { amount?: number; currency?: string };
        summary?: string;
    };
    transferPolicy?: { unlimitedTransfers?: boolean; surfaceSectorAllowed?: boolean };
    childPolicy?: {
        childDiscountPercent?: number;
        infantWithoutSeatPercent?: number;
        infantWithSeatPercent?: number;
        unaccompaniedMinorAllowed?: boolean;
    };
    restrictions?: { blackoutDates?: boolean; travelRestrictions?: boolean; salesRestrictions?: boolean };
    importantNotes?: string[];
    uiBadges?: Array<{ type: FareRuleBadgeTone; label: string }>;
    aiConfidence?: { overall?: number; refundability?: number; changeability?: number };
}

export interface ParsedFareRule {
    headline: {
        refundMax?: { amount: number; currency: string };
        changePenalty?: { amount: number; currency: string } | 'FREE';
        noShow?: { amount: number; currency: string };
        revalidation?: 'NA' | 'OK';
    };
    tags: Array<{ label: string; tone: 'good' | 'warn' | 'normal' }>;
    sectors: ParsedFareRuleSegment[];
    airlineCharges?: Array<{ label: string; value: string; tone?: 'zero' | 'warn' | 'normal' }>;
    routes?: ParsedFareRuleRoute[];
    chargeBlocks?: ParsedFareRuleChargeBlock[];
    summary?: ParsedFareRuleAISummary;
    saleCurrency: string;
    raw: any;
}

export interface ParsedOrder {
    pnr: string;
    status: string;
    statusLabel?: string;
    ownerName?: string;
    carrier: string;
    carrierName?: string;
    passengers: Array<{
        paxId: string;
        ptc: string;
        title?: string;
        givenName?: string;
        surname?: string;
        middleName?: string;
        dob?: string;
        gender?: string;
        nationality?: string;
        passportNumber?: string;
        passportExpiry?: string;
        passportIssuingCountry?: string;
    }>;
    segments: ParsedSegment[];
    services: Array<{ name: string; sub?: string; pax?: string; price?: Money }>;
    contact: { email?: string; phone?: string; phoneCountryCode?: string };
    total: Money;
    raw: any;
}

export interface PaxFormEntry {
    paxId: string;
    ptc: 'ADT' | 'CHD' | 'INF';
    title: string;
    givenName: string;
    middleName: string;
    surname: string;
    dob: string;
    gender: 'M' | 'F' | 'X';
    nationality: string;
    docType: 'P' | 'ID';
    docNumber: string;
    docExpiry: string;
    docIssuingCountry: string;
    ffpAirline?: string;
    ffpNumber?: string;
    ssr?: string;
}

export interface ContactForm {
    email: string;
    countryCode: string;
    mobile: string;
    isPrimary: boolean;
}
