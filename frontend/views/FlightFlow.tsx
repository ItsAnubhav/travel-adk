import React, { useMemo, useState } from 'react';

/**
 * Multi-step flight booking flow rendered inside the admin ResultView.
 *
 * Stages: results → passengers → price → rules → confirmed
 *
 * The chat tool (flight_search_tool) seeds stage="results"; every transition
 * after that is driven locally by user clicks and dispatches direct REST
 * calls to /api/flights/offer-price | fare-rule | order-create.
 */

type Money = { totalAmount: number; totalTaxAmount?: number; currency: string };

interface Segment {
  segmentID?: string;
  segmentSellKey?: string;
  flightNumber?: string;
  airlineCode?: string;
  airlineName?: string;
  aircraftType?: string;
  departureAirport?: string;
  departureCity?: string;
  departureTerminal?: string;
  departureDate?: string;
  departureTime?: string;
  arrivalAirport?: string;
  arrivalCity?: string;
  arrivalTerminal?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  duration?: string;
  stops?: number;
}

interface Leg {
  direction: 'OUT' | 'RET';
  departureAirport: string;
  departureCity?: string;
  departureDate?: string;
  departureTime?: string;
  arrivalAirport: string;
  arrivalCity?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  stops: number;
  stopAirports: string[];
  duration?: string;
  durationMinutes?: number;
  segments: Segment[];
}

interface FlightOffer {
  id: string;
  offerID: string;
  ownerId?: string;
  ownerCode?: string;
  validatingCarrierCode: string;
  airlineCode: string;
  airlineName: string;
  airlineLogo?: string;
  brandId?: string;
  brandName?: string;
  cabinClass?: string;
  fareType?: string;
  refundable?: boolean;
  price: Money;
  legs: Leg[];
  baggage?: string;
  raw_offer: any;
}

interface PaxCounts { adults: number; children: number; infants: number }

interface FlightSummary {
  origin: string;
  destination: string;
  depart_date: string;
  return_date?: string | null;
  trip_type: 'OW' | 'RT' | string;
  cabin?: string;
  pax: PaxCounts;
  currency: string;
  total_results: number;
}

export interface FlightFlowPayload {
  summary: FlightSummary;
  flights: FlightOffer[];
  metadata: Record<string, any>;
}

type TabKey = 'rt' | 'ow' | 'cheap' | 'fast' | 'nonstop';

const WEEKDAY: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
const MONTH: Record<number, string> = { 0: 'Jan', 1: 'Feb', 2: 'Mar', 3: 'Apr', 4: 'May', 5: 'Jun', 6: 'Jul', 7: 'Aug', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dec' };

function dayLabel(isoDate?: string): string {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d.getTime())) return isoDate;
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

function shortDate(isoDate?: string): string {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d.getTime())) return isoDate;
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

function splitMoney(n: number): { intPart: string; dec: string } {
  const fixed = Number(n).toFixed(2);
  const [i, d] = fixed.split('.');
  return { intPart: Number(i).toLocaleString(), dec: `.${d}` };
}

function dayOffset(depDate?: string, arrDate?: string): number {
  if (!depDate || !arrDate) return 0;
  const d1 = new Date(`${depDate}T00:00:00`);
  const d2 = new Date(`${arrDate}T00:00:00`);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  return Math.round((d2.getTime() - d1.getTime()) / (24 * 3600 * 1000));
}

