import React from 'react';
import {
    CalendarDays,
    CheckCircle2,
    Clock3,
    MapPin,
    Plane,
    Ticket,
    UserRound,
    XCircle,
} from 'lucide-react';

type Passenger = {
    id?: string;
    name?: string;
    type?: string;
};

type ItinerarySegment = {
    origin?: string;
    destination?: string;
    departure?: string;
    arrival?: string;
    airline?: string;
    flight_number?: string;
    status?: string;
};

interface BookingItineraryWidgetProps {
    payload: {
        booking_ref?: string;
        booking_status?: string;
        booking_date?: string;
        passengers?: Passenger[];
        itinerary?: ItinerarySegment[];
    };
}

const statusStyles: Record<string, string> = {
    confirmed: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
    pending: 'border-amber-400/30 bg-amber-500/15 text-amber-100',
    cancelled: 'border-rose-400/30 bg-rose-500/15 text-rose-100',
};

const statusIcons: Record<string, React.ReactNode> = {
    confirmed: <CheckCircle2 size={14} />,
    cancelled: <XCircle size={14} />,
};

const formatLabel = (value?: string) => {
    if (!value) return 'Unknown';
    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDateTime = (value?: string) => {
    if (!value) return 'TBA';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const BookingItineraryWidget: React.FC<BookingItineraryWidgetProps> = ({ payload }) => {
    const bookingStatus = (payload.booking_status || 'confirmed').toLowerCase();
    const passengers = payload.passengers || [];
    const itinerary = payload.itinerary || [];
    const badgeClass = statusStyles[bookingStatus] || 'border-sky-400/30 bg-sky-500/15 text-sky-100';

    return (
        <div className="mt-4 max-h-[75vh] overflow-y-auto overflow-x-hidden custom-scrollbar rounded-[28px] border border-sky-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(12,18,34,0.96)_55%,_rgba(6,10,24,0.98))] shadow-[0_28px_80px_rgba(2,6,23,0.65)] animate-[fade-in_0.22s_ease-out] motion-reduce:animate-none">
            <div className="relative px-5 py-5 sm:px-6">

                <div className="relative flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-sky-300/80">
                                <Ticket size={12} />
                                Booking Journey
                            </div>
                            <div className="mt-2 text-2xl font-semibold tracking-[0.16em] text-white">
                                {payload.booking_ref || 'Booking Ref'}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${badgeClass}`}>
                                    {statusIcons[bookingStatus] || <Clock3 size={14} />}
                                    {formatLabel(bookingStatus)}
                                </span>
                                <span className="inline-flex items-center gap-1 text-slate-400">
                                    <CalendarDays size={13} className="text-sky-300" />
                                    {payload.booking_date ? formatDateTime(payload.booking_date) : 'Date unavailable'}
                                </span>
                            </div>
                        </div>

                        <div className="grid min-w-[220px] grid-cols-2 gap-2">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Passengers</div>
                                <div className="mt-2 text-2xl font-semibold text-white">{passengers.length}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Segments</div>
                                <div className="mt-2 text-2xl font-semibold text-white">{itinerary.length}</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4 backdrop-blur-sm">
                            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                                <Plane size={16} className="text-sky-300" />
                                Flight Itinerary
                            </div>

                            <div className="space-y-3">
                                {itinerary.length ? itinerary.map((segment, index) => (
                                    <div
                                        key={`${segment.flight_number || 'segment'}-${index}`}
                                        className="rounded-[22px] border border-sky-400/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.78))] p-4"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/85">
                                                    {segment.airline || 'Airline'} {segment.flight_number || ''}
                                                </div>
                                                <div className="mt-2 flex items-center gap-3 text-white">
                                                    <span className="text-lg font-semibold">{segment.origin || 'Origin'}</span>
                                                    <span className="h-px flex-1 min-w-10 bg-gradient-to-r from-sky-400/70 to-cyan-300/20" />
                                                    <Plane size={14} className="shrink-0 rotate-90 text-sky-300" />
                                                    <span className="h-px flex-1 min-w-10 bg-gradient-to-r from-cyan-300/20 to-sky-400/70" />
                                                    <span className="text-lg font-semibold">{segment.destination || 'Destination'}</span>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                                                Status: <span className="font-semibold text-white">{formatLabel(segment.status || 'scheduled')}</span>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
                                                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Departure</div>
                                                <div className="mt-1 text-sm font-medium text-white">{formatDateTime(segment.departure)}</div>
                                            </div>
                                            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
                                                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Arrival</div>
                                                <div className="mt-1 text-sm font-medium text-white">{formatDateTime(segment.arrival)}</div>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rounded-[22px] border border-dashed border-slate-700 bg-black/20 px-4 py-6 text-sm text-slate-400">
                                        No itinerary segments available for this booking yet.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4 backdrop-blur-sm">
                            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                                <UserRound size={16} className="text-cyan-300" />
                                Passenger Manifest
                            </div>

                            <div className="space-y-3">
                                {passengers.length ? passengers.map((passenger, index) => (
                                    <div
                                        key={passenger.id || `${passenger.name || 'passenger'}-${index}`}
                                        className="rounded-[22px] border border-white/8 bg-[linear-gradient(160deg,rgba(14,24,41,0.95),rgba(18,35,55,0.72))] px-4 py-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-white">
                                                    {passenger.name || `Passenger ${index + 1}`}
                                                </div>
                                                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                                                    {passenger.type || 'Traveler'}
                                                </div>
                                            </div>
                                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                                                <UserRound size={16} />
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rounded-[22px] border border-dashed border-slate-700 bg-black/20 px-4 py-6 text-sm text-slate-400">
                                        Passenger details are not available in this response.
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,15,28,0.95),rgba(10,15,28,0.78))] p-4">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                    <MapPin size={14} className="text-sky-300" />
                                    Travel Snapshot
                                </div>
                                <div className="mt-3 space-y-2 text-sm text-slate-300">
                                    <div className="flex items-center justify-between gap-3">
                                        <span>First leg</span>
                                        <span className="font-medium text-white">
                                            {itinerary[0]?.origin || 'N/A'} to {itinerary[0]?.destination || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span>Last arrival</span>
                                        <span className="font-medium text-white">{formatDateTime(itinerary[itinerary.length - 1]?.arrival)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BookingItineraryWidget;
