import React from 'react';
import { LayoutPanelLeft, ChevronRight } from 'lucide-react';
import { RichResult, RichResultRenderer } from './RichResultRenderer';

interface ResultViewProps {
  results: RichResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const ResultView: React.FC<ResultViewProps> = ({ results, selectedId, onSelect }) => {
  if (!results.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-5">
          <LayoutPanelLeft size={28} />
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-2">No results yet</h3>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          Ask for an expense report, booking details, or flight search and the rich result will appear here.
        </p>
      </div>
    );
  }

  const selected =
    results.find((r) => r.id === selectedId) || results[results.length - 1];

  return (
    <div className="h-full flex flex-col lg:flex-row min-h-0">
      <aside className="lg:w-64 xl:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800/60 bg-slate-950/60 overflow-y-auto custom-scrollbar">
        <div className="px-4 py-3 text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 border-b border-slate-800/50">
          Results ({results.length})
        </div>
        <ul className="divide-y divide-slate-900/60">
          {results.map((r) => {
            const active = r.id === selected.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
                    active
                      ? 'bg-indigo-600/15 border-l-2 border-indigo-500'
                      : 'hover:bg-slate-900/60 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${active ? 'text-white' : 'text-slate-200'}`}>
                      {r.label || r.kind}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatTime(r.timestamp)}
                    </div>
                  </div>
                  <ChevronRight size={14} className={active ? 'text-indigo-300' : 'text-slate-600'} />
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex-1 min-w-0 min-h-0 overflow-y-auto custom-scrollbar p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
                {selected.kind.replace(/_/g, ' ')}
              </div>
              <h2 className="text-lg font-semibold text-white mt-0.5">{selected.label}</h2>
            </div>
            <div className="text-[11px] text-slate-500">{selected.timestamp.toLocaleString()}</div>
          </div>
          <RichResultRenderer result={selected} />
        </div>
      </section>
    </div>
  );
};

export default ResultView;
