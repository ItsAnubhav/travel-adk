import React from 'react';
import FlightFlowView from './FlightFlow';
import FlightTestPage from '../pages/FlightTestPage';
import ExpenseReceiptView from '../components/ExpenseReceiptView';

export interface CustomViewSpec {
  view_type: string;
  payload?: any;
  fallback_text?: string;
  [key: string]: any;
}

export interface CustomViewProps {
  payload: any;
  fallback_text?: string;
}

export type CustomViewComponent = React.FC<CustomViewProps>;

const registry = new Map<string, CustomViewComponent>();

export const registerView = (viewType: string, component: CustomViewComponent): void => {
  registry.set(viewType, component);
};

export const hasView = (viewType: string | undefined | null): boolean =>
  Boolean(viewType && registry.has(viewType));

export const getView = (viewType: string): CustomViewComponent | undefined =>
  registry.get(viewType);

export const listViewTypes = (): string[] => Array.from(registry.keys());

interface CustomViewHostProps {
  spec: CustomViewSpec | null | undefined;
}

export const CustomView: React.FC<CustomViewHostProps> = ({ spec }) => {
  if (!spec || typeof spec !== 'object' || !spec.view_type) return null;
  const Component = registry.get(spec.view_type);
  if (!Component) return null;
  return <Component payload={spec.payload ?? spec} fallback_text={spec.fallback_text} />;
};

const Empty: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="cv-empty">{msg}</div>
);

const StatusPill: React.FC<{ value: string | undefined; tone?: 'ok' | 'warn' | 'bad' | 'neutral' }> = ({ value, tone = 'neutral' }) => {
  if (!value) return null;
  return <span className={`cv-pill cv-pill-${tone}`}>{value}</span>;
};

const formatStatusTone = (status?: string): 'ok' | 'warn' | 'bad' | 'neutral' => {
  if (!status) return 'neutral';
  const s = status.toLowerCase();
  if (s.includes('confirm') || s === 'ok' || s === 'success') return 'ok';
  if (s.includes('cancel') || s.includes('fail') || s.includes('error')) return 'bad';
  if (s.includes('pending') || s.includes('hold')) return 'warn';
  return 'neutral';
};

const FlightResultsView: CustomViewComponent = ({ payload }) => {
  if (!payload || !Array.isArray(payload.flights)) return <Empty msg="No flights returned." />;
  return <FlightFlowView payload={payload as any} />;
};

const FlightTestEmbedView: CustomViewComponent = ({ payload }) => {
  const searchRequest =
    payload?.search_request ||
    payload?.payload?.search_request ||
    payload?.view?.payload?.search_request ||
    null;
  return (
    <FlightTestPage
      embedded
      initialSearchRequest={searchRequest}
    />
  );
};

