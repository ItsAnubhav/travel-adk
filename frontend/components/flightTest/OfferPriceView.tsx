import React, { useEffect, useMemo, useState } from 'react';
import { ParsedOffer, ParsedSearch } from './types';
import { airportCity, dayLabel, formatTime, shortDateLong, splitMoney } from './parsers';
import { Alert, BackLink, ProgressBar } from './shellWidgets';

interface OfferPriceViewProps {
    pricedOffer: ParsedOffer | null;
    selectedOffer: ParsedOffer;
    search: ParsedSearch;
    loading: boolean;
    error: string | null;
    fareMatch?: boolean | null;
    onBack: () => void;
    onContinueToPayment: (paymentMethod: 'CC' | 'CA') => void;
}

const ReceiptIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18M7 15h4" />
    </svg>
);

const CardIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
    </svg>
);

const Check: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 12l5 5L20 7" />
    </svg>
);

const AlertTri: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M12 3L2 20h20L12 3zM12 10v5M12 18h.01" />
    </svg>
);

const Arrow: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
);

type PaxTab = 'ADT' | 'CHD' | 'INF' | 'ALL';

export const OfferPriceView: React.FC<OfferPriceViewProps> = ({
    pricedOffer,
    selectedOffer,
    search,
    loading,
    error,
    fareMatch,
    onBack,
    onContinueToPayment,
}) => {
    const offer = pricedOffer || selectedOffer;
    const initialTab = useMemo<PaxTab>(() => {
        if (offer.paxBreakdown.some((p) => p.type === 'ADT')) return 'ADT';
        return (offer.paxBreakdown[0]?.type as PaxTab) || 'ALL';
    }, [offer]);
    const [tab, setTab] = useState<PaxTab>(initialTab);
    const [pay, setPay] = useState<'CC' | 'CA'>('CC');
    const [timer, setTimer] = useState(15 * 60);

    useEffect(() => {
        if (loading) return;
        const id = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
        return () => clearInterval(id);
    }, [loading]);

    const paxToShow = useMemo(() => {
        if (tab === 'ALL') return offer.paxBreakdown;
        return offer.paxBreakdown.filter((p) => p.type === tab);
    }, [offer, tab]);

    if (loading) {
        return (
            <>
                <BackLink label="Back to passengers" onClick={onBack} />
                <ProgressBar stage="price" />
                <Alert tone="loading" title="Pricing offer">
                    We're verifying availability and the final fare with the airline.
                </Alert>
            </>
        );
    }

    const showError = !!error && !pricedOffer;

    return (
        <>
            <BackLink label="Back to passengers" onClick={onBack} />

            <ProgressBar stage="price" />

            {showError && (
                <Alert tone="error" title="Could not re-price the offer">
                    {error}. You can still review the search-time price below.
                </Alert>
            )}

            {(() => {
                const oldTotal = selectedOffer.totalAmount;
                const newTotal = (pricedOffer || selectedOffer).totalAmount;
                const currency = (pricedOffer || selectedOffer).currency || offer.currency;
                const delta = newTotal - oldTotal;
                const deltaSignificant = Math.abs(delta) > 0.005;
                const deltaPct = oldTotal > 0 ? (delta / oldTotal) * 100 : 0;
                const fmtMoney = (v: number) =>
                    v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const matched = fareMatch === true;
                const explicitlyUnmatched = fareMatch === false;

                if (explicitlyUnmatched) {
                    const wentUp = delta > 0;
                    const deltaColor = wentUp ? '#b91c1c' : 'var(--ff-success)';
                    const deltaSign = wentUp ? '+' : '−';
                    return (
                        <div
                            className="ff-match-banner"
                            style={{
                                background: 'var(--ff-warn-soft)',
                                borderColor: 'rgba(180,83,9,0.20)',
                                color: 'var(--ff-text)',
                                alignItems: 'center',
                            }}
                        >
                            <div
                                className="check"
                                style={{ background: 'var(--ff-warn)', color: 'white' }}
                            >
                                <AlertTri />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div>
                                    <b>Price updated</b> — the airline has revised this fare since your search. Please review the new total before continuing.
                                </div>
                                {deltaSignificant && (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'baseline',
                                            gap: 10,
                                            flexWrap: 'wrap',
                                            fontFamily: "'Geist Mono', ui-monospace, monospace",
                                            fontSize: 13,
                                        }}
                                    >
                                        <span
                                            style={{
                                                textDecoration: 'line-through',
                                                color: 'var(--ff-text-3)',
                                            }}
                                            title="Search-time price"
                                        >
                                            {currency} {fmtMoney(oldTotal)}
                                        </span>
                                        <span style={{ color: 'var(--ff-text-3)', fontSize: 14 }}>→</span>
                                        <span
                                            style={{
                                                fontSize: 16,
                                                fontWeight: 700,
                                                color: 'var(--ff-text)',
                                            }}
                                        >
                                            {currency} {fmtMoney(newTotal)}
                                        </span>
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                padding: '2px 8px',
                                                borderRadius: 100,
                                                background: wentUp ? 'rgba(220,38,38,0.10)' : 'var(--ff-success-soft)',
                                                color: deltaColor,
                                                fontSize: 11.5,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {deltaSign}{currency} {fmtMoney(Math.abs(delta))}
                                            <span style={{ opacity: 0.75, fontWeight: 500 }}>
                                                ({deltaSign}{Math.abs(deltaPct).toFixed(1)}%)
                                            </span>
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="timer">expires in {formatCountdown(timer)}</div>
                        </div>
                    );
                }

                return (
                    <div className="ff-match-banner">
                        <div className="check"><Check /></div>
                        <div>
                            <b>{matched ? 'Price matched' : 'Offer priced'}</b>{' '}
                            — offer {offer.offerID} is locked at {currency} {fmtMoney(newTotal)}
                        </div>
                        <div className="timer">expires in {formatCountdown(timer)}</div>
                    </div>
                );
            })()}

            <div className="ff-card">
                <div className="ff-card-head">
                    <h2>
                        <ReceiptIcon />
                        Priced Offer
                    </h2>
                    <div className="meta">{offer.offerID} · {offer.validatingCarrier}</div>
                </div>

                <div className="ff-itin-recap">
                    {offer.legs.map((leg, i) => {
                        const viaList = leg.stopAirports.join(' · ');
                        const dep = formatTime(leg.departureTime);
                        return (
                            <div className="ff-itin-line" key={i}>
                                <span className="leg-tag">
                                    {leg.direction === 'DEP'
                                        ? 'Onward'
                                        : leg.direction === 'OUT'
                                            ? 'Outbound'
                                            : leg.direction === 'RET'
                                                ? 'Return'
                                                : `Leg ${leg.legIndex + 1}`}
                                </span>
                                <span className="route">
                                    {leg.departureAirport} <span className="arrow">→</span> {leg.arrivalAirport}
                                    {viaList && <span className="via">via {viaList}</span>}
                                </span>
                                <span className="when">{shortDateLong(leg.departureDate)} · {dep}</span>
                            </div>
                        );
                    })}
                </div>

                <div className="ff-policy">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                    </svg>
                    <div className="text">
                        <b>Within travel policy</b>{' '}
                        — corporate fare applied<br />
                        <span style={{ fontSize: 11, color: 'var(--ff-text-3)' }}>
                            Brand {offer.brandName || offer.cabinClass} · Fare type {offer.fareType || 'PUBLIC'}
                        </span>
                    </div>
                    <span className="badge-info">Approved</span>
                </div>

                <div className="ff-price-table">
                    <div className="ff-section-title">Per-passenger breakdown</div>

                    <div className="ff-pax-tabs-row">
                        {offer.paxBreakdown.map((p) => {
                            const count = countOfPax(search, p.type);
                            return (
                                <button
                                    key={p.type}
                                    className={`ff-tab ${tab === p.type ? 'active' : ''}`}
                                    onClick={() => setTab(p.type as PaxTab)}
                                >
                                    {labelForPax(p.type)} <span className="count">×{count}</span>
                                </button>
                            );
                        })}
                        <button
                            className={`ff-tab ${tab === 'ALL' ? 'active' : ''}`}
                            onClick={() => setTab('ALL')}
                        >
                            All
                        </button>
                    </div>

                    {paxToShow.map((p) => (
                        <PaxBreakdownBlock key={p.type} pax={p} />
                    ))}

                    <div className="ff-line total">
                        <div className="label">
                            Total payable
                            <span className="sub">
                                {totalPaxLabel(search)} · {offer.currency} · all-inclusive
                            </span>
                        </div>
                        <div className="val">
                            <span className="cur">{offer.currency}</span>
                            {splitMoney(offer.totalAmount).intPart}
                            <span className="dec">{splitMoney(offer.totalAmount).dec}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="ff-card">
                <div className="ff-card-head">
                    <h2>
                        <CardIcon />
                        Payment method
                    </h2>
                    <div className="meta">2 options</div>
                </div>

                <div className="ff-pay-list">
                    <label className={`ff-pay ${pay === 'CC' ? 'selected' : ''}`} onClick={() => setPay('CC')}>
                        <span className="radio" />
                        <span className="pmark">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="5" width="20" height="14" rx="2" />
                                <path d="M2 10h20" />
                            </svg>
                        </span>
                        <span className="pinfo">
                            <span className="pname">Credit / Debit Card</span>
                            <span className="psub">Visa, Mastercard, Amex accepted</span>
                        </span>
                        <span className="pchip">CC</span>
                    </label>

                    <label className={`ff-pay ${pay === 'CA' ? 'selected' : ''}`} onClick={() => setPay('CA')}>
                        <span className="radio" />
                        <span className="pmark">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 7v10M9 10h5a2 2 0 010 4H9" />
                            </svg>
                        </span>
                        <span className="pinfo">
                            <span className="pname">Cash / Bank transfer</span>
                            <span className="psub">Pay at branch · settle within 24 hours</span>
                        </span>
                        <span className="pchip">CA</span>
                    </label>
                </div>

                <div className="ff-foot-actions">
                    <button className="ff-btn-ghost" onClick={onBack}>Back</button>
                    <button className="ff-btn-primary" onClick={() => onContinueToPayment(pay)}>
                        Continue to Payment
                        <Arrow />
                    </button>
                </div>
            </div>
        </>
    );
};

