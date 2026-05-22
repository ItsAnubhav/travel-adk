import {
    FareRulePaxType,
    ParsedFare,
    ParsedFareRule,
    ParsedFareRuleAISummary,
    ParsedFareRuleChargeBlock,
    ParsedFareRulePaxCharges,
    ParsedFareRuleRoute,
    ParsedFareRuleSegment,
    ParsedLeg,
    ParsedOffer,
    ParsedOrder,
    ParsedPaxBreakdown,
    ParsedSearch,
    ParsedSegment,
    TripType,
} from './types';

const toNum = (v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return isFinite(n) ? n : 0;
};

const arr = <T>(v: any): T[] => (Array.isArray(v) ? v : v ? [v] : []);

const pickString = (v: any): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

/**
 * Strip wire-level envelopes from the API response so the rest of the parsers
 * always see the Xchange-shaped object. Handles:
 *   { success: true, data: { ... } }       (Quadlabs gateway wrapper)
 *   { result: { ... } } / { payload: ... } (defensive fallbacks)
 *   raw Xchange object                      (already unwrapped)
 */
function unwrapEnvelope(data: any): any {
    if (!data || typeof data !== 'object') return data;
    if ('data' in data && data.data && typeof data.data === 'object') {
        const inner = data.data;
        // Only treat .data as the envelope payload when it looks like the
        // Xchange response (has status / supplierResponse / *RS keys), not
        // when data is just a plain field name inside Xchange itself.
        if (
            'status' in inner ||
            'supplierResponse' in inner ||
            'airShoppingRS' in inner ||
            'offerPriceRS' in inner ||
            'fareRuleRS' in inner ||
            'orderViewRS' in inner ||
            'orderCreateRS' in inner
        ) {
            return inner;
        }
    }
    if ('result' in data && data.result && typeof data.result === 'object') {
        return unwrapEnvelope(data.result);
    }
    if ('payload' in data && data.payload && typeof data.payload === 'object') {
        return unwrapEnvelope(data.payload);
    }
    return data;
}

export function parseAirShopping(data: any): ParsedSearch {
    const env = unwrapEnvelope(data);
    const rs = env?.airShoppingRS?.response || env?.airShoppingRS || env;
    const metadata = rs?.metadata || {};
    const messageId =
        pickString(env?.messageId) ||
        pickString(env?.airShoppingRS?.messageId) ||
        pickString(rs?.messageId) ||
        pickString((data as any)?.messageId) ||
        pickString((data as any)?.data?.messageId);
    const carrierOffers = arr<any>(rs?.offersGroup?.carrierOffers);
    const paxList = arr<any>(rs?.dataLists?.paxList?.pax);
    const segmentLookup = buildSegmentLookup(rs);

    const offers: ParsedOffer[] = [];
    for (const co of carrierOffers) {
        for (const offer of arr<any>(co?.offer)) {
            const parsed = parseSingleOffer(offer, segmentLookup, metadata);
            if (parsed) offers.push(parsed);
        }
    }

    const paxCounts = { ADT: 0, CHD: 0, INF: 0, total: 0 };
    for (const p of paxList) {
        const ptc = String(p?.ptc || '').toUpperCase();
        if (ptc === 'ADT') paxCounts.ADT++;
        else if (ptc === 'CHD') paxCounts.CHD++;
        else if (ptc === 'INF') paxCounts.INF++;
        paxCounts.total++;
    }

    const currency =
        offers[0]?.currency ||
        metadata?.currencies?.AED?.code ||
        'AED';

    const firstOffer = offers[0];
    const firstLeg = firstOffer?.legs?.[0];
    const tripType: TripType = firstOffer?.tripType || 'OW';
    // For round-trip, the return-leg departure date is the "returnDate".
    // For multi-city or one-way, there is no single return date.
    const returnLeg = tripType === 'RT' && firstOffer ? firstOffer.legs[1] : undefined;

    return {
        offers,
        metadata,
        paxCounts,
        currency,
        tripType,
        origin: firstLeg?.departureAirport,
        destination: firstLeg?.arrivalAirport,
        departDate: firstLeg?.departureDate,
        returnDate: returnLeg?.departureDate,
        messageId,
    };
}

