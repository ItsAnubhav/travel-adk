
import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, ScrollText, AlertTriangle } from 'lucide-react';
import { FareRule, CancellationPolicy } from '../types';

interface PolicyCardProps {
    title: string;
    type: 'rules' | 'cancellation';
    data: FareRule[] | CancellationPolicy;
}

const PolicyCard: React.FC<PolicyCardProps> = ({ title, type, data }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden w-full max-w-sm my-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-950 hover:bg-slate-900 transition-colors"
            >
                <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                    {type === 'rules' ? <ScrollText size={16} className="text-indigo-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
                    {title}
                </div>
                {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>

            {isOpen && (
                <div className="p-4 border-t border-slate-800 text-sm">
                    {type === 'rules' ? (
                        <div className="space-y-3">
                            {(data as FareRule[]).map((rule, idx) => (
                                <div key={idx} className="bg-slate-800/20 p-2.5 rounded-lg border border-slate-800/50">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-slate-300 text-xs">{rule.title}</span>
                                        {rule.fee && <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300 border border-slate-700">{rule.fee}</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">{rule.description}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(data as CancellationPolicy).notes?.map((note, idx) => (
                                <div key={idx} className="flex gap-2 text-slate-400 text-xs">
                                    <div className="min-w-[4px] h-[4px] rounded-full bg-amber-500 mt-1.5"></div>
                                    <span>{note}</span>
                                </div>
                            ))}
                            <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                                <span className="text-slate-500">Refundable:</span>
                                <span className={(data as CancellationPolicy).refundable ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                    {(data as CancellationPolicy).refundable ? 'Yes' : 'No'}
                                </span>
                            </div>
                            {(data as CancellationPolicy).deadline && (
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">Deadline:</span>
                                    <span className="text-slate-300 font-mono">{(data as CancellationPolicy).deadline}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PolicyCard;
