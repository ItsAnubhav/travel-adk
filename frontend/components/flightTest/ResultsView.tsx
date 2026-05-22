import React, { useMemo, useState } from 'react';
import { ParsedLeg, ParsedOffer, ParsedSearch } from './types';
import {
    airlineName,
    dayLabel,
    dayOffset,
    durationLabel,
    formatTime,
} from './parsers';
import { AirlineLogo, PriceTag, SearchSummary } from './shellWidgets';

type FilterKey = 'all' | 'nonstop' | 'refundable';
type SortKey = 'best' | 'cheap' | 'fast';

const totalDuration = (o: ParsedOffer): number =>
    o.legs.reduce((s, l) => s + (l.durationMinutes || 0), 0);

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

function applyFilter(offers: ParsedOffer[], filter: FilterKey): ParsedOffer[] {
    switch (filter) {
        case 'all':
            return offers;
        case 'nonstop':
            return offers.filter((o) => o.legs.every((l) => l.stops === 0));
        case 'refundable':
            return offers.filter((o) => o.anyRefundable);
    }
}

function applySort(offers: ParsedOffer[], sort: SortKey): ParsedOffer[] {
    switch (sort) {
        case 'best':
            return offers;
        case 'cheap':
            return [...offers].sort((a, b) => a.totalAmount - b.totalAmount);
        case 'fast':
            return [...offers].sort((a, b) => totalDuration(a) - totalDuration(b));
    }
}

const OutIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M7 17L17 7M9 7h8v8" />
    </svg>
);

const RetIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M17 7L7 17M15 17H7V9" />
    </svg>
);

const Arrow: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
);