function buildSegmentLookup(rs: any): Map<string, ParsedSegment[]> {
    const lookup = new Map<string, ParsedSegment[]>();
    // shopping responses embed a segmentList inside each offer; we keep a fallback
    // global lookup too if a top-level dataLists.segmentList exists.
    const topSegments = arr<any>(rs?.dataLists?.segmentList?.segments);
    for (const s of topSegments) {
        const segments: ParsedSegment[] = arr<any>(s?.segmentInfo).map(toParsedSegment);
        for (const seg of segments) {
            const list = lookup.get(seg.segmentID) || [];
            list.push(seg);
            lookup.set(seg.segmentID, list);
        }
    }
    return lookup;
}

function toParsedSegment(s: any): ParsedSegment {
    const airline =
        s?.airline ||
        s?.marketingAirline ||
        s?.operatingAirline ||
        s?.marketingCarrier?.airlineID ||
        s?.marketingCarrier?.airlineDesigCode ||
        s?.operatingCarrier?.airlineID ||
        s?.operatingCarrier?.airlineDesigCode ||
        s?.marketingCarrierCode ||
        s?.carrierCode ||
        s?.airlineCode ||
        '';
    const flightNumberRaw =
        s?.flightNumber ??
        s?.marketingFlightNumber ??
        s?.marketingCarrier?.flightNumber ??
        s?.operatingFlightNumber ??
        s?.operatingCarrier?.flightNumber ??
        s?.flightNo ??
        s?.flightNum ??
        '';
    return {
        segmentID: s?.segmentID,
        sellKey: s?.segmentSellKey,
        airline,
        flightNumber: String(flightNumberRaw ?? ''),
        aircraft: s?.airCraftType,
        departureAirport: s?.departureAirport,
        departureTerminal: s?.departureTerminal,
        arrivalAirport: s?.arrivalAirport,
        arrivalTerminal: s?.arrivalTerminal,
        departureDate: s?.departureDate,
        departureTime: s?.departureTime,
        arrivalDate: s?.arrivalDate,
        arrivalTime: s?.arrivalTime,
        durationMinutes: durationToMinutes(s?.duration),
    };
}

function durationToMinutes(d: any): number | undefined {
    if (d === undefined || d === null || d === '') return undefined;
    const s = String(d);
    if (/^\d{3,4}$/.test(s)) {
        const padded = s.padStart(4, '0');
        return Number(padded.slice(0, 2)) * 60 + Number(padded.slice(2));
    }
    const m = s.match(/(\d+)\s*h\s*(\d+)?/i);
    if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
    const n = Number(s);
    return isFinite(n) ? n : undefined;
}

function parseFareDetail(fareDetail: any, fareIndex: number): ParsedFare {
    const price = fareDetail?.fareComponent?.price || {};
    const rbd = arr<string>(fareDetail?.fareComponent?.rbd);
    const paxTypeBlocks = arr<any>(fareDetail?.fareComponent?.paxType);
    const fareBasis = Array.from(
        new Set(paxTypeBlocks.flatMap((p: any) => arr<string>(p?.fareBasisCode))),
    );
    const paxBreakdown: ParsedPaxBreakdown[] = paxTypeBlocks.map((p: any) => {
        const baseAmount = toNum(p?.baseAmount);
        const tax = toNum(p?.tax);
        const tfee = pickPaxAutoCharge(fareDetail, p?.type, 'TFEE');
        const aohc = pickPaxAutoCharge(fareDetail, p?.type, 'AOHC');
        const vat = pickPaxVat(fareDetail, p?.type);
        const subtotal = baseAmount + tax + tfee + aohc + vat;
        return {
            type: p?.type,
            baseAmount,
            tax,
            fareBasis: arr<string>(p?.fareBasisCode),
            taxSummary: arr<any>(p?.taxSummary?.tax).map((t: any) => ({
                code: t?.taxCode,
                name: t?.taxName,
                amount: toNum(t?.amount),
            })),
            transactionFee: tfee,
            autoChargeAdditional: aohc,
            vat,
            subtotal,
        };
    });
    return {
        fareIndex,
        offerItemID: fareDetail?.offerItemID,
        brandId: fareDetail?.brandId,
        brandName: fareDetail?.brandName,
        fareType: fareDetail?.fareType,
        cabinClass: fareDetail?.cabinClass,
        refundable: String(fareDetail?.fareComponent?.refundable || '').toLowerCase() === 'true',
        totalAmount: toNum(price?.totalAmount),
        totalTaxAmount: toNum(price?.totalTaxAmount),
        currency: price?.currencyCode || 'AED',
        rbd,
        fareBasis,
        paxBreakdown,
        rawFareDetail: fareDetail,
    };
}

