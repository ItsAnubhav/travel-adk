import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';
import {
    FLIGHT_ENDPOINTS,
    FlightApiResult,
    callFlightApi,
    getStoredAccessToken,
} from '../services/flightTestApi';
import { FlightTestStyles } from '../components/flightTest/FlightTestStyles';
import { ResultsView } from '../components/flightTest/ResultsView';
import { BrandedFareView } from '../components/flightTest/BrandedFareView';
import { PassengerView } from '../components/flightTest/PassengerView';
import { OfferPriceView } from '../components/flightTest/OfferPriceView';
import { OrderConfirmedView } from '../components/flightTest/OrderConfirmedView';
import { ResultsLoading } from '../components/flightTest/ResultsLoading';
import { ResultsError } from '../components/flightTest/ResultsError';
import {
    parseAirShopping,
    parseFareRule,
    parseOfferPrice,
    parseOrderView,
} from '../components/flightTest/parsers';
import type {
    ContactForm,
    ParsedFare,
    ParsedFareRule,
    ParsedOffer,
    ParsedOrder,
    ParsedSearch,
    PaxFormEntry,
} from '../components/flightTest/types';

import airShoppingSample from '../mocks/flightSamples/airShoppingRQ.json';
import offerPriceSample from '../mocks/flightSamples/offerPriceRQ.json';
import fareRuleSample from '../mocks/flightSamples/fareRuleRQ.json';
import orderCreateSample from '../mocks/flightSamples/orderCreateRQ.json';

type Stage = 'results' | 'branded' | 'passenger' | 'price' | 'confirmed';

const TOKEN_OVERRIDE_KEY = 'aiva:flightTest:tokenOverride';

interface FlightTestPageProps {
    embedded?: boolean;
    initialSearchRequest?: Record<string, any> | null;
    onSearchSummary?: (summary: Record<string, any>) => void | Promise<void>;
}

