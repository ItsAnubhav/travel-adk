
import React from 'react';
import { Bot, Loader2 } from 'lucide-react';

const ThinkingIndicator: React.FC = () => (
    <div className="flex w-full px-4 py-2 md:px-8 justify-start">
        <div className="flex gap-2 max-w-[85%] sm:max-w-[70%]">
            {/* Avatar */}
            <div className="shrink-0 mt-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-600/20 border border-indigo-600/30 text-indigo-400">
                    <Bot size={16} />
                </div>
            </div>
            {/* Thinking bubble */}
            <div className="flex flex-col flex-1 min-w-0">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none px-4 py-3 text-slate-400 text-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                    <span>Thinking...</span>
                </div>
            </div>
        </div>
    </div>
);

export default ThinkingIndicator;