function parseSingleOffer(
    offer: any,
    _segLookup: Map<string, ParsedSegment[]>,
    _metadata: any,
): ParsedOffer | null {
    const fareDetailList = arr<any>(offer?.offerItem?.fareDetail);
    if (!fareDetailList.length) return null;
    const fares: ParsedFare[] = fareDetailList.map((fd, i) => parseFareDetail(fd, i));
    if (!fares.length) return null;

    // Use the cheapest fare to represent the offer in the results list.
    const primary = fares.reduce(
        (best, f) => (f.totalAmount > 0 && f.totalAmount < best.totalAmount ? f : best),
        fares[0],
    );
    const anyRefundable = fares.some((f) => f.refundable);

    const { legs, tripType } = parseLegsFromOffer(offer);
    const firstSegment = legs[0]?.segments[0];

    return {
        offerID: offer?.offerID,
        ownerId: offer?.ownerId,
        ownerCode: offer?.ownerCode,
        validatingCarrier: offer?.validatingCarrierCode || firstSegment?.airline || '',
        airlineName: '',
        cabinClass: primary.cabinClass,
        brandName: primary.brandName,
        fareType: primary.fareType,
        refundable: primary.refundable,
        anyRefundable,
        totalAmount: primary.totalAmount,
        totalTaxAmount: primary.totalTaxAmount,
        currency: primary.currency,
        rbd: primary.rbd,
        fareBasis: primary.fareBasis,
        paxBreakdown: primary.paxBreakdown,
        legs,
        tripType,
        fares,
        raw: offer,
    };
}

function pickPaxAutoCharge(fareDetail: any, paxType: string, code: string): number {
    const charges = arr<any>(fareDetail?.fareComponent?.autoCharges?.charge);
    for (const c of charges) {
        if (c?.code === code) {
            const key = paxType?.toLowerCase();
            if (key && c?.[key]?.gross !== undefined) return toNum(c[key].gross);
            if (key && c?.[key]?.b2bNet !== undefined) return toNum(c[key].b2bNet);
        }
    }
    return 0;
}

function pickPaxVat(fareDetail: any, paxType: string): number {
    const pax = arr<any>(fareDetail?.fareComponent?.taxCharges?.pax).find(
        (p: any) => p?.type === paxType,
    );
    return toNum(pax?.gross);
}

// Each entry inside offer.segmentList.segments[] is a leg (a "bound"). Its
// segmentInfo[] holds the flight segments that make up that leg (so a leg
// with one connection has two segmentInfos). Trust this structure instead
// of flattening and re-grouping by airport matching, which mis-grouped
// round-trip flights (return-leg origin == outbound-leg destination).
function parseLegsFromOffer(offer: any): { legs: ParsedLeg[]; tripType: TripType } {
    const blocks = arr<any>(offer?.segmentList?.segments);
    const legSegmentLists: ParsedSegment[][] = blocks
        .map((b) => arr<any>(b?.segmentInfo).map(toParsedSegment))
        .filter((segs) => segs.length > 0);

    const tripType = determineTripType(legSegmentLists);

    const legs = legSegmentLists.map((segs, i) => buildLeg(segs, i, tripType));
    return { legs, tripType };
}