const CreditCardsView: CustomViewComponent = ({ payload }) => {
  const cards = Array.isArray(payload?.cards)
    ? payload.cards
    : Array.isArray(payload)
      ? payload
      : [];
  if (!cards.length) return <Empty msg="No cards available." />;
  return (
    <div className="cv-table-wrap">
      <table className="cv-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Number</th>
            <th>Holder</th>
            <th>Expiry</th>
            <th>Issuer</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((c: any, idx: number) => (
            <tr key={c?.id ?? idx}>
              <td><span className="cv-tag">{c?.type || '—'}</span></td>
              <td className="cv-mono">•••• {c?.last4 || '----'}</td>
              <td>{c?.cardHolder || '—'}</td>
              <td className="cv-mono">{c?.expiry || '—'}</td>
              <td>{c?.issuer || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const KeyVal: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="cv-kv">
    <div className="cv-kv-label">{label}</div>
    <div className="cv-kv-value">{children}</div>
  </div>
);

const BookingCardView: CustomViewComponent = ({ payload }) => {
  const b = payload?.booking ?? payload;
  if (!b) return <Empty msg="No booking data." />;
  const flight = b.flight || {};
  return (
    <div className="cv-panel">
      <div className="cv-grid-2">
        <KeyVal label="Reference"><span className="cv-mono">{b.reference || '—'}</span></KeyVal>
        <KeyVal label="Status">
          <StatusPill value={b.status} tone={formatStatusTone(b.status)} />
        </KeyVal>
        <KeyVal label="Passenger">{b.passengerName || '—'}</KeyVal>
        <KeyVal label="Flight">
          <span className="cv-mono">{flight.airline || '—'} {flight.flightNumber || ''}</span>
        </KeyVal>
        <KeyVal label="Route">
          <span className="cv-mono">{flight.origin || '—'}</span>
          <span className="cv-arrow"> → </span>
          <span className="cv-mono">{flight.destination || '—'}</span>
        </KeyVal>
        <KeyVal label="Date">{flight.date || '—'}</KeyVal>
      </div>
    </div>
  );
};

const BookingItineraryView: CustomViewComponent = ({ payload }) => {
  if (!payload) return <Empty msg="No itinerary data." />;
  const itinerary = Array.isArray(payload.itinerary) ? payload.itinerary : [];
  const passengers = Array.isArray(payload.passengers) ? payload.passengers : [];
  return (
    <div className="cv-panel">
      <div className="cv-grid-2 cv-tight">
        <KeyVal label="Booking Ref"><span className="cv-mono">{payload.booking_ref || '—'}</span></KeyVal>
        <KeyVal label="Status">
          <StatusPill value={payload.booking_status} tone={formatStatusTone(payload.booking_status)} />
        </KeyVal>
        <KeyVal label="Booked On">{payload.booking_date || '—'}</KeyVal>
        <KeyVal label="Passengers">{passengers.length || 0}</KeyVal>
      </div>
      {itinerary.length > 0 && (
        <>
          <div className="cv-section-label">Itinerary</div>
          <div className="cv-table-wrap">
            <table className="cv-table">
              <thead>
                <tr>
                  <th>Airline</th>
                  <th>Flight</th>
                  <th>From → To</th>
                  <th>Depart</th>
                  <th>Arrive</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {itinerary.map((seg: any, idx: number) => (
                  <tr key={idx}>
                    <td className="cv-mono">{seg.airline || '—'}</td>
                    <td className="cv-mono">{seg.flight_number || '—'}</td>
                    <td>
                      <span className="cv-mono">{seg.origin || '—'}</span>
                      <span className="cv-arrow"> → </span>
                      <span className="cv-mono">{seg.destination || '—'}</span>
                    </td>
                    <td>{seg.departure || '—'}</td>
                    <td>{seg.arrival || '—'}</td>
                    <td><StatusPill value={seg.status} tone={formatStatusTone(seg.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {passengers.length > 0 && (
        <>
          <div className="cv-section-label">Passengers</div>
          <ul className="cv-list">
            {passengers.map((p: any, idx: number) => (
              <li key={idx}>{p.name || '—'} <span className="cv-sub">{p.type || ''}</span></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const FareRulesView: CustomViewComponent = ({ payload }) => {
  const rules = Array.isArray(payload?.rules) ? payload.rules : Array.isArray(payload) ? payload : [];
  if (!rules.length) return <Empty msg="No fare rules." />;
  return (
    <div className="cv-table-wrap">
      <table className="cv-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Rule</th>
            <th>Fee</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r: any, idx: number) => (
            <tr key={idx}>
              <td><span className="cv-tag">{r.category || 'other'}</span></td>
              <td>
                <div>{r.title || '—'}</div>
                {r.description && <div className="cv-sub">{r.description}</div>}
              </td>
              <td className="cv-mono">{r.fee || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CancellationPolicyView: CustomViewComponent = ({ payload }) => {
  const p = payload?.policy ?? payload;
  if (!p) return <Empty msg="No policy details." />;
  return (
    <div className="cv-panel">
      <div className="cv-grid-2">
        <KeyVal label="Refundable">
          <StatusPill
            value={p.refundable ? 'yes' : 'no'}
            tone={p.refundable ? 'ok' : 'bad'}
          />
        </KeyVal>
        {p.refundAmount && <KeyVal label="Refund Amount"><span className="cv-mono">{p.refundAmount}</span></KeyVal>}
        {p.deadline && <KeyVal label="Deadline">{p.deadline}</KeyVal>}
      </div>
      {Array.isArray(p.notes) && p.notes.length > 0 && (
        <>
          <div className="cv-section-label">Notes</div>
          <ul className="cv-list">
            {p.notes.map((n: string, idx: number) => <li key={idx}>{n}</li>)}
          </ul>
        </>
      )}
    </div>
  );
};

const ExpenseRows: React.FC<{ rows: any[] }> = ({ rows }) => {
  const pick = (e: any, ...keys: string[]) => {
    for (const k of keys) {
      const v = e?.[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  };
  return (
    <table className="cv-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Merchant</th>
          <th>Invoice</th>
          <th>Mode</th>
          <th className="cv-num">Amount</th>
          <th className="cv-num">Tax</th>
          <th>Trip</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e, idx) => {
          const id = pick(e, 'Expense_Id', 'expenseId', 'id') ?? idx;
          const date = pick(e, 'ExpenseDate', 'expenseDate', 'sort_start_date', 'fromDate', 'FromDate');
          const cat = pick(e, 'CategoryName', 'categoryName', 'category');
          const merchant = pick(e, 'Merchant', 'merchant', 'merchantName');
          const invoice = pick(e, 'InvoiceNo', 'invoiceNo', 'invoiceNumber');
          const mode = pick(e, 'ModeOfPayment', 'modeOfPayment', 'paymentMode');
          const currency = pick(e, 'Currency', 'currency', 'currencyCode') || '';
          const amount = pick(e, 'Amount', 'amount') ?? 0;
          const tax = pick(e, 'TaxAmount', 'taxAmount') ?? 0;
          const trip = pick(e, 'Trip_Name', 'tripName');
          return (
            <tr key={String(id)}>
              <td>{date || '—'}</td>
              <td>{cat || '—'}</td>
              <td>{merchant || '—'}</td>
              <td className="cv-mono">{invoice || '—'}</td>
              <td>{mode || '—'}</td>
              <td className="cv-num cv-mono">{currency} {Number(amount).toLocaleString()}</td>
              <td className="cv-num cv-mono">{Number(tax).toLocaleString()}</td>
              <td>{trip || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const collectExpenseRows = (payload: any): any[] => {
  if (!payload || typeof payload !== 'object') return [];
  const rows: any[] = [];
  const addRows = (value: any) => {
    if (Array.isArray(value)) rows.push(...value.filter((item) => item && typeof item === 'object'));
  };

  addRows(payload.items);

  const data = payload.data;
  if (data && typeof data === 'object') {
    addRows(data.data);
    addRows(data.items);
  } else {
    addRows(data);
  }

  const report = payload.report && typeof payload.report === 'object' ? payload.report : payload;
  const root = report.Data && typeof report.Data === 'object' ? report.Data : report;
  ['TripExpense', 'FiledTrip', 'PersonalTrip', 'DeletedTrip'].forEach((key) => addRows(root?.[key]));

  return rows;
};

const ExpenseReportView: CustomViewComponent = ({ payload }) => {
  // The channel-scoped payload from get_expense_report has a flat .items list
  // (already normalized) plus optional raw .report for legacy Travog shape.
  const flatItems: any[] = collectExpenseRows(payload);
  const reportRoot = payload?.report ?? payload;
  const bucketRoot = reportRoot?.Data ?? reportRoot;
  const bucketGroups: Array<[string, any[]]> = [
    ['Trip Expenses', Array.isArray(bucketRoot?.TripExpense) ? bucketRoot.TripExpense : []],
    ['Filed', Array.isArray(bucketRoot?.FiledTrip) ? bucketRoot.FiledTrip : []],
    ['Personal', Array.isArray(bucketRoot?.PersonalTrip) ? bucketRoot.PersonalTrip : []],
    ['Deleted', Array.isArray(bucketRoot?.DeletedTrip) ? bucketRoot.DeletedTrip : []],
  ];
  const nonEmptyBuckets = bucketGroups.filter(([, rows]) => rows.length > 0);

  let groups: Array<[string, any[]]>;
  if (nonEmptyBuckets.length) {
    groups = nonEmptyBuckets;
  } else if (flatItems.length) {
    const label = payload?.filter_label
      ? `Expenses · ${payload.filter_label}`
      : 'Expenses';
    groups = [[label, flatItems]];
  } else {
    return <Empty msg="No expenses in this report." />;
  }

  const totals = payload?.totals_by_currency;

  return (
    <div className="cv-panel">
      {totals && typeof totals === 'object' && Object.keys(totals).length > 0 && (
        <div className="cv-section-label">
          Total:{' '}
          {Object.entries(totals).map(([cur, amt], idx) => (
            <span key={cur} className="cv-mono" style={{ marginRight: 8 }}>
              {idx > 0 ? ' · ' : ''}{cur} {Number(amt as number).toLocaleString()}
            </span>
          ))}
        </div>
      )}
      {groups.map(([label, rows]) => (
        <div key={label} className="cv-expense-group">
          <div className="cv-section-label">
            {label} <span className="cv-sub">({rows.length})</span>
          </div>
          <div className="cv-table-wrap">
            <ExpenseRows rows={rows} />
          </div>
        </div>
      ))}
    </div>
  );
};

const ExpenseSettingsView: CustomViewComponent = ({ payload }) => {
  const expense = (payload || {}) as any;
  return (
    <div className="cv-panel">
      <div className="cv-section-label">{expense.title || 'Add New Expense'}</div>
      <div className="cv-grid-2 cv-tight">
        {Array.isArray(expense.categories) && (
          <KeyVal label="Categories">
            <ul className="cv-list cv-list-tight">
              {expense.categories.map((item: any) => (
                <li key={item.id}>{item.name} <span className="cv-sub">({item.id})</span></li>
              ))}
            </ul>
          </KeyVal>
        )}
        {Array.isArray(expense.payment_modes) && (
          <KeyVal label="Payment Modes">
            <ul className="cv-list cv-list-tight">
              {expense.payment_modes.map((item: any) => (
                <li key={item.code}>{item.name} <span className="cv-sub">({item.code})</span></li>
              ))}
            </ul>
          </KeyVal>
        )}
        {Array.isArray(expense.currencies) && (
          <KeyVal label="Currencies">
            <ul className="cv-list cv-list-tight">
              {expense.currencies.map((item: any) => (
                <li key={item.code}>{item.name} <span className="cv-sub">({item.code})</span></li>
              ))}
            </ul>
          </KeyVal>
        )}
        {Array.isArray(expense.trips) && (
          <KeyVal label="Trips">
            <ul className="cv-list cv-list-tight">
              {expense.trips.map((item: any) => (
                <li key={item.id}>{item.name} <span className="cv-sub">({item.id})</span></li>
              ))}
            </ul>
          </KeyVal>
        )}
      </div>
      {expense.corporate_currency && (
        <div className="cv-foot">Corporate currency: <span className="cv-mono">{expense.corporate_currency}</span></div>
      )}
    </div>
  );
};

registerView('flight_results', FlightResultsView);
registerView('flight_search_results', FlightResultsView);
registerView('flight_test_page', FlightTestEmbedView);
registerView('credit_cards', CreditCardsView);
registerView('booking_card', BookingCardView);
registerView('booking_details', BookingCardView);
registerView('booking_itinerary', BookingItineraryView);
registerView('booking_itinerary_widget', BookingItineraryView);
registerView('fare_rules', FareRulesView);
registerView('fare_rules_widget', FareRulesView);
registerView('cancellation_policy', CancellationPolicyView);
registerView('expense_item', ExpenseReceiptView);
registerView('expense_receipt', ExpenseReceiptView);
registerView('expense_report', ExpenseReportView);
registerView('expense_settings', ExpenseSettingsView);
