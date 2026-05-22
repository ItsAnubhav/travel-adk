import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { FlightApiResult, FlightEndpointKey } from '../../services/flightTestApi';

interface ResponseSummaryProps {
    endpointKey: FlightEndpointKey;
    result: FlightApiResult;
}

const Row: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
    <div className="flex items-baseline gap-2 text-xs">
        <span className="text-slate-500 min-w-[110px]">{label}</span>
        <span className={'text-slate-200 ' + (mono ? 'font-mono' : '')}>{value}</span>
    </div>
);

const ResponseSummary: React.FC<ResponseSummaryProps> = ({ endpointKey, result }) => {
    if (!result.data || typeof result.data !== 'object') return null;
    const summary = buildSummary(endpointKey, result.data);
    if (!summary) return null;

    return (
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/30 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 mb-1">
                {summary.status === 'success' ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                    <AlertTriangle size={14} className="text-amber-400" />
                )}
                <div className="text-xs font-semibold text-slate-200">{summary.title}</div>
            </div>
            {summary.rows.map((r, i) => (
                <Row key={i} label={r.label} value={r.value} mono={r.mono} />
            ))}
        </div>
    );
};

interface SummaryBlock {
    title: string;
    status: 'success' | 'warning';
    rows: Array<{ label: string; value: React.ReactNode; mono?: boolean }>;
}

function buildSummary(endpointKey: FlightEndpointKey, data: any): SummaryBlock | null {
    const ok = data?.status === true || data?.status === 'true';
    const status: 'success' | 'warning' = ok ? 'success' : 'warning';
    switch (endpointKey) {
        case 'airShopping': {
            const offers = collectOffers(data?.airShoppingRS);
            const first = offers[0];
            return {
                title: 'Air Shopping result',
                status,
                rows: [
                    { label: 'Status', value: String(data?.status ?? '—'), mono: true },
                    { label: 'Offers', value: String(offers.length), mono: true },
                    {
                        label: 'Suppliers',
                        value: summarizeSuppliers(data?.supplierResponse),
                    },
                    ...(first
                        ? [
                            {
                                label: 'First offer',
                                value: (
                                    <span className="font-mono">
                                        {first.offerID || '—'} · {first.validatingCarrierCode || '—'} ·{' '}
                                        {first.price?.totalAmount ?? '—'}
                                    </span>
                                ),
                            },
                        ]
                        : []),
                ],
            };
        }
        case 'offerPrice': {
            const rs = data?.offerPriceRS?.response ?? data?.offerPriceRS;
            const offers = collectOffers(rs);
            const first = offers[0];
            const total =
                first?.price?.totalAmount ??
                rs?.offersGroup?.carrierOffers?.[0]?.offer?.[0]?.offerItem?.fareDetail?.[0]?.fareComponent?.price?.totalAmount;
            return {
                title: 'Offer pricing',
                status,
                rows: [
                    { label: 'Status', value: String(data?.status ?? '—'), mono: true },
                    { label: 'Priced offers', value: String(offers.length), mono: true },
                    { label: 'Total amount', value: total ?? '—', mono: true },
                ],
            };
        }
        case 'fareRule': {
            const rs = data?.fareRuleRS ?? data?.fareruleRS ?? data;
            const ruleGroups = countFareRules(rs);
            return {
                title: 'Fare rule result',
                status,
                rows: [
                    { label: 'Status', value: String(data?.status ?? '—'), mono: true },
                    { label: 'Rule groups', value: String(ruleGroups), mono: true },
                ],
            };
        }
        case 'orderCreate': {
            const rs = data?.orderViewRS ?? data?.orderCreateRS ?? data;
            const orderId = rs?.response?.order?.orderID || rs?.order?.orderID || rs?.orderID;
            const bookingRef =
                rs?.response?.order?.bookingReference ||
                rs?.order?.bookingReference ||
                rs?.bookingReference;
            return {
                title: 'Order create result',
                status,
                rows: [
                    { label: 'Status', value: String(data?.status ?? '—'), mono: true },
                    { label: 'Order ID', value: orderId ?? '—', mono: true },
                    { label: 'Booking ref', value: bookingRef ?? '—', mono: true },
                ],
            };
        }
    }
}

function collectOffers(root: any): any[] {
    if (!root) return [];
    const carrierOffers = root?.response?.offersGroup?.carrierOffers || root?.offersGroup?.carrierOffers || [];
    const out: any[] = [];
    for (const co of Array.isArray(carrierOffers) ? carrierOffers : []) {
        const offerList = Array.isArray(co?.offer) ? co.offer : [];
        for (const o of offerList) {
            const fareDetail = o?.offerItem?.fareDetail?.[0];
            out.push({
                offerID: o?.offerID,
                validatingCarrierCode: o?.validatingCarrierCode,
                price: fareDetail?.fareComponent?.price,
            });
        }
    }
    return out;
}

function summarizeSuppliers(list: any): React.ReactNode {
    if (!Array.isArray(list) || list.length === 0) return '—';
    return (
        <span className="font-mono">
            {list
                .map((s: any) => `${s.supplierCode || '?'}${s.status === false ? '✗' : ''}`)
                .join(', ')}
        </span>
    );
}

function countFareRules(rs: any): number {
    if (!rs) return 0;
    const candidates = [
        rs?.response?.fareRule,
        rs?.fareRule,
        rs?.response?.rules,
        rs?.rules,
    ];
    for (const c of candidates) {
        if (Array.isArray(c)) return c.length;
    }
    return 0;
}

export default ResponseSummary;