// ─────────────────────────────────────────────────────────────────────
// Tab filtering
// ─────────────────────────────────────────────────────────────────────
function filterFlights(flights: FlightOffer[], tab: TabKey): FlightOffer[] {
  switch (tab) {
    case 'rt':
      return flights.filter((f) => f.legs.length >= 2);
    case 'ow':
      return flights.filter((f) => f.legs.length === 1);
    case 'cheap':
      return [...flights].sort((a, b) => a.price.totalAmount - b.price.totalAmount).slice(0, 5);
    case 'fast': {
      const totalDur = (f: FlightOffer) => f.legs.reduce((s, l) => s + (l.durationMinutes || 0), 0);
      return [...flights].sort((a, b) => totalDur(a) - totalDur(b)).slice(0, 5);
    }
    case 'nonstop':
      return flights.filter((f) => f.legs.every((l) => l.stops === 0));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Stage 1: Flight search results
// ─────────────────────────────────────────────────────────────────────
const ResultsStage: React.FC<{
  payload: FlightFlowPayload;
  onBook: (offer: FlightOffer) => void;
}> = ({ payload, onBook }) => {
  const { summary, flights } = payload;
  const isRT = summary.trip_type === 'RT' || (summary.return_date != null && summary.return_date !== '');
  const [tab, setTab] = useState<TabKey>(isRT ? 'rt' : 'ow');

  const tabFlights = useMemo(() => filterFlights(flights, tab), [flights, tab]);

  const paxParts = [
    summary.pax.adults && `${summary.pax.adults} ADT`,
    summary.pax.children && `${summary.pax.children} CHD`,
    summary.pax.infants && `${summary.pax.infants} INF`,
  ].filter(Boolean).join(', ');

  return (
    <div className="ff-panel">
      <div className="ff-bot-msg">
        <div className="ff-avatar"><PlaneIcon /></div>
        <div className="ff-bubble">
          Flights from <b>{summary.origin}</b> to <b>{summary.destination}</b> on{' '}
          <b>{shortDate(summary.depart_date)}</b>. Showing {tabFlights.length} option{tabFlights.length === 1 ? '' : 's'}.
        </div>
      </div>

      <div className="ff-search-summary">
        <div className="ff-route">
          <span>{summary.origin}</span>
          <span className="ff-arrow">{isRT ? '⇄' : '→'}</span>
          <span>{summary.destination}</span>
        </div>
        <div className="ff-detail">
          {shortDate(summary.depart_date)}
          {summary.return_date ? ` — ${shortDate(summary.return_date)}` : ''}
          {' · '}{paxParts || '1 ADT'}
        </div>
      </div>

      <div className="ff-tabs">
        {isRT && <FfTab active={tab === 'rt'} onClick={() => setTab('rt')} label="Round Trip" count={flights.filter((f) => f.legs.length >= 2).length} />}
        <FfTab active={tab === 'ow'} onClick={() => setTab('ow')} label="One Way" count={flights.filter((f) => f.legs.length === 1).length} />
        <FfTab active={tab === 'cheap'} onClick={() => setTab('cheap')} label="Cheapest" />
        <FfTab active={tab === 'fast'} onClick={() => setTab('fast')} label="Fastest" />
        <FfTab active={tab === 'nonstop'} onClick={() => setTab('nonstop')} label="Non-stop" count={flights.filter((f) => f.legs.every((l) => l.stops === 0)).length} />
      </div>

      <div className="ff-section-label">
        {tab === 'ow' ? `One Way · ${summary.origin} → ${summary.destination} · ${shortDate(summary.depart_date)}`
          : `${summary.origin} ${isRT ? '⇄' : '→'} ${summary.destination} · ${shortDate(summary.depart_date)}${summary.return_date ? ` – ${shortDate(summary.return_date)}` : ''}`}
      </div>

      {tabFlights.length === 0 ? (
        <div className="ff-empty">No flights match this filter.</div>
      ) : (
        tabFlights.map((f) => <FlightCard key={f.id} flight={f} onBook={() => onBook(f)} />)
      )}
    </div>
  );
};

const FfTab: React.FC<{ active: boolean; onClick: () => void; label: string; count?: number }> = ({ active, onClick, label, count }) => (
  <button className={`ff-tab ${active ? 'active' : ''}`} onClick={onClick} type="button">
    {label}{count != null ? <span className="ff-tab-count">{count}</span> : null}
  </button>
);

const FlightCard: React.FC<{ flight: FlightOffer; onBook: () => void }> = ({ flight, onBook }) => {
  const { intPart, dec } = splitMoney(flight.price.totalAmount);
  return (
    <article className="ff-card">
      <div className="ff-card-top">
        <div className="ff-airline-mark" style={airlineMarkStyle(flight.airlineCode)}>
          {flight.airlineCode}
        </div>
        <div className="ff-airline-info">
          <div className="ff-airline-name">
            {flight.airlineName}
            {flight.brandName ? <span className="ff-meta"> · {flight.brandName}</span> : null}
          </div>
          <div className="ff-badges">
            {flight.refundable && <span className="ff-badge refund">Refundable</span>}
            {flight.legs[0]?.stops === 0
              ? <span className="ff-badge nonstop">Non-stop</span>
              : <span className="ff-badge stop">{flight.legs[0]?.stops} stop · {flight.legs[0]?.stopAirports.join(',')}</span>}
            {flight.baggage && <span className="ff-badge">{flight.baggage}</span>}
          </div>
        </div>
        <div className="ff-price-action">
          <div className="ff-price">
            <span className="ff-cur">{flight.price.currency}</span>
            {intPart}
            <span className="ff-dec">{dec}</span>
          </div>
          <button className="ff-btn-primary" onClick={onBook} type="button">
            Book <ArrowIcon />
          </button>
        </div>
      </div>
      <div className="ff-legs">
        {flight.legs.map((leg, idx) => (
          <LegRow key={idx} leg={leg} isOnly={flight.legs.length === 1} />
        ))}
      </div>
    </article>
  );
};

const LegRow: React.FC<{ leg: Leg; isOnly: boolean }> = ({ leg, isOnly }) => {
  const first = leg.segments[0];
  const last = leg.segments[leg.segments.length - 1];
  const dirLabel = isOnly ? 'Dep' : leg.direction === 'OUT' ? 'Out' : 'Ret';
  const offset = dayOffset(first?.departureDate, last?.arrivalDate);
  const stopsText = leg.stops === 0 ? 'Non-stop' : `${leg.stops} stop · ${leg.stopAirports.join(', ')}`;
  return (
    <div className="ff-leg-row">
      <div className="ff-leg-dir">
        <span className="ff-dir">
          {leg.direction === 'OUT' ? <DirOutIcon /> : <DirRetIcon />} {dirLabel}
        </span>
        <span className="ff-day">{dayLabel(leg.departureDate)}</span>
      </div>
      <div className="ff-leg-route">
        <div className="ff-leg-ep">
          <div className="ff-time">{leg.departureTime || '—'}</div>
          <div className="ff-iata">{leg.departureAirport}{first?.departureTerminal ? ` · T${first.departureTerminal}` : ''}</div>
        </div>
        <div className="ff-leg-arrow">
          <span className="ff-ic"><PlaneIcon /></span>
        </div>
        <div className="ff-leg-ep r">
          <div className="ff-time">
            {leg.arrivalTime || '—'}
            {offset > 0 ? <span className="ff-plus">+{offset}</span> : null}
          </div>
          <div className="ff-iata">{leg.arrivalAirport}{last?.arrivalTerminal ? ` · T${last.arrivalTerminal}` : ''}</div>
        </div>
      </div>
      <div className="ff-leg-meta">
        <div className="ff-dur">{leg.duration || ''}</div>
        <div className="ff-stops">{leg.segments.map((s) => s.flightNumber).join(' / ') || stopsText}</div>
      </div>
    </div>
  );
};

function airlineMarkStyle(code: string): React.CSSProperties {
  const palette: Record<string, string> = {
    LO: '#003D87', SQ: '#1B3A5C', EK: '#D71921', AY: '#005E9E',
    BA: '#1E5BAA', AF: '#002157', LH: '#05164D', QR: '#5C0F25', SV: '#005C40',
  };
  return { background: palette[code] || '#111' };
}

// ─────────────────────────────────────────────────────────────────────
// Stage 2: Passenger details
// ─────────────────────────────────────────────────────────────────────
type DocType = 'P' | 'NID' | 'SEAMAN';

interface PaxForm {
  paxId: string;
  ptc: 'ADT' | 'CHD' | 'INF';
  title: string;
  givenName: string;
  middleName: string;
  surName: string;
  birthDate: string;
  genderCode: 'M' | 'F' | '';
  nationality: string;
  docType: DocType;
  docNumber: string;
  expiryDate: string;
  issuingCountry: string;
  ffpAirline: string;
  ffpNumber: string;
  specialRequest: string;
}

const emptyPax = (paxId: string, ptc: PaxForm['ptc']): PaxForm => ({
  paxId, ptc,
  title: ptc === 'ADT' ? 'MR' : 'MSTR',
  givenName: '', middleName: '', surName: '',
  birthDate: '', genderCode: '',
  nationality: 'IN',
  docType: 'P', docNumber: '', expiryDate: '', issuingCountry: 'IN',
  ffpAirline: '', ffpNumber: '', specialRequest: '',
});

function buildPaxList(counts: PaxCounts): PaxForm[] {
  const out: PaxForm[] = [];
  for (let i = 0; i < counts.adults; i++) out.push(emptyPax(`ADT${i + 1}`, 'ADT'));
  for (let i = 0; i < counts.children; i++) out.push(emptyPax(`CHD${i + 1}`, 'CHD'));
  for (let i = 0; i < counts.infants; i++) out.push(emptyPax(`INF${i + 1}`, 'INF'));
  return out;
}

function isPaxComplete(p: PaxForm): boolean {
  return !!(p.givenName && p.surName && p.birthDate && p.genderCode && p.docNumber && p.expiryDate);
}

const PassengerStage: React.FC<{
  offer: FlightOffer;
  summary: FlightSummary;
  onBack: () => void;
  onContinue: (pax: PaxForm[], contact: ContactForm) => void;
}> = ({ offer, summary, onBack, onContinue }) => {
  const [pax, setPax] = useState<PaxForm[]>(() => buildPaxList(summary.pax));
  const [active, setActive] = useState(0);
  const [contact, setContact] = useState<ContactForm>({ email: '', countryCode: '+91', mobile: '', isPrimary: true });
  const completed = pax.filter(isPaxComplete).length;

  const update = (idx: number, patch: Partial<PaxForm>) => {
    setPax((cur) => cur.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const cur = pax[active];
  const canSubmit = pax.every(isPaxComplete) && contact.email && contact.mobile;

  return (
    <div className="ff-panel">
      <div className="ff-bot-msg">
        <div className="ff-avatar"><PlaneIcon /></div>
        <div className="ff-bubble">Now I need passenger details. Use names as on passport.</div>
      </div>

      <div className="ff-progress">
        <div>
          <div className="ff-progress-step">Step 2 of 3</div>
          <div className="ff-progress-title">Passenger details</div>
        </div>
        <div className="ff-progress-dots">
          <span className="dot done" />
          <span className="dot active" />
          <span className="dot" />
        </div>
      </div>

      <TripSummaryBar offer={offer} summary={summary} />

      <div className="ff-card">
        <div className="ff-card-head">
          <span>Traveller information</span>
          <span className="ff-card-meta">{completed} of {pax.length} required</span>
        </div>

        <div className="ff-pax-tabs">
          {pax.map((p, idx) => (
            <button
              key={p.paxId}
              type="button"
              className={`ff-pax-tab ${idx === active ? 'active' : ''} ${isPaxComplete(p) ? 'done' : ''}`}
              onClick={() => setActive(idx)}
            >
              <span className="ff-pax-tab-icon">{isPaxComplete(p) ? <CheckIcon /> : idx + 1}</span>
              <span>{p.ptc === 'ADT' ? `Adult ${idx + 1}` : p.ptc === 'CHD' ? `Child ${idx - summary.pax.adults + 1}` : `Infant`}</span>
              <span className="ff-pax-tab-tag">{p.ptc}</span>
            </button>
          ))}
        </div>

        <div className="ff-form">
          <div className="ff-field-group-label">Identity</div>
          <div className="ff-row ff-cols-title-name">
            <Field label="Title">
              <select value={cur.title} onChange={(e) => update(active, { title: e.target.value })}>
                {(cur.ptc === 'ADT' ? ['MR', 'MS', 'MRS', 'DR'] : ['MSTR', 'MISS']).map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Given name"><input value={cur.givenName} onChange={(e) => update(active, { givenName: e.target.value })} /></Field>
            <Field label="Surname"><input value={cur.surName} onChange={(e) => update(active, { surName: e.target.value })} /></Field>
          </div>
          <Field label="Middle name (optional)">
            <input value={cur.middleName} onChange={(e) => update(active, { middleName: e.target.value })} />
          </Field>
          <div className="ff-row ff-cols-3">
            <Field label="Date of birth">
              <input type="date" value={cur.birthDate} onChange={(e) => update(active, { birthDate: e.target.value })} />
            </Field>
            <Field label="Gender">
              <select value={cur.genderCode} onChange={(e) => update(active, { genderCode: e.target.value as PaxForm['genderCode'] })}>
                <option value="">Select…</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </Field>
            <Field label="Nationality"><input value={cur.nationality} onChange={(e) => update(active, { nationality: e.target.value.toUpperCase() })} maxLength={2} placeholder="IN" /></Field>
          </div>

          <div className="ff-field-group-label">Travel document</div>
          <div className="ff-doc-toggle">
            {(['P', 'NID', 'SEAMAN'] as DocType[]).map((dt) => (
              <button key={dt} type="button" className={`ff-pill ${cur.docType === dt ? 'active' : ''}`} onClick={() => update(active, { docType: dt })}>
                {dt === 'P' ? 'Passport' : dt === 'NID' ? 'National ID' : 'Seaman book'}
              </button>
            ))}
          </div>
          <div className="ff-row ff-cols-2">
            <Field label="Document number"><input value={cur.docNumber} onChange={(e) => update(active, { docNumber: e.target.value })} /></Field>
            <Field label="Issuing country"><input value={cur.issuingCountry} maxLength={2} onChange={(e) => update(active, { issuingCountry: e.target.value.toUpperCase() })} placeholder="IN" /></Field>
          </div>
          <Field label="Expiry date" helper="Must be valid at travel time.">
            <input type="date" value={cur.expiryDate} onChange={(e) => update(active, { expiryDate: e.target.value })} />
          </Field>

          <div className="ff-field-group-label">Loyalty & preferences <span className="ff-optional">Optional</span></div>
          <div className="ff-row ff-cols-2">
            <Field label="FFP airline"><input value={cur.ffpAirline} maxLength={3} onChange={(e) => update(active, { ffpAirline: e.target.value.toUpperCase() })} placeholder="LO" /></Field>
            <Field label="FFP number"><input value={cur.ffpNumber} onChange={(e) => update(active, { ffpNumber: e.target.value })} /></Field>
          </div>
          <Field label="Special service request (SSR)" helper="Meals, wheelchair, etc.">
            <select value={cur.specialRequest} onChange={(e) => update(active, { specialRequest: e.target.value })}>
              <option value="">None</option>
              <option value="VGML">Vegetarian Meal (VGML)</option>
              <option value="WCHR">Wheelchair (WCHR)</option>
              <option value="BBML">Baby Meal (BBML)</option>
            </select>
          </Field>

          <div className="ff-field-group-label">Primary contact</div>
          <Field label="Email">
            <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
          </Field>
          <div className="ff-row ff-cols-phone">
            <Field label="Country code"><input value={contact.countryCode} onChange={(e) => setContact({ ...contact, countryCode: e.target.value })} /></Field>
            <Field label="Mobile number"><input value={contact.mobile} onChange={(e) => setContact({ ...contact, mobile: e.target.value })} /></Field>
          </div>
        </div>

        <div className="ff-foot-actions">
          <button type="button" className="ff-btn-ghost" onClick={onBack}>← Back</button>
          <button type="button" className="ff-btn-primary ff-btn-grow" disabled={!canSubmit} onClick={() => onContinue(pax, contact)}>
            Save & continue <ArrowIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

interface ContactForm { email: string; countryCode: string; mobile: string; isPrimary: boolean }

const Field: React.FC<{ label: string; helper?: string; children: React.ReactNode }> = ({ label, helper, children }) => (
  <label className="ff-field">
    <span className="ff-field-label">{label}</span>
    {children}
    {helper && <span className="ff-field-helper">{helper}</span>}
  </label>
);

const TripSummaryBar: React.FC<{ offer: FlightOffer; summary: FlightSummary }> = ({ offer, summary }) => {
  const { intPart, dec } = splitMoney(offer.price.totalAmount);
  const paxCount = summary.pax.adults + summary.pax.children + summary.pax.infants;
  return (
    <div className="ff-trip-bar">
      <div className="ff-trip-bar-left">
        <div className="ff-trip-bar-icon"><PlaneIcon /></div>
        <div>
          <div className="ff-trip-bar-title">
            {summary.origin} {summary.return_date ? '⇄' : '→'} {summary.destination} · {shortDate(summary.depart_date)}{summary.return_date ? ` – ${shortDate(summary.return_date)}` : ''} · {offer.airlineCode}
          </div>
          <div className="ff-trip-bar-sub">{paxCount} passenger{paxCount !== 1 ? 's' : ''} · {offer.cabinClass || 'Economy'}</div>
        </div>
      </div>
      <div className="ff-trip-bar-right">
        <div className="ff-trip-bar-total-label">Total</div>
        <div className="ff-price">
          <span className="ff-cur">{offer.price.currency}</span>{intPart}<span className="ff-dec">{dec}</span>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Stage 3: Offer price (live priced offer)
// ─────────────────────────────────────────────────────────────────────
const PriceStage: React.FC<{
  offer: FlightOffer;
  summary: FlightSummary;
  pax: PaxForm[];
  contact: ContactForm;
  loading: boolean;
  pricedOffer: any | null;
  error: string | null;
  onBack: () => void;
  onShowRules: () => void;
  onConfirm: () => void;
}> = ({ offer, summary, loading, pricedOffer, error, onBack, onShowRules, onConfirm }) => {
  // Pull priced totals when available, fall back to offer totals.
  const priced = pricedOffer?.offerPriceRS?.response?.PricedOffer;
  const fareDetail = priced?.offerItem?.fareDetail?.[0] || offer.raw_offer?.offerItem?.fareDetail?.[0];
  const fareComp = fareDetail?.fareComponent;
  const total = Number(fareComp?.price?.totalAmount ?? offer.price.totalAmount);
  const tax = Number(fareComp?.price?.totalTaxAmount ?? offer.price.totalTaxAmount ?? 0);
  const base = total - tax;
  const { intPart, dec } = splitMoney(total);

  return (
    <div className="ff-panel">
      <div className="ff-bot-msg">
        <div className="ff-avatar"><PlaneIcon /></div>
        <div className="ff-bubble">
          Offer price confirmed with <b>{offer.airlineName}</b>. Review the fare before payment.
        </div>
      </div>

      <div className="ff-match-banner">
        <div className="ff-check"><CheckIcon /></div>
        <div>
          <b>Price matched</b> · offer locked at <span className="ff-mono">{offer.offerID}</span>
        </div>
        <div className="ff-timer">{loading ? 'pricing…' : 'live'}</div>
      </div>

      {error && <div className="ff-error">{error}</div>}

      <div className="ff-card">
        <div className="ff-card-head">
          <span>Priced offer</span>
          <span className="ff-card-meta ff-mono">{offer.offerID} · {offer.airlineCode}</span>
        </div>
        <div className="ff-priced-legs">
          {offer.legs.map((leg, i) => (
            <div key={i} className="ff-priced-leg">
              <span className="ff-leg-tag">{leg.direction === 'OUT' ? 'Out' : 'Ret'}</span>
              <span className="ff-mono">
                {leg.departureAirport} → {leg.arrivalAirport}
                {leg.stopAirports.length > 0 ? ` (via ${leg.stopAirports.join(', ')})` : ''}
              </span>
              <span className="ff-sub">{dayLabel(leg.departureDate)} · {leg.departureTime}</span>
            </div>
          ))}
        </div>

        <div className="ff-fare-breakdown">
          <div className="ff-fare-row">
            <span>Base fare</span>
            <span className="ff-mono">{offer.price.currency} {base.toFixed(2)}</span>
          </div>
          <div className="ff-fare-row">
            <span>Taxes & fees</span>
            <span className="ff-mono">{offer.price.currency} {tax.toFixed(2)}</span>
          </div>
          <div className="ff-fare-total">
            <span>Total payable</span>
            <span className="ff-price">
              <span className="ff-cur">{offer.price.currency}</span>{intPart}<span className="ff-dec">{dec}</span>
            </span>
          </div>
        </div>

        <div className="ff-foot-actions">
          <button type="button" className="ff-btn-ghost" onClick={onBack}>← Back</button>
          <button type="button" className="ff-btn-ghost" onClick={onShowRules}>View fare rules</button>
          <button type="button" className="ff-btn-primary ff-btn-grow" disabled={loading} onClick={onConfirm}>
            Continue to payment <ArrowIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Stage 4: Fare rules
// ─────────────────────────────────────────────────────────────────────
const RulesStage: React.FC<{
  offer: FlightOffer;
  loading: boolean;
  ruleData: any | null;
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
}> = ({ offer, loading, ruleData, error, onBack, onContinue }) => {
  const sectors = (ruleData?.fareRuleRS?.response?.ruleInfo as any[]) || [];

  return (
    <div className="ff-panel">
      <div className="ff-bot-msg">
        <div className="ff-avatar"><PlaneIcon /></div>
        <div className="ff-bubble">Fare rules for {offer.airlineName} · {offer.cabinClass}.</div>
      </div>

      {error && <div className="ff-error">{error}</div>}
      {loading && <div className="ff-empty">Loading fare rules…</div>}

      {!loading && sectors.map((sector: any, idx: number) => (
        <div key={idx} className="ff-card">
          <div className="ff-card-head">
            <span>{sector.title}</span>
          </div>
          <div className="ff-rules-body">
            {(sector.description as any[]).map((rule: any, i: number) => (
              <div key={i} className="ff-rule-row">
                <span className="ff-rule-title">{rule.title}</span>
                <span className="ff-rule-value">{rule.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="ff-foot-actions">
        <button type="button" className="ff-btn-ghost" onClick={onBack}>← Back</button>
        <button type="button" className="ff-btn-primary ff-btn-grow" onClick={onContinue}>Got it, continue <ArrowIcon /></button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Stage 5: Order confirmation
// ─────────────────────────────────────────────────────────────────────
const ConfirmedStage: React.FC<{
  offer: FlightOffer;
  pax: PaxForm[];
  contact: ContactForm;
  orderData: any | null;
  loading: boolean;
  error: string | null;
}> = ({ offer, pax, contact, orderData, loading, error }) => {
  const order = orderData?.orderViewRS?.response?.order?.[0];
  const pnr = order?.orderID || 'PENDING';
  const status = order?.statusCode || (loading ? 'PROCESSING' : 'FAILED');

  if (loading) {
    return <div className="ff-panel"><div className="ff-empty">Creating order…</div></div>;
  }
  if (error) {
    return <div className="ff-panel"><div className="ff-error">{error}</div></div>;
  }

  return (
    <div className="ff-panel">
      <div className="ff-bot-msg">
        <div className="ff-avatar success"><CheckIcon /></div>
        <div className="ff-bubble">
          Booking confirmed. PNR <span className="ff-mono ff-pnr-chip">{pnr}</span> emailed to <b>{contact.email}</b>.
        </div>
      </div>

      <div className="ff-pnr-hero">
        <div className="ff-pnr-hero-top">
          <span className="ff-live-dot" /> Booking confirmed
          <span className="ff-status-chip">{status} · {status === 'HK' ? 'Held confirmed' : status}</span>
        </div>
        <div className="ff-pnr-record">{pnr}</div>
        <div className="ff-pnr-meta">
          <div><span className="ff-pnr-label">Carrier</span><span className="ff-mono">{offer.airlineCode} · {offer.airlineName}</span></div>
          <div><span className="ff-pnr-label">Owner</span><span className="ff-mono">{offer.ownerCode || '—'}</span></div>
          <div><span className="ff-pnr-label">Passengers</span><span className="ff-mono">{pax.length}</span></div>
        </div>
      </div>

      <div className="ff-card">
        <div className="ff-card-head">
          <span>Passengers</span>
          <span className="ff-card-meta">{pax.length} traveller{pax.length === 1 ? '' : 's'}</span>
        </div>
        {pax.map((p) => (
          <div key={p.paxId} className="ff-pax-row">
            <div className="ff-pax-mono">{(p.givenName[0] || '') + (p.surName[0] || '')}</div>
            <div className="ff-pax-info">
              <div>{p.title} {p.givenName} {p.surName}</div>
              <div className="ff-sub ff-mono">
                {p.birthDate} · {p.genderCode} · Passport {p.docNumber} · {p.issuingCountry} · exp {p.expiryDate}
              </div>
            </div>
            <span className={`ff-pax-tag ${p.ptc === 'ADT' ? 'info' : 'accent'}`}>{p.ptc}</span>
          </div>
        ))}
      </div>

      <div className="ff-card">
        <div className="ff-card-head">
          <span>Itinerary</span>
          <span className="ff-card-meta">{offer.legs.reduce((s, l) => s + l.segments.length, 0)} segments · {offer.airlineCode}</span>
        </div>
        {offer.legs.flatMap((leg) => leg.segments).map((seg, idx) => (
          <div key={idx} className="ff-seg">
            <div className="ff-seg-head">
              <span className="ff-mono">{seg.flightNumber}</span>
              <span className="ff-sub ff-mono">· SEG {idx + 1} · {seg.aircraftType}</span>
              <span className="ff-sub" style={{ marginLeft: 'auto' }}>{dayLabel(seg.departureDate)}</span>
            </div>
            <div className="ff-seg-row">
              <div className="ff-seg-ep">
                <div className="ff-time">{seg.departureTime}</div>
                <div className="ff-sub ff-mono">{seg.departureAirport}{seg.departureTerminal ? ` · T${seg.departureTerminal}` : ''}</div>
              </div>
              <div className="ff-leg-arrow"><span className="ff-ic"><PlaneIcon /></span></div>
              <div className="ff-seg-ep r">
                <div className="ff-time">{seg.arrivalTime}</div>
                <div className="ff-sub ff-mono">{seg.arrivalAirport}{seg.arrivalTerminal ? ` · T${seg.arrivalTerminal}` : ''}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="ff-card">
        <div className="ff-card-head"><span>Contact</span></div>
        <div className="ff-contact-row"><MailIcon /><span className="ff-sub">Email</span><span className="ff-mono">{contact.email}</span></div>
        <div className="ff-contact-row"><PhoneIcon /><span className="ff-sub">Phone</span><span className="ff-mono">{contact.countryCode} {contact.mobile}</span></div>
      </div>

      <div className="ff-total-card">
        <div>
          <div className="ff-sub">Total charged</div>
          <div className="ff-sub ff-mono">{pnr} · {offer.airlineCode}</div>
        </div>
        <div className="ff-price">
          <span className="ff-cur">{offer.price.currency}</span>
          {splitMoney(offer.price.totalAmount).intPart}
          <span className="ff-dec">{splitMoney(offer.price.totalAmount).dec}</span>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Helpers: build NDC request bodies from local state
// ─────────────────────────────────────────────────────────────────────
function buildOfferPriceBody(offer: FlightOffer, summary: FlightSummary): any {
  return {
    offerPriceRQ: {
      request: {
        dataLists: {
          paxList: {
            Adult: summary.pax.adults,
            Child: summary.pax.children,
            Infant: summary.pax.infants,
            Youth: 0, Senior: 0,
            pax: buildPaxRefs(summary.pax),
          },
          priceClassList: { priceClass: { cabinType: { cabinTypeCode: 'EC' } } },
        },
        paymentFunctions: [
          { paymentMethodCriteria: { paymentTypeCode: 'CC' } },
          { paymentMethodCriteria: { paymentTypeCode: 'CA' } },
        ],
        pricedOffer: { selectedOfferList: { selectedOffer: [offer.raw_offer] } },
      },
    },
  };
}

function buildFareRuleBody(offer: FlightOffer): any {
  return {
    fareRuleRQ: {
      request: [
        { fareMatch: true, ...offer.raw_offer },
      ],
    },
  };
}

function buildOrderCreateBody(offer: FlightOffer, pax: PaxForm[], contact: ContactForm, summary: FlightSummary): any {
  return {
    orderCreateRQ: {
      request: {
        dataLists: {
          contactInfoList: {
            contactInfo: [
              {
                contactInfoID: 'C1',
                contactTypeText: '',
                emailAddress: { emailAddressText: contact.email },
                phone: [{ labelText: '', phoneNumber: contact.mobile, countryDialingCode: contact.countryCode }],
                postalAddress: [{ buildingRoomText: '', streetText: '', postalCode: '', cityName: '', countryCode: '' }],
              },
            ],
          },
          paxList: {
            pax: pax.map((p) => ({
              paxId: p.paxId,
              ptc: p.ptc,
              ...(p.ptc === 'INF' ? { PaxRefID: 'ADT1' } : {}),
              individual: {
                givenName: p.givenName,
                middleName: p.middleName,
                surName: p.surName,
                titleName: p.title,
                genderCode: p.genderCode,
                birthDate: p.birthDate,
              },
              contactInfoRefID: 'C1',
              foid: { foidTypeCode: '', foidID: '' },
              specialRequest: p.specialRequest,
              loyaltyProgramAccount: {
                accountNumber: p.ffpNumber,
                loyaltyProgram: { carrier: { airlineDesigCode: p.ffpAirline } },
              },
              identityDoc: [{
                citizenshipCountryCode: p.nationality,
                expiryDate: p.expiryDate,
                identityDocID: p.docNumber,
                identityDocTypeCode: p.docType,
                issuingCountryCode: p.issuingCountry,
                residenceCountryCode: p.nationality,
              }],
            })),
          },
        },
        createOrder: {
          acceptSelectedQuotedOfferList: {
            selectedPricedOffer: [offer.raw_offer],
          },
        },
      },
    },
  };
}

function buildPaxRefs(counts: PaxCounts): any[] {
  const out: any[] = [];
  let idx = 0;
  for (let i = 0; i < counts.adults; i++) { idx++; out.push({ paxId: `PAX${idx}`, ptc: 'ADT' }); }
  for (let i = 0; i < counts.children; i++) { idx++; out.push({ paxId: `PAX${idx}`, ptc: 'CHD' }); }
  for (let i = 0; i < counts.infants; i++) { idx++; out.push({ paxId: `PAX${idx}`, ptc: 'INF' }); }
  return out;
}

async function postJson(url: string, body: any): Promise<any> {
  const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken') || '';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.json())?.detail; } catch { /* ignore */ }
    throw new Error(detail || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ─────────────────────────────────────────────────────────────────────
// Root container
// ─────────────────────────────────────────────────────────────────────
type Stage = 'results' | 'passengers' | 'price' | 'rules' | 'confirmed';

export const FlightFlowView: React.FC<{ payload: FlightFlowPayload }> = ({ payload }) => {
  const [stage, setStage] = useState<Stage>('results');
  const [offer, setOffer] = useState<FlightOffer | null>(null);
  const [pax, setPax] = useState<PaxForm[]>([]);
  const [contact, setContact] = useState<ContactForm>({ email: '', countryCode: '+91', mobile: '', isPrimary: true });
  const [priced, setPriced] = useState<any | null>(null);
  const [pricedLoading, setPricedLoading] = useState(false);
  const [pricedError, setPricedError] = useState<string | null>(null);
  const [rules, setRules] = useState<any | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const onBook = (o: FlightOffer) => {
    setOffer(o);
    setStage('passengers');
  };

  const onContinueFromPax = async (paxList: PaxForm[], c: ContactForm) => {
    setPax(paxList);
    setContact(c);
    setStage('price');
    if (!offer) return;
    setPricedLoading(true);
    setPricedError(null);
    try {
      const result = await postJson('/api/flights/offer-price', buildOfferPriceBody(offer, payload.summary));
      setPriced(result);
    } catch (e: any) {
      setPricedError(e.message || 'Failed to price offer');
    } finally {
      setPricedLoading(false);
    }
  };

  const onShowRules = async () => {
    if (!offer) return;
    setStage('rules');
    setRulesLoading(true);
    setRulesError(null);
    try {
      const result = await postJson('/api/flights/fare-rule', buildFareRuleBody(offer));
      setRules(result);
    } catch (e: any) {
      setRulesError(e.message || 'Failed to fetch fare rules');
    } finally {
      setRulesLoading(false);
    }
  };

  const onConfirmBooking = async () => {
    if (!offer) return;
    setStage('confirmed');
    setOrderLoading(true);
    setOrderError(null);
    try {
      const result = await postJson('/api/flights/order-create', buildOrderCreateBody(offer, pax, contact, payload.summary));
      setOrder(result);
    } catch (e: any) {
      setOrderError(e.message || 'Failed to create order');
    } finally {
      setOrderLoading(false);
    }
  };

  return (
    <div className="ff-root">
      <FlightFlowStyles />
      {stage === 'results' && <ResultsStage payload={payload} onBook={onBook} />}
      {stage === 'passengers' && offer && (
        <PassengerStage offer={offer} summary={payload.summary} onBack={() => setStage('results')} onContinue={onContinueFromPax} />
      )}
      {stage === 'price' && offer && (
        <PriceStage
          offer={offer}
          summary={payload.summary}
          pax={pax}
          contact={contact}
          loading={pricedLoading}
          pricedOffer={priced}
          error={pricedError}
          onBack={() => setStage('passengers')}
          onShowRules={onShowRules}
          onConfirm={onConfirmBooking}
        />
      )}
      {stage === 'rules' && offer && (
        <RulesStage
          offer={offer}
          loading={rulesLoading}
          ruleData={rules}
          error={rulesError}
          onBack={() => setStage('price')}
          onContinue={() => setStage('price')}
        />
      )}
      {stage === 'confirmed' && offer && (
        <ConfirmedStage
          offer={offer}
          pax={pax}
          contact={contact}
          orderData={order}
          loading={orderLoading}
          error={orderError}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Inline icons (kept simple to avoid extra imports)
// ─────────────────────────────────────────────────────────────────────
const PlaneIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
    <path d="M22 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S11 2.67 11 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5l8 2.5z" />
  </svg>
);
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const DirOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);
const DirRetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10">
    <path d="M17 7L7 17M15 17H7V9" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="12" height="12">
    <path d="M5 12l5 5L20 7" />
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />
  </svg>
);
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M22 16.92V21a2 2 0 0 1-2.18 2A19.86 19.86 0 0 1 1 4.18 2 2 0 0 1 3 2h4.09a2 2 0 0 1 2 1.72 12.06 12.06 0 0 0 .57 2.57 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.51-1.3a2 2 0 0 1 2.11-.45 12.06 12.06 0 0 0 2.57.57 2 2 0 0 1 1.72 2z" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────
// Styles (scoped via .ff-root)
// ─────────────────────────────────────────────────────────────────────
const FlightFlowStyles: React.FC = () => (
  <style>{`
    .ff-root {
      --bg: #F6F5F1;
      --surface: #FFF;
      --surface-2: #FAF9F6;
      --border: #E7E5E0;
      --border-strong: #D6D3CC;
      --text: #0F0F0E;
      --text-2: #44403C;
      --text-3: #78716C;
      --text-4: #A8A29E;
      --primary: #111;
      --primary-hover: #2A2A2A;
      --primary-text: #FFF;
      --accent: #C2410C;
      --accent-soft: #FEF3EC;
      --success: #15803D;
      --success-soft: #ECFDF5;
      --info: #1D4ED8;
      --info-soft: #EFF6FF;
      --warn: #B45309;
      --warn-soft: #FEF3C7;
      --danger: #B91C1C;
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text);
      font-size: 13px;
      line-height: 1.45;
    }
    .ff-root * { box-sizing: border-box; }
    .ff-mono { font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; letter-spacing: 0.02em; }
    .ff-sub { color: var(--text-3); font-size: 11.5px; }

    .ff-panel { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }

    .ff-bot-msg { display: flex; gap: 8px; align-items: flex-start; }
    .ff-avatar {
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--primary); color: var(--primary-text);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .ff-avatar.success { background: var(--success); }
    .ff-bubble {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      border-top-left-radius: 4px; padding: 8px 12px; color: var(--text-2); flex: 1;
    }
    .ff-bubble b { color: var(--text); font-weight: 600; }

    .ff-search-summary {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 10px 12px; display: flex; align-items: center; justify-content: space-between;
    }
    .ff-route { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; }
    .ff-route .ff-arrow { color: var(--text-3); font-size: 14px; }
    .ff-detail { color: var(--text-3); font-family: 'Geist Mono', monospace; font-size: 11px; }

    .ff-tabs { display: flex; gap: 5px; flex-wrap: wrap; }
    .ff-tab {
      background: transparent; border: 1px solid var(--border); color: var(--text-3);
      padding: 4px 10px; font-size: 11.5px; border-radius: 100px; cursor: pointer; font-weight: 500;
    }
    .ff-tab.active { background: var(--primary); color: var(--primary-text); border-color: var(--primary); }
    .ff-tab-count { font-family: 'Geist Mono', monospace; font-size: 10px; margin-left: 4px; opacity: 0.7; }

    .ff-section-label {
      display: flex; align-items: center; gap: 8px;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); padding: 4px 2px;
    }
    .ff-section-label::before, .ff-section-label::after { content: ''; height: 1px; flex: 1; background: var(--border); }

    .ff-empty { color: var(--text-3); font-size: 12px; padding: 16px; text-align: center; border: 1px dashed var(--border); border-radius: 10px; }
    .ff-error { background: #FEE2E2; color: var(--danger); border: 1px solid #FCA5A5; padding: 8px 12px; border-radius: 8px; font-size: 12px; }

    /* Flight cards */
    .ff-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
    }
    .ff-card-head {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 10px 14px; background: var(--surface-2); border-bottom: 1px solid var(--border);
      font-weight: 600; font-size: 13px;
    }
    .ff-card-meta { color: var(--text-3); font-size: 11.5px; font-weight: 500; font-family: 'Geist Mono', monospace; }

    .ff-card-top {
      display: grid; grid-template-columns: 32px 1fr auto; gap: 10px; padding: 10px 12px 8px; align-items: center;
    }
    .ff-airline-mark {
      width: 32px; height: 32px; border-radius: 7px; background: var(--primary); color: var(--primary-text);
      display: flex; align-items: center; justify-content: center; font-weight: 600;
      font-size: 10.5px; letter-spacing: 0.04em; font-family: 'Geist Mono', monospace;
    }
    .ff-airline-info { min-width: 0; }
    .ff-airline-name { font-weight: 500; font-size: 12.5px; }
    .ff-airline-name .ff-meta { color: var(--text-3); font-weight: 400; }
    .ff-badges { display: flex; gap: 5px; margin-top: 3px; flex-wrap: wrap; }
    .ff-badge {
      font-family: 'Geist Mono', monospace; font-size: 9.5px; padding: 2px 6px;
      border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border);
      color: var(--text-3); letter-spacing: 0.04em; font-weight: 500; white-space: nowrap;
    }
    .ff-badge.refund { background: var(--success-soft); color: var(--success); border-color: rgba(21,128,61,0.15); }
    .ff-badge.stop { background: var(--accent-soft); color: var(--accent); border-color: rgba(194,65,12,0.15); }
    .ff-badge.nonstop { background: var(--info-soft); color: var(--info); border-color: rgba(29,78,216,0.15); }

    .ff-price-action { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .ff-price { font-size: 17px; font-weight: 600; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
    .ff-cur { font-size: 9.5px; color: var(--text-3); font-weight: 500; margin-right: 2px; vertical-align: 4px; font-family: 'Geist Mono', monospace; letter-spacing: 0.04em; }
    .ff-dec { font-size: 12px; color: var(--text-3); font-weight: 500; }

    .ff-btn-primary {
      background: var(--primary); color: var(--primary-text); border: none;
      padding: 5px 12px 5px 14px; font-size: 12px; font-weight: 500; border-radius: 6px; cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
      transition: background 0.15s, transform 0.1s;
    }
    .ff-btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .ff-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .ff-btn-grow { flex: 1; justify-content: center; }
    .ff-btn-ghost {
      background: transparent; color: var(--text-2); border: 1px solid var(--border);
      padding: 6px 14px; font-size: 12px; font-weight: 500; border-radius: 6px; cursor: pointer;
    }

    .ff-legs { border-top: 1px solid var(--border); background: var(--surface-2); }
    .ff-leg-row {
      display: grid; grid-template-columns: 52px 1fr auto; gap: 10px; padding: 7px 12px;
      align-items: center; border-bottom: 1px dashed var(--border);
    }
    .ff-leg-row:last-child { border-bottom: 0; }
    .ff-leg-dir { display: flex; flex-direction: column; }
    .ff-dir {
      font-family: 'Geist Mono', monospace; font-size: 9.5px; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--text-3); font-weight: 600;
      display: inline-flex; align-items: center; gap: 3px;
    }
    .ff-day { font-family: 'Geist Mono', monospace; font-size: 10.5px; color: var(--text-2); font-weight: 500; margin-top: 2px; }
    .ff-leg-route { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; min-width: 0; }
    .ff-leg-ep .ff-time { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .ff-plus { font-size: 9px; color: var(--accent); vertical-align: super; margin-left: 2px; font-weight: 500; }
    .ff-leg-ep .ff-iata { font-size: 10.5px; color: var(--text-3); margin-top: 2px; font-family: 'Geist Mono', monospace; letter-spacing: 0.05em; }
    .ff-leg-ep.r { text-align: right; }
    .ff-leg-arrow { position: relative; width: 36px; height: 1px; background: var(--border-strong); }
    .ff-leg-arrow::before, .ff-leg-arrow::after {
      content: ''; position: absolute; top: 50%; width: 3px; height: 3px;
      border-radius: 50%; background: var(--text-4); transform: translateY(-50%);
    }
    .ff-leg-arrow::before { left: 0; }
    .ff-leg-arrow::after { right: 0; }
    .ff-leg-arrow .ff-ic {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 16px; height: 16px; background: var(--surface-2); display: flex;
      align-items: center; justify-content: center; color: var(--text-2);
    }
    .ff-leg-meta { font-family: 'Geist Mono', monospace; font-size: 10.5px; color: var(--text-3); text-align: right; white-space: nowrap; }
    .ff-leg-meta .ff-dur { color: var(--text); font-weight: 500; }

    /* Progress + trip bar */
    .ff-progress {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;
    }
    .ff-progress-step { font-family: 'Geist Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-3); }
    .ff-progress-title { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .ff-progress-dots { display: flex; gap: 6px; }
    .ff-progress-dots .dot { width: 18px; height: 4px; border-radius: 2px; background: var(--border); }
    .ff-progress-dots .dot.done { background: var(--success); }
    .ff-progress-dots .dot.active { background: var(--primary); }

    .ff-trip-bar {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .ff-trip-bar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .ff-trip-bar-icon { width: 32px; height: 32px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); display: flex; align-items: center; justify-content: center; }
    .ff-trip-bar-title { font-size: 12.5px; font-weight: 600; }
    .ff-trip-bar-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .ff-trip-bar-right { text-align: right; }
    .ff-trip-bar-total-label { font-family: 'Geist Mono', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); }

    /* Pax tabs */
    .ff-pax-tabs { display: flex; gap: 4px; padding: 10px 14px 0; flex-wrap: wrap; }
    .ff-pax-tab {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 10px; font-size: 11.5px; border: 1px solid var(--border);
      border-radius: 8px; background: var(--surface); cursor: pointer; color: var(--text-2);
    }
    .ff-pax-tab.active { background: var(--primary); color: var(--primary-text); border-color: var(--primary); }
    .ff-pax-tab.done .ff-pax-tab-icon { background: var(--success); color: #fff; }
    .ff-pax-tab-icon { width: 16px; height: 16px; border-radius: 50%; background: var(--surface-2); color: var(--text-3); display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; }
    .ff-pax-tab.active .ff-pax-tab-icon { background: rgba(255,255,255,0.2); color: #fff; }
    .ff-pax-tab-tag {
      font-family: 'Geist Mono', monospace; font-size: 9.5px; padding: 1px 5px; border-radius: 4px;
      background: var(--surface-2); color: var(--text-3); border: 1px solid var(--border);
    }
    .ff-pax-tab.active .ff-pax-tab-tag { background: rgba(255,255,255,0.15); color: #fff; border-color: transparent; }

    /* Form */
    .ff-form { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
    .ff-field-group-label {
      font-family: 'Geist Mono', monospace; font-size: 10px; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--text-3); border-top: 1px solid var(--border);
      padding-top: 10px; margin-top: 4px;
    }
    .ff-field-group-label:first-child { border-top: 0; padding-top: 0; margin-top: 0; }
    .ff-optional { color: var(--text-4); margin-left: 6px; font-weight: 400; }
    .ff-row { display: grid; gap: 10px; }
    .ff-cols-2 { grid-template-columns: 1fr 1fr; }
    .ff-cols-3 { grid-template-columns: 1fr 1fr 1fr; }
    .ff-cols-title-name { grid-template-columns: 80px 1fr 1fr; }
    .ff-cols-phone { grid-template-columns: 100px 1fr; }
    .ff-field { display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; }
    .ff-field-label { color: var(--text-3); font-size: 11px; font-weight: 500; }
    .ff-field-helper { color: var(--text-4); font-size: 10.5px; }
    .ff-field input, .ff-field select {
      padding: 7px 10px; font-size: 13px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--surface); color: var(--text); font-family: inherit;
    }
    .ff-field input:focus, .ff-field select:focus { outline: none; border-color: var(--primary); }
    .ff-doc-toggle { display: flex; gap: 4px; }
    .ff-pill {
      padding: 5px 12px; font-size: 11.5px; border: 1px solid var(--border); border-radius: 100px;
      background: var(--surface); cursor: pointer; color: var(--text-2);
    }
    .ff-pill.active { background: var(--primary); color: var(--primary-text); border-color: var(--primary); }

    .ff-foot-actions { display: flex; gap: 8px; padding: 10px 14px 14px; border-top: 1px solid var(--border); }

    /* Price-stage */
    .ff-match-banner {
      background: linear-gradient(135deg, var(--success-soft), var(--surface));
      border: 1px solid rgba(21,128,61,0.15); border-radius: 12px; padding: 10px 14px;
      display: flex; align-items: center; gap: 10px; font-size: 12.5px;
    }
    .ff-check {
      width: 26px; height: 26px; border-radius: 50%; background: var(--success);
      color: #fff; display: flex; align-items: center; justify-content: center;
    }
    .ff-match-banner b { color: var(--success); font-weight: 600; }
    .ff-timer { margin-left: auto; font-family: 'Geist Mono', monospace; font-size: 11px; color: var(--text-3); background: var(--surface); border: 1px solid var(--border); padding: 3px 8px; border-radius: 6px; }
    .ff-priced-legs { padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--border); }
    .ff-priced-leg { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
    .ff-leg-tag {
      font-family: 'Geist Mono', monospace; font-size: 9.5px; padding: 2px 6px;
      border-radius: 5px; background: var(--accent-soft); color: var(--accent); font-weight: 600; text-transform: uppercase;
    }
    .ff-fare-breakdown { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
    .ff-fare-row { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--text-2); }
    .ff-fare-total { display: flex; justify-content: space-between; align-items: baseline; padding-top: 8px; border-top: 1px dashed var(--border); font-weight: 600; font-size: 13.5px; }

    /* Rules */
    .ff-rules-body { padding: 8px 14px 14px; display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
    .ff-rule-row { display: grid; grid-template-columns: 200px 1fr; gap: 8px; font-size: 11.5px; padding: 4px 0; border-bottom: 1px dashed var(--border); }
    .ff-rule-row:last-child { border-bottom: 0; }
    .ff-rule-title { color: var(--text-3); font-family: 'Geist Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; }
    .ff-rule-value { color: var(--text); white-space: pre-line; }

    /* PNR hero */
    .ff-pnr-hero {
      background: linear-gradient(135deg, #0F172A, #1E293B);
      color: #FFF; border-radius: 14px; padding: 18px 20px; position: relative; overflow: hidden;
    }
    .ff-pnr-hero-top { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.85); }
    .ff-live-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ADE80; box-shadow: 0 0 0 4px rgba(74,222,128,0.18); animation: ff-pulse 1.4s infinite; }
    @keyframes ff-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .ff-status-chip { background: rgba(74,222,128,0.15); color: #BBF7D0; padding: 3px 8px; border-radius: 100px; font-size: 11px; margin-left: 8px; }
    .ff-pnr-record { font-family: 'Geist Mono', monospace; font-size: 26px; font-weight: 700; letter-spacing: 0.08em; margin: 10px 0; }
    .ff-pnr-meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .ff-pnr-meta > div { display: flex; flex-direction: column; gap: 2px; }
    .ff-pnr-label { font-size: 10px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.08em; font-family: 'Geist Mono', monospace; }
    .ff-pnr-chip { background: rgba(74,222,128,0.18); padding: 1px 6px; border-radius: 4px; }

    /* Pax row */
    .ff-pax-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px dashed var(--border); }
    .ff-pax-row:last-child { border-bottom: 0; }
    .ff-pax-mono { width: 30px; height: 30px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 11px; }
    .ff-pax-info { flex: 1; min-width: 0; font-size: 12.5px; }
    .ff-pax-tag {
      font-family: 'Geist Mono', monospace; font-size: 9.5px; padding: 2px 8px; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;
    }
    .ff-pax-tag.info { background: var(--info-soft); color: var(--info); }
    .ff-pax-tag.accent { background: var(--accent-soft); color: var(--accent); }

    /* Segment */
    .ff-seg { padding: 12px 14px; border-bottom: 1px dashed var(--border); }
    .ff-seg:last-child { border-bottom: 0; }
    .ff-seg-head { display: flex; align-items: center; gap: 6px; font-weight: 500; font-size: 12.5px; }
    .ff-seg-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; margin-top: 10px; }
    .ff-seg-ep .ff-time { font-size: 16px; font-weight: 600; line-height: 1; }
    .ff-seg-ep.r { text-align: right; }

    .ff-contact-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px dashed var(--border); font-size: 12.5px; color: var(--text-2); }
    .ff-contact-row:last-child { border-bottom: 0; }
    .ff-contact-row svg { color: var(--accent); flex-shrink: 0; }

    .ff-total-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;
    }
  `}</style>
);

export default FlightFlowView;