const FlightTestPage: React.FC<FlightTestPageProps> = ({ embedded = false, initialSearchRequest = null, onSearchSummary }) => {
    // Token plumbing (reused from previous version)
    const [tokenOverride, setTokenOverride] = useState<string>(
        () => (typeof window !== 'undefined' && localStorage.getItem(TOKEN_OVERRIDE_KEY)) || '',
    );
    const [tokenEditorOpen, setTokenEditorOpen] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (tokenOverride) localStorage.setItem(TOKEN_OVERRIDE_KEY, tokenOverride);
        else localStorage.removeItem(TOKEN_OVERRIDE_KEY);
    }, [tokenOverride]);
    const accessToken = tokenOverride || getStoredAccessToken();

    // Stage state
    const [stage, setStage] = useState<Stage>('results');

    // Air shopping
    const [search, setSearch] = useState<ParsedSearch | null>(null);
    const [airResult, setAirResult] = useState<FlightApiResult | null>(null);
    const [airLoading, setAirLoading] = useState(true);
    const [airError, setAirError] = useState<string | null>(null);

    // Selection
    const [selectedOffer, setSelectedOffer] = useState<ParsedOffer | null>(null);
    const [selectedFare, setSelectedFare] = useState<ParsedFare | null>(null);

    // Passenger form
    const [paxForm, setPaxForm] = useState<PaxFormEntry[]>([]);
    const [contactForm, setContactForm] = useState<ContactForm>({
        email: 'ss@gmail.com',
        countryCode: '+91',
        mobile: '9241129100',
        isPrimary: true,
    });

    // Offer price
    const [priced, setPriced] = useState<ParsedOffer | null>(null);
    const [pricedResult, setPricedResult] = useState<FlightApiResult | null>(null);
    const [pricedLoading, setPricedLoading] = useState(false);
    const [pricedError, setPricedError] = useState<string | null>(null);

    // Fare rules
    const [rules, setRules] = useState<ParsedFareRule | null>(null);
    const [rulesResult, setRulesResult] = useState<FlightApiResult | null>(null);
    const [rulesLoading, setRulesLoading] = useState(false);
    const [rulesError, setRulesError] = useState<string | null>(null);

    // Order create
    const [order, setOrder] = useState<ParsedOrder | null>(null);
    const [orderResult, setOrderResult] = useState<FlightApiResult | null>(null);
    const [orderLoading, setOrderLoading] = useState(false);
    const [orderError, setOrderError] = useState<string | null>(null);

    // messageId returned by AirShopping; used as GUID header for FareRules / OfferPrice / OrderCreate.
    // Kept in a ref so closures created before AirShopping returned still see the latest value.
    const messageIdRef = useRef<string | undefined>(undefined);

    // In-flight offer-price promise. Multi-fare offers pre-fetch offer-price as
    // soon as the branded-fare page is shown, so goBrandedContinue can reuse
    // the result and run fare-rules immediately.
    const offerPricePromiseRef = useRef<Promise<FlightApiResult | null> | null>(null);

    // Debug
    const [debugOpen, setDebugOpen] = useState(false);

    // Initial Air Shopping
    useEffect(() => {
        runAirShopping();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const runAirShopping = async () => {
        setAirLoading(true);
        setAirError(null);
        setSearch(null);
        messageIdRef.current = undefined;
        const requestBody = buildAirShoppingBody(initialSearchRequest);
        console.log('[FlightTestPage] AirShopping request', {
            initialSearchRequest,
            requestBody,
        });
        const res = await callFlightApi(FLIGHT_ENDPOINTS.airShopping, requestBody, { accessToken });
        setAirResult(res);
        const envelopeError = extractEnvelopeError(res);
        if (res.networkError) {
            setAirError(res.networkError);
        } else if (!res.ok && !res.data) {
            setAirError(`${res.status} ${res.statusText}`);
        } else if (envelopeError) {
            setAirError(envelopeError);
        }
        if (res.data) {
            const parsed = parseAirShopping(res.data);
            messageIdRef.current = parsed.messageId || extractMessageId(res.data);
            console.log('[FlightTestPage] AirShopping messageId →', messageIdRef.current);
            setSearch(parsed);
            setPaxForm(buildInitialPax(parsed));
            try {
                void onSearchSummary?.(buildSearchContextSummary(parsed));
            } catch {
                // Context injection is best-effort; the UI should still render.
            }
            if (parsed.offers.length === 0 && !envelopeError) {
                setAirError('The API returned no flight offers for this request.');
            }
        }
        setAirLoading(false);
    };

    const goSelect = (offer: ParsedOffer) => {
        setSelectedOffer(offer);
        setSelectedFare(null);
        setPriced(null);
        setPricedResult(null);
        setPricedError(null);
        setRules(null);
        setRulesResult(null);
        setRulesError(null);
        setOrder(null);
        setOrderResult(null);
        offerPricePromiseRef.current = null;
        // If there's only one fare, skip directly to passenger.
        if (offer.fares.length <= 1) {
            const lone = offer.fares[0] || null;
            setSelectedFare(lone);
            setStage('passenger');
            if (lone) void runPriceThenRules(offer, lone);
            return;
        }
        setStage('branded');
        // Pre-fetch offer-price in the background while the user browses
        // branded fares so the subsequent fare-rules call has the PricedOffer
        // payload ready the moment they continue.
        offerPricePromiseRef.current = runOfferPrice(offer, null);
    };

    const goBrandedContinue = async (offer: ParsedOffer, fare: ParsedFare) => {
        setSelectedFare(fare);
        setRules(null);
        setRulesResult(null);
        setRulesError(null);
        setStage('passenger');
        const pending = offerPricePromiseRef.current;
        offerPricePromiseRef.current = null;
        const priceRes = pending ? await pending : await runOfferPrice(offer, fare);
        await runFareRules(offer, fare, priceRes);
    };

    // New order: offer-price first, then fare-rules (rules use the PricedOffer
    // node returned by offer-price as the fareRuleRQ.request payload).
    const runPriceThenRules = async (offer: ParsedOffer, fare: ParsedFare) => {
        const priceRes = await runOfferPrice(offer, fare);
        await runFareRules(offer, fare, priceRes);
    };

    const runOfferPrice = async (offer: ParsedOffer, fare: ParsedFare | null): Promise<FlightApiResult | null> => {
        setPricedLoading(true);
        setPricedError(null);
        setPriced(null);
        const body = buildOfferPriceBody(offer, fare, messageIdRef.current);
        const res = await callFlightApi(FLIGHT_ENDPOINTS.offerPrice, body, { accessToken });
        setPricedResult(res);
        const envelopeError = extractEnvelopeError(res);
        if (res.networkError) setPricedError(res.networkError);
        else if (!res.ok && !res.data) setPricedError(`${res.status} ${res.statusText}`);
        else if (envelopeError) setPricedError(envelopeError);
        if (res.data) {
            const parsed = parseOfferPrice(res.data);
            if (parsed) setPriced(parsed);
        }
        setPricedLoading(false);
        return res;
    };

    const runFareRules = async (offer: ParsedOffer, fare: ParsedFare, priceRes?: FlightApiResult | null) => {
        setRulesLoading(true);
        setRulesError(null);
        setRules(null);
        const body = buildFareRuleBody(offer, fare, messageIdRef.current, priceRes?.data);
        const res = await callFlightApi(FLIGHT_ENDPOINTS.fareRule, body, { accessToken });
        setRulesResult(res);
        const envelopeError = extractEnvelopeError(res);
        if (res.networkError) setRulesError(res.networkError);
        else if (!res.ok && !res.data) setRulesError(`${res.status} ${res.statusText}`);
        else if (envelopeError) setRulesError(envelopeError);
        if (res.data) {
            const parsed = parseFareRule(res.data);
            if (parsed) setRules(parsed);
        }
        setRulesLoading(false);
    };

    const goPassengerContinue = async (pax: PaxFormEntry[], contact: ContactForm) => {
        setPaxForm(pax);
        setContactForm(contact);
        setStage('price');
        if (!selectedOffer) return;
        // Re-price on the payment checkout page to confirm the fare is still valid.
        await runOfferPrice(selectedOffer, selectedFare);
    };

    const goConfirm = async () => {
        setStage('confirmed');
        if (!selectedOffer) return;
        setOrderLoading(true);
        setOrderError(null);
        setOrder(null);
        const body = buildOrderCreateBody(
            selectedOffer,
            selectedFare,
            paxForm,
            contactForm,
            messageIdRef.current,
            pricedResult?.data,
        );
        const res = await callFlightApi(FLIGHT_ENDPOINTS.orderCreate, body, { accessToken });
        setOrderResult(res);
        const envelopeError = extractEnvelopeError(res);
        if (res.networkError) setOrderError(res.networkError);
        else if (!res.ok && !res.data) setOrderError(`${res.status} ${res.statusText}`);
        else if (envelopeError) setOrderError(envelopeError);
        if (res.data) {
            const parsed = parseOrderView(res.data);
            if (parsed) setOrder(parsed);
        }
        setOrderLoading(false);
    };

    const askFareRuleQuestion = async (question: string, parsedRules: ParsedFareRule): Promise<string> => {
        const body = {
            question,
            messageId: messageIdRef.current,
            fareRuleSummary: parsedRules.summary ?? null,
            ruleInfo: parsedRules.routes ?? [],
            cancellationReply: parsedRules.chargeBlocks ?? [],
        };
        const res = await callFlightApi(FLIGHT_ENDPOINTS.fareRuleAsk, body, { accessToken });
        if (res.networkError) throw new Error(res.networkError);
        if (!res.ok && !res.data) throw new Error(`${res.status} ${res.statusText}`);
        const envelopeError = extractEnvelopeError(res);
        if (envelopeError) throw new Error(envelopeError);
        const data = res.data as any;
        const answer =
            (typeof data?.data?.answer === 'string' && data.data.answer) ||
            (typeof data?.answer === 'string' && data.answer) ||
            (typeof data?.data === 'string' && data.data) ||
            '';
        if (!answer) throw new Error('No answer field in response.');
        return answer;
    };

    const onStartOver = () => {
        setStage('results');
        setSelectedOffer(null);
        setSelectedFare(null);
        setPriced(null);
        setRules(null);
        setOrder(null);
        offerPricePromiseRef.current = null;
    };

    // For passenger / price / confirmed stages we want all summaries to reflect
    // the user's chosen branded fare, not the offer's "cheapest fare" default.
    const displayOffer: ParsedOffer | null = useMemo(() => {
        if (!selectedOffer) return null;
        if (!selectedFare) return selectedOffer;
        return {
            ...selectedOffer,
            brandName: selectedFare.brandName ?? selectedOffer.brandName,
            fareType: selectedFare.fareType ?? selectedOffer.fareType,
            cabinClass: selectedFare.cabinClass ?? selectedOffer.cabinClass,
            refundable: selectedFare.refundable,
            totalAmount: selectedFare.totalAmount,
            totalTaxAmount: selectedFare.totalTaxAmount,
            currency: selectedFare.currency,
            rbd: selectedFare.rbd,
            fareBasis: selectedFare.fareBasis,
            paxBreakdown: selectedFare.paxBreakdown,
        };
    }, [selectedOffer, selectedFare]);

    const debugPayloads = useMemo(
        () => ({
            airShopping: airResult,
            offerPrice: pricedResult,
            fareRule: rulesResult,
            orderCreate: orderResult,
        }),
        [airResult, pricedResult, rulesResult, orderResult],
    );

    return (
        <div className={`ff-test${embedded ? ' embedded' : ''}`}>
            <FlightTestStyles />

            {tokenEditorOpen && (
                <div style={{
                    background: 'var(--ff-surface)',
                    borderBottom: '1px solid var(--ff-border)',
                    padding: '10px 14px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                }}>
                    <textarea
                        value={tokenOverride}
                        onChange={(e) => setTokenOverride(e.target.value.trim())}
                        placeholder="Paste a JWT to override the stored login token (Authorization: Bearer …)"
                        spellCheck={false}
                        style={{
                            flex: 1,
                            height: 64,
                            resize: 'vertical',
                            border: '1px solid var(--ff-border)',
                            borderRadius: 8,
                            background: 'var(--ff-surface-2)',
                            color: 'var(--ff-text)',
                            padding: 8,
                            fontFamily: "'Geist Mono', ui-monospace, monospace",
                            fontSize: 11,
                        }}
                    />
                    <button className="ff-btn-ghost" onClick={() => setTokenOverride('')}>
                        Clear
                    </button>
                </div>
            )}

            <div className="ff-chat-panel">
                {airLoading && stage === 'results' && (
                    <ResultsLoading {...loadingHints(buildAirShoppingBody(initialSearchRequest))} />
                )}

                {airError && !airLoading && stage === 'results' && (
                    <ResultsError error={airError} onRetry={runAirShopping} retrying={airLoading} />
                )}

                {stage === 'results' && !airLoading && !airError && search && (
                    <ResultsView search={search} onSelect={goSelect} />
                )}

                {stage === 'branded' && selectedOffer && search && (
                    <BrandedFareView
                        offer={selectedOffer}
                        search={search}
                        onBack={() => setStage('results')}
                        onContinue={goBrandedContinue}
                    />
                )}

                {stage === 'passenger' && displayOffer && search && (
                    <PassengerView
                        offer={displayOffer}
                        search={search}
                        initialPax={paxForm}
                        initialContact={contactForm}
                        fareRules={rules}
                        fareRulesLoading={rulesLoading}
                        fareRulesError={rulesError}
                        onAskFareRuleQuestion={askFareRuleQuestion}
                        onBack={() =>
                            setStage(selectedOffer && selectedOffer.fares.length > 1 ? 'branded' : 'results')
                        }
                        onContinue={goPassengerContinue}
                    />
                )}

                {stage === 'price' && displayOffer && search && (
                    <OfferPriceView
                        pricedOffer={priced}
                        selectedOffer={displayOffer}
                        search={search}
                        loading={pricedLoading}
                        error={pricedError}
                        fareMatch={readPricedFareMatch(pricedResult?.data)}
                        onBack={() => setStage('passenger')}
                        onContinueToPayment={() => goConfirm()}
                    />
                )}

                {stage === 'confirmed' && (
                    <OrderConfirmedView
                        order={order}
                        loading={orderLoading}
                        error={orderError}
                        onBack={() => setStage('price')}
                        onStartOver={onStartOver}
                    />
                )}

                {debugOpen && (
                    <div className="ff-card">
                        <div className="ff-card-head">
                            <h2>
                                <Bug size={15} />
                                Raw API debug
                            </h2>
                            <div className="meta">
                                {Object.entries(debugPayloads).filter(([, v]) => !!v).length} call(s)
                            </div>
                        </div>
                        {Object.entries(debugPayloads).map(([key, val]) => (
                            <RawDebugBlock key={key} title={key} result={val} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const RawDebugBlock: React.FC<{ title: string; result: FlightApiResult | null }> = ({ title, result }) => {
    const [open, setOpen] = useState(false);
    if (!result) return null;
    const summary = result.networkError
        ? `network error`
        : `${result.status} ${result.statusText} · ${result.durationMs}ms`;
    return (
        <div style={{ borderBottom: '1px solid var(--ff-border)' }}>
            <button
                onClick={() => setOpen((v) => !v)}
                style={{
                    width: '100%',
                    background: 'var(--ff-surface-2)',
                    border: 0,
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    font: 'inherit',
                }}
            >
                <span style={{ fontWeight: 600 }}>{title}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        fontFamily: "'Geist Mono', ui-monospace, monospace",
                        fontSize: 11,
                        color: 'var(--ff-text-3)',
                    }}>{summary}</span>
                    {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>
            {open && (
                <div className="ff-debug-drawer">
                    <pre>{prettyResult(result)}</pre>
                </div>
            )}
        </div>
    );
};

function extractEnvelopeError(res: FlightApiResult): string | null {
    const d = res.data as any;
    if (!d || typeof d !== 'object') return null;
    // Quadlabs gateway envelope: { success: false, message: '...' } or
    // { success: true, data: { status: false, message/error: '...' } }
    if (d.success === false) {
        return d.message || d.error || 'Request failed.';
    }
    const inner = d.data && typeof d.data === 'object' ? d.data : null;
    if (inner && (inner.status === false || inner.success === false)) {
        return inner.message || inner.error || pickSupplierError(inner) || 'API returned an error.';
    }
    if (d.status === false) {
        return d.message || d.error || pickSupplierError(d) || 'API returned an error.';
    }
    return null;
}

function pickSupplierError(obj: any): string | null {
    const list = Array.isArray(obj?.supplierResponse) ? obj.supplierResponse : null;
    if (!list) return null;
    for (const s of list) {
        if (s && (s.status === false || s.success === false) && s.message) {
            return `${s.supplierCode || 'supplier'}: ${s.message}`;
        }
    }
    return null;
}

function prettyResult(r: FlightApiResult): string {
    const body = r.data
        ? JSON.stringify(r.data, null, 2)
        : r.responseText || r.networkError || '';
    return [
        `URL: ${r.url}`,
        `Status: ${r.status} ${r.statusText}`,
        `Time: ${r.durationMs}ms`,
        '',
        '── Request ──',
        JSON.stringify(r.requestBody, null, 2),
        '',
        '── Response ──',
        body,
    ].join('\n');
}

function buildInitialPax(search: ParsedSearch): PaxFormEntry[] {
    const out: PaxFormEntry[] = [];
    let idx = 1;
    for (let i = 0; i < search.paxCounts.ADT; i++) {
        out.push(blankPax(`PAX${idx++}`, 'ADT', i === 0 ? defaultAdult() : undefined));
    }
    for (let i = 0; i < search.paxCounts.CHD; i++) {
        out.push(blankPax(`PAX${idx++}`, 'CHD'));
    }
    for (let i = 0; i < search.paxCounts.INF; i++) {
        out.push(blankPax(`PAX${idx++}`, 'INF'));
    }
    if (out.length === 0) out.push(blankPax('PAX1', 'ADT', defaultAdult()));
    return out;
}

function defaultAdult(): Partial<PaxFormEntry> {
    return {
        title: 'Mr',
        givenName: 'Raj',
        middleName: 'Mohan',
        surname: 'Kumar',
        dob: '1999-10-30',
        gender: 'M',
        nationality: 'IN',
        docNumber: 'S2328976223',
        docExpiry: '2036-07-18',
        docIssuingCountry: 'IN',
    };
}

function blankPax(paxId: string, ptc: 'ADT' | 'CHD' | 'INF', seed?: Partial<PaxFormEntry>): PaxFormEntry {
    return {
        paxId,
        ptc,
        title: ptc === 'ADT' ? 'Mr' : 'Mstr',
        givenName: '',
        middleName: '',
        surname: '',
        dob: '',
        gender: 'M',
        nationality: 'IN',
        docType: 'P',
        docNumber: '',
        docExpiry: '',
        docIssuingCountry: 'IN',
        ...(seed || {}),
    };
}

function buildSearchContextSummary(search: ParsedSearch): Record<string, any> {
    const offers = search.offers || [];
    const prices = offers
        .map((o) => Number(o.totalAmount))
        .filter((n) => Number.isFinite(n));
    const sortedByPrice = [...offers].sort((a, b) => Number(a.totalAmount || 0) - Number(b.totalAmount || 0));
    const sortedByDuration = [...offers].sort((a, b) => totalDurationMinutes(a) - totalDurationMinutes(b));
    const carrierCounts = offers.reduce<Record<string, number>>((acc, offer) => {
        const code = offer.validatingCarrier || offer.legs[0]?.segments[0]?.airline || 'unknown';
        acc[code] = (acc[code] || 0) + 1;
        return acc;
    }, {});

    return {
        kind: 'flight_search_summary',
        source: 'frontend_flight_test_ui',
        generated_at: new Date().toISOString(),
        note: 'Compact summary only. Full flight results remain in the frontend UI and are not injected into LLM context.',
        search: {
            origin: search.origin,
            destination: search.destination,
            depart_date: search.departDate,
            return_date: search.returnDate || null,
            trip_type: search.tripType,
            pax: search.paxCounts,
            currency: search.currency || sortedByPrice[0]?.currency || null,
        },
        result_stats: {
            total_offers: offers.length,
            nonstop_offers: offers.filter((o) => o.legs.every((l) => l.stops === 0)).length,
            refundable_offers: offers.filter((o) => o.anyRefundable).length,
            carrier_counts: carrierCounts,
            price_min: prices.length ? Math.min(...prices) : null,
            price_max: prices.length ? Math.max(...prices) : null,
        },
        cheapest_offer_ids: sortedByPrice.slice(0, 5).map((o) => o.offerID),
        fastest_offer_ids: sortedByDuration.slice(0, 5).map((o) => o.offerID),
        representative_offers: sortedByPrice.slice(0, 5).map(compactOfferSummary),
    };
}

function compactOfferSummary(offer: ParsedOffer): Record<string, any> {
    return {
        offer_id: offer.offerID,
        carrier: offer.validatingCarrier,
        airline: offer.airlineName || offer.validatingCarrier,
        brand: offer.brandName || null,
        cabin: offer.cabinClass || null,
        refundable: Boolean(offer.anyRefundable || offer.refundable),
        fare_count: offer.fares.length,
        price: {
            amount: offer.totalAmount,
            currency: offer.currency,
        },
        total_duration_minutes: totalDurationMinutes(offer),
        legs: offer.legs.map((leg) => ({
            direction: leg.direction,
            from: leg.departureAirport,
            to: leg.arrivalAirport,
            depart_date: leg.departureDate,
            depart_time: leg.departureTime,
            arrive_date: leg.arrivalDate,
            arrive_time: leg.arrivalTime,
            stops: leg.stops,
            stop_airports: leg.stopAirports,
            duration_minutes: leg.durationMinutes || null,
        })),
    };
}

function totalDurationMinutes(offer: ParsedOffer): number {
    return offer.legs.reduce((sum, leg) => sum + Number(leg.durationMinutes || 0), 0);
}

function buildAirShoppingBody(searchRequest?: Record<string, any> | null): any {
    const body = JSON.parse(JSON.stringify(airShoppingSample));
    if (!searchRequest || typeof searchRequest !== 'object') return body;

    const origin = normalizeAirportCode(searchRequest.origin);
    const destination = normalizeAirportCode(searchRequest.destination);
    const departDate = normalizeDate(searchRequest.depart_date);
    const returnDate = normalizeDate(searchRequest.return_date);
    const tripType = String(searchRequest.trip_type || (returnDate ? 'RT' : 'OW')).toUpperCase();
    const cabinCode = cabinToAirShoppingCode(searchRequest.cabin);
    const adults = clampCount(searchRequest.pax?.adults ?? searchRequest.adults, 1);
    const children = clampCount(searchRequest.pax?.children ?? searchRequest.children, 0);
    const infants = clampCount(searchRequest.pax?.infants ?? searchRequest.infants, 0);
    const currency = typeof searchRequest.currency === 'string' ? searchRequest.currency.trim().toUpperCase() : '';
    const depCountry = normalizeCountryCode(searchRequest.dep_country_code);
    const arrCountry = normalizeCountryCode(searchRequest.arr_country_code);
    const carriers = Array.isArray(searchRequest.carriers)
        ? searchRequest.carriers.map(normalizeAirportCode).filter(Boolean)
        : [];

    const request = body.airShoppingRq?.request;
    const criteriaRoot = request?.flightRequest?.flightRequestOriginDestinationsCriteria;
    if (criteriaRoot && origin && destination && departDate) {
        const out: any = {
            originDestId: 'OD1',
            destArrivalCriteria: {
                locationCode: destination,
                ...(arrCountry ? { countryCode: arrCountry } : {}),
                locationType: 'A',
            },
            originDepCriteria: {
                locationCode: origin,
                ...(depCountry ? { countryCode: depCountry } : {}),
                locationType: 'A',
                date: departDate,
                time: '',
            },
        };
        const od = [out];
        if (tripType === 'RT' && returnDate) {
            od.push({
                originDestId: 'OD2',
                destArrivalCriteria: {
                    locationCode: origin,
                    ...(depCountry ? { countryCode: depCountry } : {}),
                    locationType: 'A',
                },
                originDepCriteria: {
                    locationCode: destination,
                    ...(arrCountry ? { countryCode: arrCountry } : {}),
                    locationType: 'A',
                    date: returnDate,
                    time: '',
                },
            });
        }
        criteriaRoot.originDestCriteria = od;
    }

    if (body.airShoppingRq) {
        body.airShoppingRq.journeyDir = tripType === 'RT' ? 'RT' : 'OW';
    }

    if (request?.paxList) {
        request.paxList.Adult = adults;
        request.paxList.Child = children;
        request.paxList.Infant = infants;
        request.paxList.Youth = 0;
        request.paxList.Senior = 0;
        request.paxList.pax = buildPaxRefs(adults, children, infants);
    }

    const flightRelatedCriteria = request?.flightRelatedCriteria;
    if (flightRelatedCriteria?.cabinCriteria?.[0] && cabinCode) {
        flightRelatedCriteria.cabinCriteria[0].cabinTypeCode = cabinCode;
    }
    if (carriers.length && flightRelatedCriteria) {
        flightRelatedCriteria.carrierCriteria = carriers.map((carrier) => ({
            carrier: { airlineDesigCode: carrier },
            prefLevel: { prefLevelCode: 'Preferred' },
        }));
    }
    if (currency && body.airShoppingRq?.header?.client) {
        body.airShoppingRq.header.client.customerRequestedCurrency = currency;
    }

    return body;
}

function buildPaxRefs(adults: number, children: number, infants: number): Array<{ paxId: string; ptc: string }> {
    const pax: Array<{ paxId: string; ptc: string }> = [];
    let idx = 1;
    for (let i = 0; i < adults; i++) pax.push({ paxId: `PAX${idx++}`, ptc: 'ADT' });
    for (let i = 0; i < children; i++) pax.push({ paxId: `PAX${idx++}`, ptc: 'CHD' });
    for (let i = 0; i < infants; i++) pax.push({ paxId: `PAX${idx++}`, ptc: 'INF' });
    return pax.length ? pax : [{ paxId: 'PAX1', ptc: 'ADT' }];
}

function clampCount(value: any, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.floor(parsed));
}

function normalizeAirportCode(value: any): string {
    return typeof value === 'string' ? value.trim().toUpperCase().slice(0, 3) : '';
}

function normalizeCountryCode(value: any): string {
    return typeof value === 'string' ? value.trim().toUpperCase().slice(0, 2) : '';
}

function normalizeDate(value: any): string {
    return typeof value === 'string' ? value.trim() : '';
}

function cabinToAirShoppingCode(value: any): string {
    const cabin = String(value || 'economy').trim().toLowerCase().replace(/-/g, '_');
    if (cabin === 'first') return '1';
    if (cabin === 'business') return '2';
    if (cabin === 'premium_economy' || cabin === 'premium economy') return '4';
    return '5';
}

function loadingHints(sample: any): {
    origin?: string;
    destination?: string;
    departDate?: string;
    returnDate?: string;
    paxTotal?: number;
} {
    try {
        const ods = sample?.airShoppingRq?.request?.flightRequest?.flightRequestOriginDestinationsCriteria?.originDestCriteria;
        const first = Array.isArray(ods) ? ods[0] : undefined;
        const last = Array.isArray(ods) && ods.length > 1 ? ods[ods.length - 1] : undefined;
        const pax = sample?.airShoppingRq?.request?.paxList;
        const paxTotal = ['Adult', 'Child', 'Infant', 'Youth', 'Senior']
            .reduce((sum, k) => sum + Number(pax?.[k] || 0), 0);
        return {
            origin: first?.originDepCriteria?.locationCode,
            destination: first?.destArrivalCriteria?.locationCode,
            departDate: first?.originDepCriteria?.date,
            returnDate: last && last !== first ? last?.originDepCriteria?.date : undefined,
            paxTotal: paxTotal || undefined,
        };
    } catch {
        return {};
    }
}

function buildOfferPriceBody(_offer: ParsedOffer, _fare: ParsedFare | null, messageId?: string): any {
    // Use the canned offer-price sample as a baseline; in production this
    // payload would be constructed from the live shopping response.
    const body = JSON.parse(JSON.stringify(offerPriceSample));
    applyMessageIdGuid(body?.offerPriceRQ, messageId);
    return body;
}

function buildFareRuleBody(
    offer: ParsedOffer,
    fare: ParsedFare | null,
    messageId?: string,
    offerPriceData?: any,
): any {
    // Header (and any sibling envelope fields) come from the canned sample.
    // When we have a fresh offer-price response, use its PricedOffer node
    // verbatim as the fareRuleRQ.request payload. Otherwise fall back to
    // constructing the request from the shopping offer.
    const body = JSON.parse(JSON.stringify(fareRuleSample));
    body.fareRuleRQ = body.fareRuleRQ || {};

    const pricedOffer = extractPricedOffer(offerPriceData);
    if (pricedOffer) {
        body.fareRuleRQ.request = Array.isArray(pricedOffer) ? pricedOffer : [pricedOffer];
    } else {
        const raw = offer.raw || {};
        let offerItem = raw.offerItem;
        if (fare && offerItem) {
            offerItem = {
                ...offerItem,
                fareDetail: [fare.rawFareDetail],
            };
        }
        body.fareRuleRQ.request = [
            {
                fareMatch: true,
                offerID: raw.offerID ?? offer.offerID,
                ownerId: raw.ownerId ?? offer.ownerId,
                ownerCode: raw.ownerCode ?? offer.ownerCode,
                validatingCarrierCode: raw.validatingCarrierCode ?? offer.validatingCarrier,
                offerItem,
            },
        ];
    }

    applyMessageIdGuid(body.fareRuleRQ, messageId);
    return body;
}

function extractPricedOffer(data: any): any {
    if (!data || typeof data !== 'object') return null;
    const candidates = [
        data?.offerPriceRS?.response?.PricedOffer,
        data?.offerPriceRS?.response?.pricedOffer,
        data?.data?.offerPriceRS?.response?.PricedOffer,
        data?.data?.offerPriceRS?.response?.pricedOffer,
        data?.data?.data?.offerPriceRS?.response?.PricedOffer,
    ];
    for (const c of candidates) {
        if (c && (typeof c === 'object' || Array.isArray(c))) return c;
    }
    return null;
}

function readPricedFareMatch(data: any): boolean | null {
    const po = extractPricedOffer(data);
    if (!po) return null;
    const node = Array.isArray(po) ? po[0] : po;
    if (node && typeof node.fareMatch === 'boolean') return node.fareMatch;
    return null;
}

function buildOrderCreateBody(
    _offer: ParsedOffer,
    _fare: ParsedFare | null,
    pax: PaxFormEntry[],
    contact: ContactForm,
    messageId?: string,
    offerPriceData?: any,
): any {
    // Same approach: start from sample, then patch in the live passenger
    // and contact data so the test exercises the user's input.
    const body = JSON.parse(JSON.stringify(orderCreateSample));
    try {
        const dataLists = body?.orderCreateRQ?.request?.dataLists;
        if (dataLists?.paxList?.pax) {
            dataLists.paxList.pax = pax.map((p, i) => ({
                paxId: p.paxId,
                ptc: p.ptc,
                individual: {
                    titleName: p.title,
                    givenName: p.givenName,
                    middleName: p.middleName || undefined,
                    surName: p.surname,
                    birthDate: p.dob,
                    genderCode: p.gender,
                },
                identityDoc: [
                    {
                        identityDocType: p.docType,
                        identityDocNumber: p.docNumber,
                        expiryDate: p.docExpiry,
                        issuingCountryCode: p.docIssuingCountry,
                    },
                ],
                contactInfoRefID: i === 0 ? 'C1' : undefined,
            }));
        }
        if (dataLists?.contactInfoList?.contactInfo?.[0]) {
            const c0 = dataLists.contactInfoList.contactInfo[0];
            if (c0.emailAddress) c0.emailAddress.emailAddressText = contact.email;
            if (Array.isArray(c0.phone) && c0.phone[0]) {
                c0.phone[0].countryDialingCode = contact.countryCode;
                c0.phone[0].phoneNumber = contact.mobile;
            }
        }

        // Replace the canned selectedPricedOffer with the PricedOffer returned
        // by the live offer-price call (offer-price runs on the checkout page,
        // so its response is the freshest priced quote for this booking).
        const pricedOffer = extractPricedOffer(offerPriceData);
        const createOrder = body?.orderCreateRQ?.request?.createOrder;
        if (pricedOffer && createOrder) {
            createOrder.acceptSelectedQuotedOfferList =
                createOrder.acceptSelectedQuotedOfferList || {};
            createOrder.acceptSelectedQuotedOfferList.selectedPricedOffer =
                Array.isArray(pricedOffer) ? pricedOffer : [pricedOffer];
        }
    } catch {
        // fall through – send the canned payload if patching fails
    }
    applyMessageIdGuid(body?.orderCreateRQ, messageId);
    return body;
}

function applyMessageIdGuid(envelope: any, messageId?: string): void {
    if (!envelope || typeof envelope !== 'object' || !messageId) return;
    envelope.header = envelope.header || {};
    envelope.header.GUID = messageId;
}

function extractMessageId(raw: any): string | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const candidates = [
        raw?.messageId,
        raw?.data?.messageId,
        raw?.data?.data?.messageId,
        raw?.result?.messageId,
        raw?.payload?.messageId,
        raw?.airShoppingRS?.messageId,
        raw?.data?.airShoppingRS?.messageId,
        raw?.airShoppingRS?.response?.messageId,
        raw?.data?.airShoppingRS?.response?.messageId,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return undefined;
}

export default FlightTestPage;