function determineTripType(legSegmentLists: ParsedSegment[][]): TripType {
    if (legSegmentLists.length === 1) return 'OW';
    if (legSegmentLists.length === 2) {
        const firstLegLast = legSegmentLists[0][legSegmentLists[0].length - 1];
        const secondLegFirst = legSegmentLists[1][0];
        if (
            firstLegLast?.arrivalAirport &&
            secondLegFirst?.departureAirport &&
            firstLegLast.arrivalAirport === secondLegFirst.departureAirport
        ) {
            return 'RT';
        }
    }
    return 'MC';
}

function buildLeg(segs: ParsedSegment[], idx: number, tripType: TripType): ParsedLeg {
    const first = segs[0];
    const last = segs[segs.length - 1];
    const durationMinutes = segs.reduce(
        (s, x) => s + (x.durationMinutes || 0),
        0,
    );
    let direction: ParsedLeg['direction'];
    if (tripType === 'OW') direction = 'DEP';
    else if (tripType === 'RT') direction = idx === 0 ? 'OUT' : 'RET';
    else direction = 'MC';
    return {
        direction,
        legIndex: idx,
        departureAirport: first.departureAirport,
        arrivalAirport: last.arrivalAirport,
        departureDate: first.departureDate,
        departureTime: first.departureTime,
        arrivalDate: last.arrivalDate,
        arrivalTime: last.arrivalTime,
        durationMinutes,
        stops: Math.max(segs.length - 1, 0),
        stopAirports: segs.slice(0, -1).map((s) => s.arrivalAirport),
        segments: segs,
    };
}

export function parseOfferPrice(data: any): ParsedOffer | null {
    const env = unwrapEnvelope(data);
    const rs = env?.offerPriceRS?.response || env?.offerPriceRS || env;
    const carrierOffers = arr<any>(rs?.offersGroup?.carrierOffers);
    for (const co of carrierOffers) {
        for (const offer of arr<any>(co?.offer)) {
            const parsed = parseSingleOffer(offer, new Map(), rs?.metadata || {});
            if (parsed) return parsed;
        }
    }
    return null;
}

