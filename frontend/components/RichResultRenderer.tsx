import React from 'react';
import {
  ChatMessage as ChatMessageType,
  ExpenseSettingsPayload,
} from '../types';
import BookingCard from './BookingCard';
import ExpenseReportCard from './ExpenseReportCard';
import BookingItineraryWidget from './BookingItineraryWidget';
import ExpenseReceiptView from './ExpenseReceiptView';

export type RichResultKind =
  | 'expense_item'
  | 'expense_report'
  | 'expense_settings'
  | 'booking_itinerary'
  | 'booking_details'
  | 'fare_rules_widget';

export interface RichResult {
  id: string;
  messageId: string;
  kind: RichResultKind;
  label: string;
  timestamp: Date;
  data: any;
}

const KIND_FROM_VIEW_TYPE: Record<string, RichResultKind> = {
  expense_item: 'expense_item',
  expense_receipt: 'expense_item',
  expense_report: 'expense_report',
  expense_settings: 'expense_settings',
  booking_itinerary: 'booking_itinerary',
  booking_itinerary_widget: 'booking_itinerary',
  booking_details: 'booking_details',
  fare_rules_widget: 'fare_rules_widget',
};

const labelFromKind = (kind: RichResultKind, payload: any): string => {
  switch (kind) {
    case 'expense_item': return payload?.merchant || payload?.Merchant || 'Expense';
    case 'expense_report': return 'Expense Report';
    case 'expense_settings': return payload?.title || 'Expense Settings';
    case 'booking_itinerary': return payload?.booking_ref ? `Booking ${payload.booking_ref}` : 'Booking Itinerary';
    case 'fare_rules_widget': return payload?.title || 'Fare Rules';
    default: return kind;
  }
};

const resolveToolViewChannel = (toolOutput: any, channel = 'chat'): any | null => {
  const tv = toolOutput?.tool_view;
  if (!tv || typeof tv !== 'object') return null;
  const channels = tv.channels;
  if (!channels || typeof channels !== 'object') return null;
  return channels[channel] || channels.default || null;
};

export function extractRichResults(message: ChatMessageType): RichResult[] {
  if (message.role !== 'assistant') return [];
  const out: RichResult[] = [];
  const timestamp = message.timestamp;

  const seenViewKinds = new Set<RichResultKind>();

  (message.toolViews || []).forEach((entry, idx) => {
    const viewType = entry?.view?.view_type;
    if (!viewType) return;
    const id = `${message.id}::view::${idx}`;
    const payload = entry.view.payload || {};

    if (viewType === 'expense_report') {
      seenViewKinds.add('expense_report');
      out.push({
        id, messageId: message.id, kind: 'expense_report',
        label: 'Expense Report', timestamp,
        data: payload.report || payload,
      });
      return;
    }
    if (viewType === 'expense_item' || viewType === 'expense_receipt') {
      seenViewKinds.add('expense_item');
      out.push({
        id, messageId: message.id, kind: 'expense_item',
        label: payload?.merchant || payload?.Merchant || 'Expense',
        timestamp,
        data: payload,
      });
      return;
    }
    if (viewType === 'expense_settings') {
      seenViewKinds.add('expense_settings');
      out.push({
        id, messageId: message.id, kind: 'expense_settings',
        label: (payload as ExpenseSettingsPayload)?.title || 'Expense Settings',
        timestamp, data: payload,
      });
      return;
    }
    if (viewType === 'booking_itinerary' || viewType === 'booking_itinerary_widget') {
      seenViewKinds.add('booking_itinerary');
      out.push({
        id, messageId: message.id, kind: 'booking_itinerary',
        label: payload.booking_ref ? `Booking ${payload.booking_ref}` : 'Booking Itinerary',
        timestamp, data: payload,
      });
      return;
    }
    if (viewType === 'fare_rules_widget') {
      seenViewKinds.add('fare_rules_widget');
      out.push({
        id, messageId: message.id, kind: 'fare_rules_widget',
        label: payload.title || 'Fare Rules',
        timestamp, data: payload,
      });
      return;
    }
  });

  (message.toolResults || []).forEach((tool, idx) => {
    if (!tool.success) return;
    const id = `${message.id}::tool::${idx}`;
    const tOut: any = (tool as any).tool_output || tool;

    const channelView = resolveToolViewChannel(tOut, 'chat');
    if (!channelView || !channelView.view_type) return;

    const mappedKind = KIND_FROM_VIEW_TYPE[channelView.view_type as string];
    if (!mappedKind) return;
    if (seenViewKinds.has(mappedKind)) return;
    seenViewKinds.add(mappedKind);

    const payload = channelView.payload || {};
    const data = mappedKind === 'expense_report' ? (payload.report || payload) : payload;
    out.push({
      id,
      messageId: message.id,
      kind: mappedKind,
      label: labelFromKind(mappedKind, payload),
      timestamp,
      data,
    });
  });

  return out;
}