interface ResultsViewProps {
    search: ParsedSearch;
    onSelect: (offer: ParsedOffer) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ search, onSelect }) => {
    const [filter, setFilter] = useState<FilterKey>('all');
    const [sort, setSort] = useState<SortKey>('best');
    const visible = useMemo(
        () => applySort(applyFilter(search.offers, filter), sort),
        [search.offers, filter, sort],
    );

    const tripLabel =
        search.tripType === 'RT' ? 'Round trip' : search.tripType === 'MC' ? 'Multi-city' : 'One way';
    const tripArrow = search.tripType === 'RT' ? '⇄' : '→';

    const filterLabel: Record<FilterKey, string> = {
        all: 'All flights',
        nonstop: 'Non-stop only',
        refundable: 'Refundable only',
    };
    const sortLabel: Record<SortKey, string> = {
        best: 'Sorted by relevance',
        cheap: 'Sorted by price (low → high)',
        fast: 'Sorted by total duration',
    };

    return (
        <>
            <SearchSummary
                origin={search.origin}
                destination={search.destination}
                tripType={search.tripType}
                departDate={search.departDate}
                returnDate={search.returnDate}
                paxCounts={search.paxCounts}
            />

            <div className="ff-controls">
                <div className="ff-controls-group">
                    <span className="ff-controls-label">Filter</span>
                    <div className="ff-tabs">
                        <button className={`ff-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                            All
                        </button>
                        <button className={`ff-tab ${filter === 'nonstop' ? 'active' : ''}`} onClick={() => setFilter('nonstop')}>
                            Non-stop
                        </button>
                        <button className={`ff-tab ${filter === 'refundable' ? 'active' : ''}`} onClick={() => setFilter('refundable')}>
                            Refundable
                        </button>
                    </div>
                </div>
                <div className="ff-controls-group">
                    <span className="ff-controls-label">Sort</span>
                    <div className="ff-tabs">
                        <button className={`ff-tab ${sort === 'best' ? 'active' : ''}`} onClick={() => setSort('best')}>
                            Best
                        </button>
                        <button className={`ff-tab ${sort === 'cheap' ? 'active' : ''}`} onClick={() => setSort('cheap')}>
                            Cheapest
                        </button>
                        <button className={`ff-tab ${sort === 'fast' ? 'active' : ''}`} onClick={() => setSort('fast')}>
                            Fastest
                        </button>
                    </div>
                </div>
            </div>

            <div className="ff-results-meta">
                <div className="ff-results-meta-left">
                    <span className="count">{visible.length}</span>
                    <span className="muted">
                        of {search.offers.length} {tripLabel.toLowerCase()} flight{search.offers.length === 1 ? '' : 's'}
                    </span>
                </div>
                <div className="ff-results-meta-right">
                    {search.origin} {tripArrow} {search.destination} · {filterLabel[filter]} · {sortLabel[sort]}
                </div>
            </div>

            {visible.map((offer, idx) => (
                <FlightCard key={`${offer.offerID}-${idx}`} offer={offer} metadata={search.metadata} onSelect={onSelect} />
            ))}

            {visible.length === 0 && (
                <div className="ff-alert info">No flights match this filter.</div>
            )}
        </>
    );
};

const FlightCard: React.FC<{
    offer: ParsedOffer;
    metadata: any;
    onSelect: (offer: ParsedOffer) => void;
}> = ({ offer, metadata, onSelect }) => {
    const carrier = offer.validatingCarrier;
    const name = airlineName(metadata, carrier) || offer.airlineName || carrier;
    const fareCount = offer.fares.length;
    const multiFare = fareCount > 1;

    return (
        <article className="ff-card">
            <div className="ff-card-top">
                <AirlineLogo code={carrier} title={name} />
                <div className="ff-airline-info">
                    <div className="ff-airline-name">
                        {name} <span className="meta">· {offer.brandName || offer.cabinClass || 'Economy'}</span>
                    </div>
                    <div className="ff-badges">
                        {offer.anyRefundable && (
                            <span className="ff-badge refund">
                                Refundable
                            </span>
                        )}
                    </div>
                </div>
                <div className="ff-price-action">
                    {multiFare && <span className="ff-from-label">from</span>}
                    <PriceTag currency={offer.currency} amount={offer.totalAmount} />
                    <button className="ff-btn-primary" onClick={() => onSelect(offer)}>
                        {multiFare ? 'Select fare' : 'Book'}
                        <Arrow />
                    </button>
                </div>
            </div>

            <div className="ff-legs">
                {offer.legs.map((leg, i) => (
                    <div className="ff-leg-row" key={i}>
                        <div className="ff-leg-dir">
                            <span className="dir">
                                {leg.direction === 'RET' ? <RetIcon /> : <OutIcon />}
                                {legDirLabel(leg)}
                            </span>
                            <span className="day">{dayLabel(leg.departureDate)}</span>
                        </div>
                        <div className="ff-leg-route">
                            <div className="ff-leg-ep">
                                <div className="time">{formatTime(leg.departureTime)}</div>
                                <div className="iata">
                                    {leg.departureAirport}
                                    {leg.segments[0]?.departureTerminal ? ` · T${leg.segments[0].departureTerminal}` : ''}
                                </div>
                            </div>
                            <div className="ff-leg-arrow" />
                            <div className="ff-leg-ep r">
                                <div className="time">
                                    {formatTime(leg.arrivalTime)}
                                    {dayOffset(leg.departureDate, leg.arrivalDate) > 0 && (
                                        <span className="plus">+{dayOffset(leg.departureDate, leg.arrivalDate)}</span>
                                    )}
                                </div>
                                <div className="iata">
                                    {leg.arrivalAirport}
                                    {leg.segments[leg.segments.length - 1]?.arrivalTerminal
                                        ? ` · T${leg.segments[leg.segments.length - 1].arrivalTerminal}`
                                        : ''}
                                </div>
                            </div>
                        </div>
                        <div className="ff-leg-meta">
                            <div className="dur">{durationLabel(leg.durationMinutes)}</div>
                            <div>
                                {leg.segments
                                    .map((s) => `${s.airline} ${s.flightNumber}`)
                                    .join(' / ')}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </article>
    );
};