export function parseFareRule(data: any): ParsedFareRule | null {
    const env = unwrapEnvelope(data);
    const rs = env?.fareRuleRS?.response || env?.fareRuleRS || env;
    const reqs = arr<any>(rs?.request) || arr<any>(rs?.response?.request);

    // New-style response: airline rule text by route + structured cancellation
    // reply per pax type. If either is present, parse them; the legacy fields
    // below still run so existing offers keep working when the airline returns
    // the old shape.
    const ruleInfo = arr<any>(rs?.ruleInfo);
    const cancellationReply = arr<any>(rs?.cancellationReply);
    // fareRuleSummary is a sibling of fareRuleRS on the envelope (added by
    // the backend when aiSummary=true is passed in the URL). Tolerate it
    // also living one level deeper for safety.
    const summary: ParsedFareRuleAISummary | undefined =
        (env?.fareRuleSummary as ParsedFareRuleAISummary | undefined) ||
        (rs?.fareRuleSummary as ParsedFareRuleAISummary | undefined) ||
        undefined;
    const routes: ParsedFareRuleRoute[] = ruleInfo.map((ri: any) => ({
        title: String(ri?.title || '').trim() || 'Fare rules',
        sections: arr<any>(ri?.description)
            .map((d: any) => ({
                title: String(d?.title || '').trim(),
                value: String(d?.value || '').trim(),
            }))
            .filter((s: any) => s.title && s.value),
    }));
    const chargeBlocks: ParsedFareRuleChargeBlock[] = cancellationReply.map(parseCancellationReply);

    let saleCurrency = 'INR';
    const sectors: ParsedFareRuleSegment[] = [];
    let airlineCharges: ParsedFareRule['airlineCharges'];
    let refundMax: { amount: number; currency: string } | undefined;
    let changePenaltySum = 0;
    let changePenaltyEntries = 0;
    let noShowMax: { amount: number; currency: string } | undefined;

    const sources = reqs.length ? reqs : [rs];
    for (const offer of sources) {
        const fd = arr<any>(offer?.offerItem?.fareDetail)[0];
        const cancelInfo = arr<any>(fd?.cancellationServiceFees?.cancellationServiceFee || fd?.cancellationCharges);
        const reissueInfo = arr<any>(fd?.reIssuanceCharges?.reIssuanceCharge || fd?.reIssuanceCharges);

        // Try to gather sale currency
        saleCurrency =
            fd?.fareComponent?.price?.currencyCode ||
            offer?.currencyCode ||
            saleCurrency;

        // Cancel / change rules at segment level
        const segLevel = arr<any>(fd?.fareRules?.fareRule) || arr<any>(fd?.fareRulesBySegment);
        for (const r of segLevel) {
            const sector: ParsedFareRuleSegment = {
                segment: r?.segment || `${r?.origin || '?'}-${r?.destination || '?'}`,
                fareBasis: r?.fareBasis || r?.fareBasisCode,
                rbd: r?.rbd,
                direction: r?.direction,
                rules: [],
            };
            const rb = (label: string, val: any, tone?: 'zero' | 'warn' | 'normal') => {
                if (val === undefined || val === null) return;
                const amt = toNum(val);
                sector.rules.push({
                    label,
                    value: amt > 0 ? `${saleCurrency} ${amt.toLocaleString()}` : `${saleCurrency} 0`,
                    tone: amt === 0 ? 'zero' : tone,
                });
            };
            rb('Refund · before departure', r?.refundBeforeDep ?? r?.refund?.beforeDep);
            rb('Refund · after departure', r?.refundAfterDep ?? r?.refund?.afterDep, 'warn');
            rb('Change / Reissue', r?.change ?? r?.reissue);
            rb('No-show · before departure', r?.noShowBefore ?? r?.noShow?.before);
            rb('No-show · per-ticket max', r?.noShowMax ?? r?.noShow?.max, 'warn');
            sectors.push(sector);

            const refund = toNum(r?.refundAfterDep ?? r?.refund?.afterDep);
            if (refund && (!refundMax || refund > refundMax.amount)) {
                refundMax = { amount: refund, currency: saleCurrency };
            }
            const change = toNum(r?.change ?? r?.reissue);
            changePenaltySum += change;
            changePenaltyEntries++;
            const nsMax = toNum(r?.noShowMax ?? r?.noShow?.max);
            if (nsMax && (!noShowMax || nsMax > noShowMax.amount)) {
                noShowMax = { amount: nsMax, currency: saleCurrency };
            }
        }

        if (cancelInfo.length || reissueInfo.length) {
            airlineCharges = [];
            for (const c of cancelInfo) {
                const v = toNum(c?.amount ?? c?.value);
                airlineCharges.push({
                    label: `Cancellation${c?.paxType ? ` · ${c.paxType}` : ''}`,
                    value: `${v.toFixed(2)}`,
                    tone: v === 0 ? 'zero' : 'warn',
                });
            }
            for (const c of reissueInfo) {
                const v = toNum(c?.amount ?? c?.value);
                airlineCharges.push({
                    label: `Reissue${c?.paxType ? ` · ${c.paxType}` : ''}`,
                    value: `${v.toFixed(2)}`,
                    tone: v === 0 ? 'zero' : 'warn',
                });
            }
        }
    }

    const tags: ParsedFareRule['tags'] = [];
    if (refundMax) tags.push({ label: 'Refundable', tone: 'good' });
    const changeAvg = changePenaltyEntries ? changePenaltySum / changePenaltyEntries : 0;
    if (changePenaltySum === 0 && changePenaltyEntries > 0) tags.push({ label: 'Changeable · free', tone: 'good' });
    else if (changeAvg > 0) tags.push({ label: 'Change · penalty applies', tone: 'warn' });
    if (noShowMax) tags.push({ label: 'No-show: penalty applies', tone: 'warn' });

    // If the new-style response gave us structured pax charges, derive headline
    // numbers from the ADT row of the first charge block (sample uses ADT for
    // every per-pax cell). This lets the TL;DR cards reflect live values even
    // when the legacy per-segment fields above were empty.
    const adt = chargeBlocks[0]?.pax.find((p) => p.paxType === 'ADT');
    if (adt) {
        const cancel = adt.cancellation || adt.afterDeparture || adt.beforeDeparture;
        if (cancel > 0) refundMax = { amount: cancel, currency: saleCurrency };
        const chg = adt.voluntaryChange || adt.involuntaryChange || adt.reissue;
        if (chg > 0) {
            changePenaltySum = chg;
            changePenaltyEntries = 1;
        } else if (changePenaltyEntries === 0) {
            // No-data still beats nothing — mark as FREE if explicitly 0.
            changePenaltySum = 0;
            changePenaltyEntries = 1;
        }
        if (adt.noShow > 0) noShowMax = { amount: adt.noShow, currency: saleCurrency };
    }

    return {
        headline: {
            refundMax,
            changePenalty: changePenaltySum === 0 && changePenaltyEntries > 0 ? 'FREE' : { amount: changeAvg, currency: saleCurrency },
            noShow: noShowMax,
            revalidation: 'NA',
        },
        tags,
        sectors,
        airlineCharges,
        routes: routes.length ? routes : undefined,
        chargeBlocks: chargeBlocks.length ? chargeBlocks : undefined,
        summary,
        saleCurrency,
        raw: rs,
    };
}

