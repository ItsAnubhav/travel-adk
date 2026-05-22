
import React from 'react';
import { Menu, Share2, ExternalLink } from 'lucide-react';

interface HeaderProps {
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const docsBase = (import.meta.env.VITE_API_DOCS_BASE_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const docsUrl = docsBase ? `${docsBase}/docs` : '/docs';

    return (
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-xl z-20 shrink-0">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400"
                >
                    <Menu size={20} />
                </button>
                <h2 className="text-sm font-bold text-slate-100 hidden sm:block">Agent Instance</h2>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigator.clipboard.writeText(window.location.href)}
                    className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
                    title="Copy link"
                >
                    <Share2 size={18} />
                </button>
                <a href={docsUrl} target="_blank" rel="noreferrer" className="p-2 text-slate-500 hover:text-indigo-400" title="API Docs">
                    <ExternalLink size={20} />
                </a>
            </div>
        </header>
    );
};

export default Header;