const PaxBreakdownBlock: React.FC<{ pax: any }> = ({ pax }) => {
    const subtotal = pax.subtotal || 0;
    return (
        <>
            <div className="ff-line">
                <div className="label">
                    {labelForPax(pax.type)} · base fare
                    {pax.fareBasis?.length ? (
                        <span className="sub">{pax.fareBasis.join(' / ')}</span>
                    ) : null}
                </div>
                <div className="val">{fmt(pax.baseAmount)}</div>
            </div>
            <div className="ff-line">
                <div className="label">
                    Taxes &amp; surcharges
                    {pax.taxSummary?.length ? (
                        <span className="sub">{pax.taxSummary.slice(0, 3).map((t: any) => t.code).join(' + ')}</span>
                    ) : null}
                </div>
                <div className="val">{fmt(pax.tax)}</div>
            </div>
            {pax.taxSummary?.slice(0, 2).map((t: any, i: number) => (
                <div className="ff-line indent" key={i}>
                    <div className="label">↳ {t.code}{t.name ? ` · ${t.name}` : ''}</div>
                    <div className="val">{fmt(t.amount)}</div>
                </div>
            ))}
            {pax.transactionFee ? (
                <div className="ff-line">
                    <div className="label">Transaction fee<span className="sub">corporate</span></div>
                    <div className="val">{fmt(pax.transactionFee)}</div>
                </div>
            ) : null}
            {pax.autoChargeAdditional ? (
                <div className="ff-line">
                    <div className="label">Additional hour charge<span className="sub">AOHC</span></div>
                    <div className="val">{fmt(pax.autoChargeAdditional)}</div>
                </div>
            ) : null}
            {pax.vat ? (
                <div className="ff-line">
                    <div className="label">VAT / GST</div>
                    <div className="val">{fmt(pax.vat)}</div>
                </div>
            ) : null}
            <div className="ff-line subtotal">
                <div className="label">{labelForPax(pax.type)} subtotal</div>
                <div className="val">{fmt(subtotal)}</div>
            </div>
        </>
    );
};

function fmt(n?: number): string {
    return (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function labelForPax(t: string): string {
    if (t === 'ADT') return 'Adult';
    if (t === 'CHD') return 'Child';
    if (t === 'INF') return 'Infant';
    if (t === 'YOUTH') return 'Youth';
    if (t === 'SENIOR') return 'Senior';
    return t;
}

function countOfPax(search: ParsedSearch, t: string): number {
    if (t === 'ADT') return search.paxCounts.ADT;
    if (t === 'CHD') return search.paxCounts.CHD;
    if (t === 'INF') return search.paxCounts.INF;
    return 1;
}

function totalPaxLabel(search: ParsedSearch): string {
    return `${search.paxCounts.total} passenger${search.paxCounts.total === 1 ? '' : 's'}`;
}

function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}