function parseCancellationReply(c: any): ParsedFareRuleChargeBlock {
    const x = c?.xHostCharges || {};
    const al = c?.airlineCharges || {};
    const types: FareRulePaxType[] = ['ADT', 'YTH', 'CHD', 'INF'];
    const pfx: Record<FareRulePaxType, string> = { ADT: 'adt', YTH: 'yth', CHD: 'chd', INF: 'inf' };
    const pax: ParsedFareRulePaxCharges[] = types.map((p) => ({
        paxType: p,
        beforeDeparture: toNum(x[`${pfx[p]}BeforeDepartureChargeAmount`]),
        afterDeparture: toNum(x[`${pfx[p]}AfterDepartureChargeAmount`]),
        voluntaryChange: toNum(x[`${pfx[p]}VoluntaryChangeChargeAmount`]),
        involuntaryChange: toNum(x[`${pfx[p]}InvoluntaryChangeChargeAmount`]),
        cancellation: toNum(x[`${pfx[p]}CanxCharge`]),
        reissue: toNum(x[`${pfx[p]}ReIssueCharge`]),
        rerouting: toNum(x[`${pfx[p]}ReroutingChargeAmount`]),
        noShow: toNum(x[`${pfx[p]}NoShowChargesChargeAmount`]),
        airlineCharge: toNum(al[`${pfx[p]}Charge`]),
    }));
    return {
        airline: pickString(c?.airline),
        fareType: pickString(c?.fareType),
        fareBasisCode: pickString(c?.fareBasisCode),
        bookingClass: pickString(c?.bookingClass),
        refundType: pickString(c?.refundType),
        canxRemarks: pickString(c?.canxRemarks),
        pax,
    };
}

const ORDER_STATUS_LABELS: Record<string, string> = {
    HK: 'Confirmed',
    KK: 'Confirmed',
    TK: 'Ticketed',
    HL: 'Waitlisted',
    UC: 'Unconfirmed',
    HX: 'Cancelled',
    XX: 'Cancelled',
    NO: 'Not booked',
};

