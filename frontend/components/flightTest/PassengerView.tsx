import React, { useMemo, useState } from 'react';
import { ContactForm, ParsedFareRule, ParsedOffer, ParsedSearch, PaxFormEntry } from './types';
import { airportCity, dayLabel } from './parsers';
import { Alert, BackLink, Modal, PriceTag, ProgressBar } from './shellWidgets';
import { FareRulesContent } from './FareRulesView';
import { FareBreakupBar } from './FareBreakupBar';

interface PassengerViewProps {
    offer: ParsedOffer;
    search: ParsedSearch;
    initialPax: PaxFormEntry[];
    initialContact: ContactForm;
    fareRules: ParsedFareRule | null;
    fareRulesLoading: boolean;
    fareRulesError: string | null;
    onAskFareRuleQuestion?: (question: string, rules: ParsedFareRule) => Promise<string>;
    onBack: () => void;
    onContinue: (pax: PaxFormEntry[], contact: ContactForm) => void;
}

const TITLES_BY_PTC: Record<string, string[]> = {
    ADT: ['Mr', 'Mrs', 'Ms'],
    CHD: ['Mstr', 'Miss'],
    INF: ['Mstr', 'Miss'],
};

const COUNTRY_OPTS = ['IN', 'AE', 'GB', 'PL', 'SG', 'US', 'SA'];
const COUNTRY_CODE_OPTS = ['+91', '+971', '+44', '+48', '+65', '+1', '+966'];

const UserIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
    </svg>
);

const CheckIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 12l5 5L20 7" />
    </svg>
);

const PhoneIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
        <path d="M3 5a2 2 0 012-2h3l2 5-2 1a11 11 0 005 5l1-2 5 2v3a2 2 0 01-2 2 17 17 0 01-16-16z" />
    </svg>
);

