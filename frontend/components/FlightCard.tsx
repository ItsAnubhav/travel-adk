import React from 'react';
import { Plane, Clock, ArrowRight } from 'lucide-react';
import { Flight } from '../types';

interface FlightCardProps {
    flight: Flight;
}

const FlightCard: React.FC<FlightCardProps> = ({ flight }) => {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all group w-full max-w-md my-2">
            {/* Header */}
            <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-900 font-bold text-xs uppercase">
                        {flight.airlineCode}
                    </div>
                    <div>
                        <div className="text-sm font-bold text-slate-200">{flight.airline}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{flight.flightNumber}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold text-white">
                        {flight.price.currency} {flight.price.amount.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Flight Info */}
            <div className="p-4 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                {/* Departure */}
                <div className="text-left">
                    <div className="text-2xl font-bold text-white">{flight.departure.time}</div>
                    <div className="text-xs text-slate-400 font-bold">{flight.departure.code}</div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[80px]">{flight.departure.city}</div>
                </div>

                {/* Route Visual */}
                <div className="flex flex-col items-center w-full px-2">
                    <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
                        <Clock size={10} />
                        {flight.duration}
                    </div>
                    <div className="w-full flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                        <div className="flex-1 h-0.5 bg-slate-700 relative">
                            {/* Plane Icon overlaid */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 p-1">
                                <Plane size={12} className="text-indigo-400 rotate-90" />
                            </div>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-1">
                        {flight.stops === 0 ? 'Direct' : `${flight.stops} Stop${flight.stops! > 1 ? 's' : ''}`}
                    </div>
                </div>

                {/* Arrival */}
                <div className="text-right">
                    <div className="text-2xl font-bold text-white">{flight.arrival.time}</div>
                    <div className="text-xs text-slate-400 font-bold">{flight.arrival.code}</div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[80px] ml-auto">{flight.arrival.city}</div>
                </div>
            </div>

            {/* Footer Action */}
            <div className="p-3 bg-slate-950/50 border-t border-slate-800 flex justify-end">
                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                    Select Flight
                    <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default FlightCard;