export function parseOrderView(data: any): ParsedOrder | null {
    const env = unwrapEnvelope(data);
    const header = env?.orderViewRS?.Header || env?.orderViewRS?.header || env?.Header || env?.header;
    const rs =
        env?.orderViewRS?.response ||
        env?.orderViewRS ||
        env?.orderCreateRS?.response ||
        env?.orderCreateRS ||
        env;
    if (!rs) return null;

    // orderViewRS.response.order is an array (one entry per booked order).
    // Older responses used a single object; tolerate both.
    const orderList = arr<any>(rs?.order || rs?.response?.order);
    const order = orderList[0] || (rs?.order && typeof rs.order === 'object' ? rs.order : rs);

    const pnr =
        pickString(order?.bookingReference) ||
        pickString(order?.pnr) ||
        pickString(order?.orderID) ||
        pickString(order?.orderId) ||
        '—';
    const statusCode = pickString(order?.statusCode) || pickString(order?.status) || 'OK';
    const statusLabel =
        pickString(order?.statusText) ||
        pickString(order?.statusLabel) ||
        ORDER_STATUS_LABELS[statusCode.toUpperCase()] ||
        'Confirmed';

    // Segments live inside the order's orderItems[].segmentList.segments[].segmentInfo[].
    // Fall back to order.segmentList (legacy) and de-dupe by segmentID so connecting
    // legs that appear on multiple orderItems aren't shown twice.
    const orderItems = arr<any>(order?.orderItems);
    const segmentBlocks = orderItems.length
        ? orderItems.flatMap((oi: any) => arr<any>(oi?.segmentList?.segments))
        : arr<any>(order?.segmentList?.segments);
    const segmentsRaw = segmentBlocks.flatMap((b: any) =>
        arr<any>(b?.segmentInfo).map(toParsedSegment),
    );
    const seenSegments = new Set<string>();
    const segments: ParsedSegment[] = [];
    for (const s of segmentsRaw) {
        const key = s.segmentID || `${s.airline}-${s.flightNumber}-${s.departureDate}-${s.departureTime}`;
        if (seenSegments.has(key)) continue;
        seenSegments.add(key);
        segments.push(s);
    }

    const passengers = arr<any>(rs?.dataLists?.paxList?.pax || order?.passengers).map((p: any) => {
        // identityDoc is now an array in the new orderViewRS shape; tolerate
        // the legacy single-object form too.
        const idDoc = Array.isArray(p?.identityDoc) ? p.identityDoc[0] : p?.identityDoc;
        return {
            paxId: p?.paxId || p?.id,
            ptc: p?.ptc || p?.type || 'ADT',
            title: p?.title || p?.individual?.titleName,
            givenName: p?.givenName || p?.individual?.givenName,
            surname: p?.surname || p?.individual?.surName,
            middleName: p?.middleName || p?.individual?.middleName,
            dob: p?.dob || p?.birthDate || p?.individual?.birthDate,
            gender: p?.gender || p?.individual?.genderCode,
            nationality: p?.nationality,
            passportNumber: p?.docNumber || idDoc?.identityDocNumber,
            passportExpiry: p?.docExpiry || idDoc?.expiryDate,
            passportIssuingCountry: p?.docIssuingCountry || idDoc?.issuingCountryCode,
        };
    });

    // Prefer the primary contact (C1). Fall back to whatever sits in index 0.
    const contactList = arr<any>(rs?.dataLists?.contactInfoList?.contactInfo);
    const primaryContact =
        contactList.find((c: any) => c?.contactInfoID === 'C1') || contactList[0] || {};

    // serviceDefinitionList lives on dataLists in the new shape; the older
    // shape put services on order.services/serviceList. Map both.
    const serviceDefs = arr<any>(rs?.dataLists?.serviceDefinitionList?.serviceDefinition);
    const legacyServices = arr<any>(order?.services?.service || order?.serviceList?.service);
    const services = [
        ...serviceDefs.map((s: any) => ({
            name: pickString(s?.name) || pickString(s?.descText) || 'Service',
            sub: pickString(s?.serviceCode) || pickString(s?.code) || pickString(s?.serviceDefinitionID),
            pax: pickString(s?.paxRefID) || pickString(s?.pax),
            price: s?.price
                ? {
                    amount: toNum(s.price.amount ?? s.price.totalAmount),
                    currency: s.price.currencyCode || 'AED',
                }
                : undefined,
        })),
        ...legacyServices.map((s: any) => ({
            name: pickString(s?.name) || pickString(s?.descText) || 'Service',
            sub: pickString(s?.code) || pickString(s?.serviceCode),
            pax: pickString(s?.paxRefID) || pickString(s?.pax),
            price: s?.price
                ? { amount: toNum(s.price.totalAmount), currency: s.price.currencyCode || 'AED' }
                : undefined,
        })),
    ];

    const headerCurrency =
        pickString(header?.client?.customerRequestedCurrency) ||
        pickString(header?.Client?.customerRequestedCurrency);

    // The order-create response doesn't carry an explicit total in
    // order.total / order.price — derive it from the fareDetail price block
    // on the first orderItem. The single price.totalAmount is the all-pax
    // grand total in the source response (verified against ADT+CHD sub-totals).
    const firstFareDetail = arr<any>(orderItems[0]?.orderItem?.fareDetail)[0];
    const firstPrice = firstFareDetail?.fareComponent?.price;
    const totalRaw = order?.total || order?.price || firstPrice || {};
    const total = {
        amount: toNum(
            totalRaw?.totalAmount ??
                totalRaw?.amount ??
                totalRaw?.gross ??
                firstPrice?.totalAmount,
        ),
        currency:
            pickString(totalRaw?.currencyCode) ||
            pickString(firstPrice?.currencyCode) ||
            headerCurrency ||
            'AED',
    };

    const carrier =
        pickString(order?.validatingCarrierCode) ||
        pickString(order?.ownerCode) ||
        segments[0]?.airline ||
        '';

    return {
        pnr,
        status: statusCode,
        statusLabel,
        carrier,
        carrierName: pickString(order?.ownerName),
        passengers,
        segments,
        services,
        contact: {
            email: pickString(primaryContact?.emailAddress?.emailAddressText),
            phone: pickString(arr<any>(primaryContact?.phone)[0]?.phoneNumber),
            phoneCountryCode: pickString(arr<any>(primaryContact?.phone)[0]?.countryDialingCode),
        },
        total,
        raw: rs,
    };
}