const ExpenseSettingsView: React.FC<{ expense: ExpenseSettingsPayload }> = ({ expense }) => (
  <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
    <div className="text-sm font-semibold text-emerald-200 mb-3">
      {expense.title || 'Expense Settings'}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <div className="rounded-lg bg-black/20 border border-slate-800 px-3 py-2">
        <div className="text-[11px] text-slate-400 uppercase mb-1">Categories</div>
        {expense.categories?.map((item) => (
          <div key={item.id} className="text-slate-200">{item.name} ({item.id})</div>
        ))}
      </div>
      <div className="rounded-lg bg-black/20 border border-slate-800 px-3 py-2">
        <div className="text-[11px] text-slate-400 uppercase mb-1">Payment Modes</div>
        {expense.payment_modes?.map((item) => (
          <div key={item.code} className="text-slate-200">{item.name} ({item.code})</div>
        ))}
      </div>
      <div className="rounded-lg bg-black/20 border border-slate-800 px-3 py-2">
        <div className="text-[11px] text-slate-400 uppercase mb-1">Currencies</div>
        {expense.currencies?.map((item) => (
          <div key={item.code} className="text-slate-200">{item.name} ({item.code})</div>
        ))}
      </div>
      <div className="rounded-lg bg-black/20 border border-slate-800 px-3 py-2">
        <div className="text-[11px] text-slate-400 uppercase mb-1">Trips</div>
        {expense.trips?.map((item) => (
          <div key={item.id} className="text-slate-200">{item.name} ({item.id})</div>
        ))}
      </div>
    </div>
    {expense.corporate_currency && (
      <div className="mt-3 text-xs text-slate-300">
        Corporate currency: {expense.corporate_currency}
      </div>
    )}
  </div>
);

const FareRulesWidgetView: React.FC<{ payload: any }> = ({ payload }) => {
  const cancellation = payload?.cancellation_before_departure || {};
  return (
    <div className="rounded-xl border border-sky-900/50 bg-sky-950/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-sky-200">{payload.title || 'Fare Rules'}</span>
        <span className="text-[11px] text-slate-400">{payload.airline || 'Airline'}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-black/20 border border-slate-800 px-3 py-2">
          <div className="text-[11px] text-slate-400 uppercase">Cancellation</div>
          <div className="text-slate-200">Adult: {payload.currency || 'INR'} {cancellation.adult ?? '-'}</div>
          <div className="text-slate-200">Child: {payload.currency || 'INR'} {cancellation.child ?? '-'}</div>
        </div>
        <div className="rounded-lg bg-black/20 border border-slate-800 px-3 py-2">
          <div className="text-[11px] text-slate-400 uppercase">Change Fee</div>
          <div className="text-slate-200">{payload.currency || 'INR'} {payload.change_fee ?? '-'}</div>
        </div>
      </div>
    </div>
  );
};

export const RichResultRenderer: React.FC<{ result: RichResult }> = ({ result }) => {
  switch (result.kind) {
    case 'expense_item':
      return <ExpenseReceiptView payload={result.data} />;
    case 'expense_report':
      return <ExpenseReportCard report={result.data} />;
    case 'expense_settings':
      return <ExpenseSettingsView expense={result.data} />;
    case 'booking_itinerary':
      return <BookingItineraryWidget payload={result.data} />;
    case 'booking_details':
      return <BookingCard booking={result.data} />;
    case 'fare_rules_widget':
      return <FareRulesWidgetView payload={result.data} />;
    default:
      return null;
  }
};
