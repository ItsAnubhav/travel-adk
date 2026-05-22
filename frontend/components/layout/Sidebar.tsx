
import React from 'react';
import {
    Layers,
    X,
    PlusCircle,
    RefreshCw,
    User,
    Info,
    Database,
    ShieldCheck
} from 'lucide-react';
import { SessionParams } from '../../hooks/useSession';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    params: SessionParams;
    isConnected: boolean;
    onReset: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, params, isConnected, onReset }) => {
    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/70 z-30 lg:hidden backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 transition-transform duration-300 transform
        lg:translate-x-0 lg:static lg:block shrink-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="flex flex-col h-full">
                    <div className="p-6 border-b border-slate-800">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                                    <Layers size={20} />
                                </div>
                                <h1 className="text-xl font-bold tracking-tight">AIVA</h1>
                            </div>
                            <button onClick={onClose} className="lg:hidden p-1 text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <button
                            onClick={() => window.location.href = window.location.pathname}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 mb-6"
                        >
                            <PlusCircle size={16} />
                            New Chat
                        </button>

                        <div className="space-y-6">
                            <section>
                                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 block mb-2">Current Session</label>
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-indigo-400 break-all shadow-inner">
                                    {params.sid}
                                </div>
                            </section>

                            {/* Optional Metadata Section (Commented out in original) */}
                            {/* <section>
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 block mb-2">Metadata</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-3 py-2 bg-slate-950/50 rounded-lg border border-slate-800/50">
                    <Database size={14} className="text-slate-500" />
                    <div className="min-w-0">
                      <div className="text-[9px] text-slate-500 uppercase font-bold">Booking</div>
                      <div className="text-sm font-medium text-slate-300 truncate">{params.bRef}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 bg-slate-950/50 rounded-lg border border-slate-800/50">
                    <ShieldCheck size={14} className="text-slate-500" />
                    <div className="min-w-0">
                      <div className="text-[9px] text-slate-500 uppercase font-bold">Company</div>
                      <div className="text-sm font-medium text-slate-300 truncate">{params.cId}</div>
                    </div>
                  </div>
                </div>
              </section> */}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <div className="flex items-center gap-2 text-indigo-400 mb-4">
                            <Info size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Workspace</span>
                        </div>
                        {/* <ul className="space-y-4">
              {['Live Stream', 'Tool Trace', 'Context Sync'].map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {f}
                </li>
              ))}
            </ul> */}
                    </div>

                    <div className="border-t border-slate-800">
                        <button
                            onClick={onReset}
                            className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 hover:bg-slate-800 hover:text-white text-xs font-semibold transition-all border-b border-slate-800"
                        >
                            <RefreshCw size={14} />
                            Reset Chat
                        </button>

                        {/* Connection Status */}
                        <div className="px-4 py-2 flex items-center gap-2 justify-center text-[10px] font-mono font-bold border-b border-slate-800">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                            <span className={isConnected ? 'text-emerald-500' : 'text-rose-500'}>
                                {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                            </span>
                        </div>

                        {/* User Profile */}
                        <div className="p-4 bg-slate-950/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                                    <User size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-slate-200 truncate">Guest User</div>
                                    <div className="text-[10px] text-slate-500 font-medium">guest@quadlabs.com</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