export const PassengerView: React.FC<PassengerViewProps> = ({
    offer,
    search,
    initialPax,
    initialContact,
    fareRules,
    fareRulesLoading,
    fareRulesError,
    onAskFareRuleQuestion,
    onBack,
    onContinue,
}) => {
    const [paxList, setPaxList] = useState<PaxFormEntry[]>(initialPax);
    const [activeIdx, setActiveIdx] = useState(0);
    const [contact, setContact] = useState<ContactForm>(initialContact);
    const [error, setError] = useState<string | null>(null);
    const [rulesOpen, setRulesOpen] = useState(false);
    const [docOpen, setDocOpen] = useState(false);
    const [loyaltyOpen, setLoyaltyOpen] = useState(false);

    const rulesBadge: { label: string; cls: 'loading' | 'ready' | 'error' | '' } = fareRulesLoading
        ? { label: 'Loading…', cls: 'loading' }
        : fareRulesError && !fareRules
            ? { label: 'Failed', cls: 'error' }
            : fareRules
                ? { label: 'Ready', cls: 'ready' }
                : { label: '—', cls: '' };

    const active = paxList[activeIdx];

    const isComplete = useMemo(
        () =>
            paxList.every(
                (p) => p.givenName.trim() && p.surname.trim() && p.dob,
            ) && contact.email.trim() && contact.mobile.trim(),
        [paxList, contact],
    );

    const updateActive = (changes: Partial<PaxFormEntry>) => {
        setPaxList((prev) => prev.map((p, i) => (i === activeIdx ? { ...p, ...changes } : p)));
    };

    const onSubmit = () => {
        if (!isComplete) {
            setError('Please fill all required fields for every passenger and the contact details.');
            return;
        }
        setError(null);
        onContinue(paxList, contact);
    };

    const cityOrigin = airportCity(search.metadata, offer.legs[0]?.departureAirport) || offer.legs[0]?.departureAirport;
    const cityDest = airportCity(search.metadata, offer.legs[0]?.arrivalAirport) || offer.legs[0]?.arrivalAirport;
    const tripDates = offer.legs[0]?.departureDate
        ? offer.legs.length > 1
            ? `${dayLabel(offer.legs[0].departureDate).split(' ').slice(1).join(' ')} – ${dayLabel(offer.legs[offer.legs.length - 1].departureDate).split(' ').slice(1).join(' ')}`
            : dayLabel(offer.legs[0].departureDate)
        : '';

    return (
        <>
            <BackLink label="Back to flights" onClick={onBack} />

            <ProgressBar stage="passenger" />

            <div className="ff-summary-bar">
                <div className="left">
                    <div className="icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S11 2.67 11 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5l8 2.5z" />
                        </svg>
                    </div>
                    <div>
                        <div className="label">
                            {cityOrigin} {offer.legs.length > 1 ? '⇄' : '→'} {cityDest} · {tripDates} · {offer.validatingCarrier}
                        </div>
                        <div className="value">
                            {paxList.length} passenger{paxList.length === 1 ? '' : 's'} · {offer.brandName || offer.cabinClass || 'Economy'}
                        </div>
                    </div>
                </div>
                <div className="right">
                    <div className="label" style={{ textAlign: 'right' }}>Total</div>
                    <PriceTag currency={offer.currency} amount={offer.totalAmount} size="md" />
                </div>
            </div>

            <button
                type="button"
                className="ff-rules-trigger"
                onClick={() => setRulesOpen(true)}
                disabled={fareRulesLoading && !fareRules}
                style={{ font: 'inherit', textAlign: 'left' }}
            >
                <div className="ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                    </svg>
                </div>
                <div className="info">
                    <div className="t">View fare rules</div>
                    <div className="s">
                        {fareRules
                            ? `Refund, change, no-show penalties · ${fareRules.saleCurrency}`
                            : fareRulesLoading
                                ? 'Fetching from the airline…'
                                : fareRulesError
                                    ? `Couldn't load · ${fareRulesError}`
                                    : 'Cancellation, change and no-show terms'}
                    </div>
                </div>
                <span className={`badge-mini ${rulesBadge.cls}`}>{rulesBadge.label}</span>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M9 6l6 6-6 6" />
                </svg>
            </button>

            <div className="ff-card">
                <div className="ff-card-head">
                    <h2>
                        <UserIcon />
                        Traveller information
                    </h2>
                    <div className="meta">{paxList.length} of {paxList.length} required</div>
                </div>

                <div className="ff-pax-tabs">
                    {paxList.map((p, i) => {
                        const filled =
                            !!p.givenName.trim() && !!p.surname.trim() && !!p.dob && !!p.docNumber.trim();
                        return (
                            <button
                                key={p.paxId}
                                className={`ff-pax-tab ${i === activeIdx ? 'active' : ''}`}
                                onClick={() => setActiveIdx(i)}
                            >
                                {filled ? (
                                    <span className="check"><CheckIcon /></span>
                                ) : (
                                    <span className="num">{i + 1}</span>
                                )}
                                {p.ptc === 'ADT' ? 'Adult' : p.ptc === 'CHD' ? 'Child' : 'Infant'}{' '}
                                <span className="tag">{p.ptc}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="ff-form">
                    <div className="ff-field-group-label">Identity</div>
                    <div className="ff-field-row cols-title-name">
                        <div className="ff-field">
                            <label>Title <span className="req">*</span></label>
                            <select
                                value={active.title}
                                onChange={(e) => updateActive({ title: e.target.value })}
                            >
                                {(TITLES_BY_PTC[active.ptc] || ['Mr']).map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="ff-field">
                            <label>Given name <span className="req">*</span></label>
                            <input
                                type="text"
                                value={active.givenName}
                                placeholder="As on passport"
                                onChange={(e) => updateActive({ givenName: e.target.value })}
                            />
                        </div>
                        <div className="ff-field">
                            <label>Surname <span className="req">*</span></label>
                            <input
                                type="text"
                                value={active.surname}
                                placeholder="Family name"
                                onChange={(e) => updateActive({ surname: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="ff-field-row">
                        <div className="ff-field">
                            <label>Middle name <span className="hint">optional</span></label>
                            <input
                                type="text"
                                value={active.middleName}
                                placeholder="If on passport"
                                onChange={(e) => updateActive({ middleName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="ff-field-row cols-3">
                        <div className="ff-field">
                            <label>Date of birth <span className="req">*</span></label>
                            <input
                                type="date"
                                value={active.dob}
                                onChange={(e) => updateActive({ dob: e.target.value })}
                            />
                        </div>
                        <div className="ff-field">
                            <label>Gender <span className="req">*</span></label>
                            <select
                                value={active.gender}
                                onChange={(e) => updateActive({ gender: e.target.value as PaxFormEntry['gender'] })}
                            >
                                <option value="M">Male</option>
                                <option value="F">Female</option>
                                <option value="X">Other</option>
                            </select>
                        </div>
                        <div className="ff-field">
                            <label>Nationality <span className="req">*</span></label>
                            <select
                                value={active.nationality}
                                onChange={(e) => updateActive({ nationality: e.target.value })}
                            >
                                {COUNTRY_OPTS.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <CollapsibleHead
                        label="Travel document"
                        optional
                        open={docOpen}
                        onToggle={() => setDocOpen((v) => !v)}
                    />
                    {docOpen && (
                        <>
                            <div className="ff-field-row cols-doc-num">
                                <div className="ff-field">
                                    <label>Type</label>
                                    <select
                                        value={active.docType}
                                        onChange={(e) => updateActive({ docType: e.target.value as PaxFormEntry['docType'] })}
                                    >
                                        <option value="P">Passport (P)</option>
                                        <option value="ID">National ID</option>
                                    </select>
                                </div>
                                <div className="ff-field">
                                    <label>Document number</label>
                                    <input
                                        type="text"
                                        value={active.docNumber}
                                        placeholder="e.g. S1234567"
                                        onChange={(e) => updateActive({ docNumber: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="ff-field-row cols-2">
                                <div className="ff-field">
                                    <label>Expiry date</label>
                                    <input
                                        type="date"
                                        value={active.docExpiry}
                                        onChange={(e) => updateActive({ docExpiry: e.target.value })}
                                    />
                                    <div className="helper">Must be valid at travel time</div>
                                </div>
                                <div className="ff-field">
                                    <label>Issuing country</label>
                                    <select
                                        value={active.docIssuingCountry}
                                        onChange={(e) => updateActive({ docIssuingCountry: e.target.value })}
                                    >
                                        {COUNTRY_OPTS.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    <CollapsibleHead
                        label="Loyalty & preferences"
                        optional
                        open={loyaltyOpen}
                        onToggle={() => setLoyaltyOpen((v) => !v)}
                    />
                    {loyaltyOpen && (
                        <>
                            <div className="ff-field-row cols-2">
                                <div className="ff-field">
                                    <label>FFP airline</label>
                                    <select
                                        value={active.ffpAirline || ''}
                                        onChange={(e) => updateActive({ ffpAirline: e.target.value })}
                                    >
                                        <option value="">Select…</option>
                                        <option value="LO">LO · Miles &amp; More</option>
                                        <option value="SQ">SQ · KrisFlyer</option>
                                        <option value="QR">QR · Privilege Club</option>
                                        <option value="EK">EK · Skywards</option>
                                    </select>
                                </div>
                                <div className="ff-field">
                                    <label>Frequent flyer number</label>
                                    <input
                                        type="text"
                                        value={active.ffpNumber || ''}
                                        placeholder="MM0123456789"
                                        onChange={(e) => updateActive({ ffpNumber: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="ff-field-row">
                                <div className="ff-field">
                                    <label>Special service request <span className="hint">SSR</span></label>
                                    <select
                                        value={active.ssr || ''}
                                        onChange={(e) => updateActive({ ssr: e.target.value })}
                                    >
                                        <option value="">None</option>
                                        <option value="VGML">VGML · Vegetarian meal</option>
                                        <option value="AVML">AVML · Asian vegetarian</option>
                                        <option value="HNML">HNML · Hindu meal</option>
                                        <option value="KSML">KSML · Kosher meal</option>
                                        <option value="WCHR">WCHR · Wheelchair assist</option>
                                        <option value="UMNR">UMNR · Unaccompanied minor</option>
                                    </select>
                                    <div className="helper">Sent to the airline as SSR · subject to availability</div>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="ff-checkbox-row">
                        <input
                            id={`ff-primary-${active.paxId}`}
                            type="checkbox"
                            checked={contact.isPrimary && activeIdx === 0}
                            onChange={(e) => setContact((c) => ({ ...c, isPrimary: e.target.checked }))}
                        />
                        <label htmlFor={`ff-primary-${active.paxId}`}>
                            This is the <b style={{ color: 'var(--ff-text)' }}>primary contact</b> for the booking
                        </label>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--ff-border)', background: 'var(--ff-surface-2)' }}>
                    <div style={{ padding: '12px 14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--ff-accent)' }}><PhoneIcon /></span>
                            Contact details
                        </div>
                        <div style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--ff-text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Booking confirmations
                        </div>
                    </div>
                    <div className="ff-form" style={{ padding: '12px 14px 14px' }}>
                        <div className="ff-field-row">
                            <div className="ff-field">
                                <label>Email address <span className="req">*</span></label>
                                <input
                                    type="email"
                                    value={contact.email}
                                    placeholder="your@email.com"
                                    onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                                />
                                <div className="helper">e-ticket &amp; itinerary will be sent here</div>
                            </div>
                        </div>
                        <div className="ff-field-row cols-phone">
                            <div className="ff-field">
                                <label>Country code <span className="req">*</span></label>
                                <select
                                    value={contact.countryCode}
                                    onChange={(e) => setContact((c) => ({ ...c, countryCode: e.target.value }))}
                                >
                                    {COUNTRY_CODE_OPTS.map((code) => (
                                        <option key={code} value={code}>{code}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ff-field">
                                <label>Mobile number <span className="req">*</span></label>
                                <input
                                    type="tel"
                                    value={contact.mobile}
                                    placeholder="10-digit number"
                                    onChange={(e) => setContact((c) => ({ ...c, mobile: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div style={{ padding: '0 14px 12px' }}>
                        <Alert tone="error">{error}</Alert>
                    </div>
                )}
            </div>

            <FareBreakupBar
                label={offer.brandName || offer.cabinClass || 'Selected fare'}
                currency={offer.currency}
                totalAmount={offer.totalAmount}
                paxBreakdown={offer.paxBreakdown}
                paxCounts={search.paxCounts}
                ctaLabel="Save & continue"
                onCta={onSubmit}
                secondaryLabel="← Back"
                onSecondary={onBack}
            />

            <Modal
                open={rulesOpen}
                onClose={() => setRulesOpen(false)}
                title={
                    <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                        </svg>
                        Fare rules
                    </>
                }
            >
                <FareRulesContent
                    rules={fareRules}
                    loading={fareRulesLoading}
                    error={fareRulesError}
                    onAskQuestion={onAskFareRuleQuestion}
                />
            </Modal>
        </>
    );
};

interface CollapsibleHeadProps {
    label: string;
    optional?: boolean;
    open: boolean;
    onToggle: () => void;
}

const CollapsibleHead: React.FC<CollapsibleHeadProps> = ({ label, optional, open, onToggle }) => (
    <button
        type="button"
        className="ff-collapsible-head"
        aria-expanded={open}
        onClick={onToggle}
    >
        <span className={`chev ${open ? 'open' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 6l6 6-6 6" />
            </svg>
        </span>
        {label}
        {optional && <span className="opt">Optional</span>}
    </button>
);