// ─────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayLabel(isoDate?: string): string {
    if (!isoDate) return '';
    const d = new Date(`${isoDate}T00:00:00`);
    if (isNaN(d.getTime())) return isoDate;
    return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

export function shortDate(isoDate?: string): string {
    if (!isoDate) return '';
    const d = new Date(`${isoDate}T00:00:00`);
    if (isNaN(d.getTime())) return isoDate;
    return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

export function shortDateLong(isoDate?: string): string {
    if (!isoDate) return '';
    const d = new Date(`${isoDate}T00:00:00`);
    if (isNaN(d.getTime())) return isoDate;
    return `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

export function formatTime(t?: string): string {
    if (!t) return '';
    if (/^\d{2}:\d{2}/.test(t)) return t.slice(0, 5);
    return t;
}

export function durationLabel(mins?: number): string {
    if (!mins || mins <= 0) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
}

export function dayOffset(depDate?: string, arrDate?: string): number {
    if (!depDate || !arrDate) return 0;
    const d1 = new Date(`${depDate}T00:00:00`);
    const d2 = new Date(`${arrDate}T00:00:00`);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.round((d2.getTime() - d1.getTime()) / (24 * 3600 * 1000));
}

export function splitMoney(n: number): { intPart: string; dec: string } {
    const fixed = Number(n).toFixed(2);
    const [i, d] = fixed.split('.');
    return { intPart: Number(i).toLocaleString(), dec: `.${d}` };
}

export function airportName(metadata: any, code?: string): string | undefined {
    if (!code) return undefined;
    return metadata?.airport?.[code]?.name;
}

export function airportCity(metadata: any, code?: string): string | undefined {
    if (!code) return undefined;
    return metadata?.airport?.[code]?.cityName;
}

export function airlineName(metadata: any, code?: string): string | undefined {
    if (!code) return undefined;
    return metadata?.airline?.[code]?.name;
}
