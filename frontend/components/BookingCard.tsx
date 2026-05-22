import React from 'react';
import { CheckCircle2, AlertCircle, Plane } from 'lucide-react';
import { BookingDetails } from '../types';

interface BookingCardProps {
    booking: BookingDetails;
}

const BookingCard: React.FC<BookingCardProps> = ({ booking }) => {
    const statusColors = {
        confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };

    const StatusIcon = {
        confirmed: CheckCircle2,
        pending: AlertCircle,
        cancelled: AlertCircle,
    }[booking.status];

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden w-full max-w-sm my-2 shadow-lg">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Booking Reference</div>
                    <div className="font-mono text-lg text-white font-bold tracking-widest">{booking.reference}</div>
                </div>
                <div className={`px-2.5 py-1 rounded-full border flex items-center gap-1.5 text-xs font-bold uppercase ${statusColors[booking.status]}`}>
                    <StatusIcon size={12} />
                    {booking.status}
                </div>
            </div>

            <div className="p-4 space-y-4">
                <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1">Passenger</div>
                    <div className="text-sm font-medium text-slate-200">{booking.passengerName}</div>
                </div>

                <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 mb-2 text-indigo-400">
                        <Plane size={14} />
                        <div className="text-xs font-bold">{booking.flight.airline} &bull; {booking.flight.flightNumber}</div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>{booking.flight.origin}</span>
                        <div className="flex-1 border-b border-indigo-500/20 mx-3 relative top-[-1px] border-dashed"></div>
                        <span>{booking.flight.destination}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2 text-center">{booking.flight.date}</div>
                </div>
            </div>
        </div>
    );
};

export default BookingCard;
