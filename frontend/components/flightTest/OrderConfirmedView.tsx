import React from 'react';
import { ParsedOrder, ParsedSegment } from './types';
import { dayOffset, formatTime, shortDateLong, splitMoney, durationLabel } from './parsers';
import { Alert, ProgressBar } from './shellWidgets';

interface OrderConfirmedViewProps {
    order: ParsedOrder | null;
    loading: boolean;
    error: string | null;
    onStartOver: () => void;
    onBack: () => void;
}

const UserIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
    </svg>
);

const PlaneIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S11 2.67 11 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5l8 2.5z" />
    </svg>
);

const MailIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M2 6l10 7 10-7" />
    </svg>
);

const PhoneIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 5a2 2 0 012-2h3l2 5-2 1a11 11 0 005 5l1-2 5 2v3a2 2 0 01-2 2 17 17 0 01-16-16z" />
    </svg>
);

const ContactIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 5a2 2 0 012-2h3.5a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.55 1.22L8 10.5a11 11 0 005.5 5.5l1.1-2.4a1 1 0 011.22-.55l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2 17 17 0 01-16-16z" />
    </svg>
);

export const OrderConfirmedView: React.FC<OrderConfirmedViewProps> = ({
    order,
    loading,
    error,
    onStartOver,
    onBack,
}) => {
    if (loading) {
        return (
            <>
                <ProgressBar stage="confirmed" />
                <Alert tone="loading" title="Booking in progress">
                    Hold on, we're confirming your seats and generating a PNR.
                </Alert>
            </>
        );
    }

    if (error && !order) {
        return (
            <>
                <ProgressBar stage="confirmed" />
                <Alert tone="error" title="Order create failed">
                    {error}
                </Alert>
                <div className="ff-foot-actions" style={{ borderRadius: 12, borderTop: 0 }}>
                    <button className="ff-btn-ghost" onClick={onBack}>← Back to payment</button>
                    <button className="ff-btn-primary" onClick={onStartOver}>Start over</button>
                </div>
            </>
        );
    }

    if (!order) return null;

    const totalCharged = order.total.amount;
    const { intPart, dec } = splitMoney(totalCharged);

    return (
        <>
            <ProgressBar stage="confirmed" />

            <div className="ff-pnr-hero">
                <div className="top">
                    <div className="conf">
                        <span className="pulse" /> Booking confirmed
                    </div>
                    <div className="status">{order.status} · {order.statusLabel}</div>
                </div>
                <div className="lbl">PNR · Record locator</div>
                <div className="pnr">{order.pnr}</div>
                <div className="meta-row">
                    <div className="m">
                        <div className="l">Carrier</div>
                        <div className="v">{order.carrier}{order.carrierName ? ` · ${order.carrierName}` : ''}</div>
                    </div>
                    <div className="m">
                        <div className="l">Segments</div>
                        <div className="v">{order.segments.length}</div>
                    </div>
                    <div className="m">
                        <div className="l">Passengers</div>
                        <div className="v">{order.passengers.length}</div>
                    </div>
                </div>
            </div>

            {order.passengers.length > 0 && (
                <div className="ff-card">
                    <div className="ff-card-head">
                        <h2>
                            <UserIcon />
                            Passengers
                        </h2>
                        <div className="meta">{order.passengers.length} traveller{order.passengers.length === 1 ? '' : 's'}</div>
                    </div>
                    <div className="ff-pax-list">
                        {order.passengers.map((p) => {
                            const initials = `${p.givenName?.[0] || '?'}${p.surname?.[0] || ''}`.toUpperCase();
                            return (
                                <div className="pax" key={p.paxId}>
                                    <div className="ic">{initials}</div>
                                    <div className="info">
                                        <div className="name">
                                            {p.title && <span className="title">{p.title}</span>}
                                            {[p.givenName, p.middleName, p.surname].filter(Boolean).join(' ') || '—'}
                                        </div>
                                        <div className="sub">
                                            {p.dob ? `DOB ${p.dob}` : ''}{p.gender ? ` · ${p.gender}` : ''}
                                            {p.passportNumber ? ` · Passport ${p.passportNumber}` : ''}
                                            {p.passportIssuingCountry ? ` · ${p.passportIssuingCountry}` : ''}
                                            {p.passportExpiry ? ` · exp ${p.passportExpiry}` : ''}
                                        </div>
                                    </div>
                                    <div className="type">{p.ptc}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {order.segments.length > 0 && (
                <div className="ff-card">
                    <div className="ff-card-head">
                        <h2>
                            <PlaneIcon />
                            Itinerary
                        </h2>
                        <div className="meta">{order.segments.length} segment{order.segments.length === 1 ? '' : 's'} · {order.carrier}</div>
                    </div>
                    {order.segments.map((seg, i) => (
                        <SegmentRow key={seg.segmentID || i} seg={seg} index={i + 1} />
                    ))}
                </div>
            )}

            {order.services && order.services.length > 0 && (
                <div className="ff-card">
                    <div className="ff-card-head">
                        <h2>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M8 12l3 3 5-6" />
                            </svg>
                            Services purchased
                        </h2>
                        <div className="meta">{order.services.length} item{order.services.length === 1 ? '' : 's'}</div>
                    </div>
                    <div>
                        {order.services.map((s, i) => (
                            <div className="ff-contact-row" key={i}>
                                <div className="ic">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 11h16M4 11a4 4 0 014-4h8a4 4 0 014 4M6 11v6a2 2 0 002 2h8a2 2 0 002-2v-6" />
                                    </svg>
                                </div>
                                <div className="info">
                                    <div className="l">{s.name}</div>
                                    <div className="v" style={{ fontSize: 11, color: 'var(--ff-text-3)' }}>
                                        {s.sub || ''}{s.price ? ` · ${s.price.currency} ${s.price.amount}` : ''}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(order.contact.email || order.contact.phone) && (
                <div className="ff-card">
                    <div className="ff-card-head">
                        <h2>
                            <ContactIcon />
                            Contact
                        </h2>
                        <div className="meta">Primary</div>
                    </div>
                    {order.contact.email && (
                        <div className="ff-contact-row">
                            <div className="ic"><MailIcon /></div>
                            <div className="info">
                                <div className="l">Email</div>
                                <div className="v">{order.contact.email}</div>
                            </div>
                        </div>
                    )}
                    {order.contact.phone && (
                        <div className="ff-contact-row">
                            <div className="ic"><PhoneIcon /></div>
                            <div className="info">
                                <div className="l">Phone</div>
                                <div className="v">{order.contact.phoneCountryCode || ''} {order.contact.phone}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="ff-total-card">
                <div className="l">
                    Total charged
                    <span className="s">
                        {order.passengers.length} pax · all-inclusive · paid
                    </span>
                </div>
                <div className="v">
                    <span className="cur">{order.total.currency}</span>
                    {intPart}
                    <span className="dec">{dec}</span>
                </div>
            </div>

            <div className="ff-foot-actions" style={{ borderRadius: 12, borderTop: 0 }}>
                <button className="ff-btn-ghost" onClick={onBack}>Back</button>
                <button className="ff-btn-primary" onClick={onStartOver}>Start a new search</button>
            </div>
        </>
    );
};

const SegmentRow: React.FC<{ seg: ParsedSegment; index: number }> = ({ seg, index }) => {
    const plusDays = dayOffset(seg.departureDate, seg.arrivalDate);
    return (
        <div className="ff-seg">
            <div className="seg-head">
                <div className="name">
                    {seg.airline} {seg.flightNumber}
                    <span className="num">· SEG {index}{seg.aircraft ? ` · ${seg.aircraft}` : ''}</span>
                </div>
                <div className="day">{shortDateLong(seg.departureDate)}</div>
            </div>
            <div className="seg-row">
                <div className="seg-ep">
                    <div className="time">{formatTime(seg.departureTime)}</div>
                    <div className="iata">
                        <b>{seg.departureAirport}</b>
                        {seg.departureTerminal ? ` · T${seg.departureTerminal}` : ''}
                    </div>
                </div>
                <div className="seg-path">
                    <div className="dur">{durationLabel(seg.durationMinutes)}</div>
                    <div className="line" />
                    <div className="dur" style={{ color: 'var(--ff-text-4)', fontSize: 10, textTransform: 'uppercase' }}>Non-stop</div>
                </div>
                <div className="seg-ep r">
                    <div className="time">
                        {formatTime(seg.arrivalTime)}
                        {plusDays > 0 && <span className="plus">+{plusDays}</span>}
                    </div>
                    <div className="iata">
                        <b>{seg.arrivalAirport}</b>
                        {seg.arrivalTerminal ? ` · T${seg.arrivalTerminal}` : ''}
                    </div>
                </div>
            </div>
        </div>
    );
};
