import React, { useEffect, useMemo, useState } from 'react';
import { ParsedFare, ParsedLeg, ParsedOffer, ParsedSearch } from './types';
import {
    airlineName,
    dayLabel,
    dayOffset,
    durationLabel,
    formatTime,
} from './parsers';
import { BackLink, PriceTag, ProgressBar } from './shellWidgets';
import { FareBreakupBar } from './FareBreakupBar';

interface BrandedFareViewProps {
    offer: ParsedOffer;
    search: ParsedSearch;
    onBack: () => void;
    onContinue: (offer: ParsedOffer, fare: ParsedFare) => void;
}

const Check: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 12l5 5L20 7" />
    </svg>
);

const Dash: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M6 12h12" />
    </svg>
);

export const BrandedFareView: React.FC<BrandedFareViewProps> = ({
    offer,
    search,
    onBack,
    onContinue,
}) => {
    // Group fares by cabin class. Each group keeps the order of its cheapest
    // fare so the cabin class with the cheapest entry shows first.
    const cabinGroups = useMemo(() => {
        const groups = new Map<string, ParsedFare[]>();
        for (const f of offer.fares) {
            const key = (f.cabinClass || 'Other').trim() || 'Other';
            const list = groups.get(key) || [];
            list.push(f);
            groups.set(key, list);
        }
        const arrGroups = Array.from(groups.entries()).map(([cabin, fares]) => {
            const sorted = [...fares].sort((a, b) => a.totalAmount - b.totalAmount);
            return { cabin, fares: sorted, minAmount: sorted[0]?.totalAmount ?? 0 };
        });
        arrGroups.sort((a, b) => a.minAmount - b.minAmount);
        return arrGroups;
    }, [offer.fares]);

    const [activeCabin, setActiveCabin] = useState<string>(cabinGroups[0]?.cabin || 'Other');
    const activeGroup = cabinGroups.find((g) => g.cabin === activeCabin) || cabinGroups[0];
    const sortedFares = activeGroup?.fares ?? [];
    const cheapestAmt = sortedFares[0]?.totalAmount ?? 0;
    const currency = sortedFares[0]?.currency || offer.currency;

    // The selected fare must always belong to the active cabin tab. Re-seed
    // it whenever the user switches tabs so the price chip and the "Continue"
    // CTA reflect what they see.
    const [selectedIdx, setSelectedIdx] = useState<number>(sortedFares[0]?.fareIndex ?? 0);
    useEffect(() => {
        if (sortedFares.length === 0) return;
        if (!sortedFares.some((f) => f.fareIndex === selectedIdx)) {
            setSelectedIdx(sortedFares[0].fareIndex);
        }
    }, [sortedFares, selectedIdx]);
    const selectedFare = useMemo(
        () => sortedFares.find((f) => f.fareIndex === selectedIdx) || sortedFares[0],
        [sortedFares, selectedIdx],
    );

    const carrier = offer.validatingCarrier;
    const carrierName = airlineName(search.metadata, carrier) || offer.airlineName || carrier;

    return (
        <>
            <BackLink label="Back to flights" onClick={onBack} />

            <ProgressBar stage="branded" />

            <div className="ff-search-summary">
                <div className="route">
                    <span>{search.origin || '—'}</span>
                    <span className="arrow">{search.returnDate ? '⇄' : '→'}</span>
                    <span>{search.destination || '—'}</span>
                </div>
                <div className="detail">
                    {carrier} {carrierName}
                </div>
            </div>

            <article className="ff-card">
                <div className="ff-card-head">
                    <h2>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12l18-9-3 9 3 9z" />
                        </svg>
                        Selected itinerary
                    </h2>
                    <div className="meta">
                        {offer.tripType === 'RT'
                            ? 'Round-trip'
                            : offer.tripType === 'MC'
                                ? 'Multi-city'
                                : 'One-way'}
                    </div>
                </div>
                <div className="ff-legs">
                    {offer.legs.map((leg, i) => (
                        <div className="ff-leg-row" key={i}>
                            <div className="ff-leg-dir">
                                <span className="dir">{legDirLabel(leg)}</span>
                                <span className="day">{dayLabel(leg.departureDate)}</span>
                            </div>
                            <div className="ff-leg-route">
                                <div className="ff-leg-ep">
                                    <div className="time">{formatTime(leg.departureTime)}</div>
                                    <div className="iata">{leg.departureAirport}</div>
                                </div>
                                <div className="ff-leg-arrow" />
                                <div className="ff-leg-ep r">
                                    <div className="time">
                                        {formatTime(leg.arrivalTime)}
                                        {dayOffset(leg.departureDate, leg.arrivalDate) > 0 && (
                                            <span className="plus">+{dayOffset(leg.departureDate, leg.arrivalDate)}</span>
                                        )}
                                    </div>
                                    <div className="iata">{leg.arrivalAirport}</div>
                                </div>
                            </div>
                            <div className="ff-leg-meta">
                                <div className="dur">{durationLabel(leg.durationMinutes)}</div>
                                <div>
                                    {leg.stops === 0
                                        ? 'Non-stop'
                                        : `${leg.stops} stop${leg.stops > 1 ? 's' : ''}`}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </article>

            {cabinGroups.length > 1 && (
                <div className="ff-cabin-tabs" role="tablist" aria-label="Cabin class">
                    {cabinGroups.map((g) => {
                        const isActive = g.cabin === activeGroup?.cabin;
                        return (
                            <button
                                key={g.cabin}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                className={`ff-cabin-tab${isActive ? ' active' : ''}`}
                                onClick={() => setActiveCabin(g.cabin)}
                            >
                                <span className="cabin-name">{g.cabin}</span>
                                <span className="cabin-min">
                                    from {currency}{' '}
                                    {g.minAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className="cabin-count">{g.fares.length}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="ff-section-label">
                {activeGroup?.cabin || 'Fares'} · {sortedFares.length} option{sortedFares.length === 1 ? '' : 's'}
            </div>

            <div className="ff-brand-grid">
                {sortedFares.map((fare) => {
                    const diff = fare.totalAmount - cheapestAmt;
                    const isSel = fare.fareIndex === selectedFare?.fareIndex;
                    return (
                        <button
                            key={fare.fareIndex}
                            type="button"
                            className={`ff-brand-card${isSel ? ' selected' : ''}`}
                            onClick={() => setSelectedIdx(fare.fareIndex)}
                            aria-pressed={isSel}
                        >
                            <div className="ff-brand-card-head">
                                <div className="ff-brand-title">
                                    <span className="brand-name">
                                        {fare.brandName || fare.brandId || `Fare ${fare.fareIndex + 1}`}
                                    </span>
                                    <span className="brand-class">{fare.cabinClass || 'Economy'}</span>
                                </div>
                                <span className={`ff-brand-radio${isSel ? ' on' : ''}`}>
                                    {isSel && <Check />}
                                </span>
                            </div>

                            <div className="ff-brand-price">
                                <PriceTag currency={fare.currency} amount={fare.totalAmount} size="lg" />
                                {diff > 0 && (
                                    <span className="ff-brand-diff">
                                        +{fare.currency} {diff.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                )}
                                {diff === 0 && sortedFares.length > 1 && (
                                    <span className="ff-brand-diff cheapest">Cheapest</span>
                                )}
                            </div>

                            <ul className="ff-brand-feats">
                                <FeatLine on={fare.refundable} label="Refundable" off="Non-refundable" />
                                {fare.fareType && (
                                    <li className="neutral">
                                        <span className="dot" />
                                        Fare type · {fare.fareType}
                                    </li>
                                )}
                                {fare.rbd.length > 0 && (
                                    <li className="neutral">
                                        <span className="dot" />
                                        RBD · {Array.from(new Set(fare.rbd)).join('/')}
                                    </li>
                                )}
                                {fare.fareBasis.length > 0 && (
                                    <li className="neutral">
                                        <span className="dot" />
                                        Basis · {Array.from(new Set(fare.fareBasis)).join(', ')}
                                    </li>
                                )}
                            </ul>
                        </button>
                    );
                })}
            </div>

            <FareBreakupBar
                label={selectedFare?.brandName || selectedFare?.brandId || 'Selected fare'}
                currency={selectedFare?.currency || offer.currency}
                totalAmount={selectedFare?.totalAmount || offer.totalAmount}
                paxBreakdown={selectedFare?.paxBreakdown || offer.paxBreakdown}
                paxCounts={search.paxCounts}
                ctaLabel="Continue to payment"
                onCta={() => selectedFare && onContinue(offer, selectedFare)}
                ctaDisabled={!selectedFare}
            />
        </>
    );
};

const FeatLine: React.FC<{ on: boolean; label: string; off: string }> = ({ on, label, off }) => (
    <li className={on ? 'good' : 'bad'}>
        <span className="icn">{on ? <Check /> : <Dash />}</span>
        {on ? label : off}
    </li>
);

function legDirLabel(leg: ParsedLeg): string {
    switch (leg.direction) {
        case 'DEP':
            return 'Dep';
        case 'OUT':
            return 'Out';
        case 'RET':
            return 'Ret';
        case 'MC':
            return `Leg ${leg.legIndex + 1}`;
    }
}
