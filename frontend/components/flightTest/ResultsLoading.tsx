import React, { useEffect, useState } from 'react';

const STATUS_LINES = [
    'Connecting to the airline…',
    'Comparing live fares across carriers…',
    'Checking baggage & policy rules…',
    'Sorting the cheapest, fastest and non-stop options…',
];

interface ResultsLoadingProps {
    origin?: string;
    destination?: string;
    departDate?: string;
    returnDate?: string;
    paxTotal?: number;
}

export const ResultsLoading: React.FC<ResultsLoadingProps> = ({
    origin,
    destination,
    departDate,
    returnDate,
    paxTotal,
}) => {
    const [statusIdx, setStatusIdx] = useState(0);

    useEffect(() => {
        const id = setInterval(() => {
            setStatusIdx((i) => (i + 1) % STATUS_LINES.length);
        }, 1800);
        return () => clearInterval(id);
    }, []);

    const routeLabel =
        origin && destination
            ? `${origin} ${returnDate ? '⇄' : '→'} ${destination}`
            : 'flights';
    const dateLabel = formatRange(departDate, returnDate);

    return (
        <div className="ff-loading-stage">
            <div className="ff-loading-card">
                <div className="ff-loading-orbit" aria-hidden="true">
                    <span className="ring r1" />
                    <span className="ring r2" />
                    <span className="ring r3" />
                    <span className="ff-loading-plane">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S11 2.67 11 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5l8 2.5z" />
                        </svg>
                    </span>
                </div>

                <div className="ff-loading-eyebrow">SEARCHING</div>
                <div className="ff-loading-title">{routeLabel}</div>
                <div className="ff-loading-sub">
                    {dateLabel}
                    {paxTotal ? ` · ${paxTotal} passenger${paxTotal === 1 ? '' : 's'}` : ''}
                </div>

                <div className="ff-loading-status" aria-live="polite">
                    <span className="ff-loading-status-text" key={statusIdx}>
                        {STATUS_LINES[statusIdx]}
                    </span>
                </div>

                <div className="ff-loading-bar" aria-hidden="true">
                    <span />
                </div>
            </div>
        </div>
    );
};

function formatRange(depart?: string, ret?: string): string {
    if (!depart) return 'preparing your search';
    const dep = shortIso(depart);
    if (!ret) return dep;
    return `${dep} – ${shortIso(ret)}`;
}

function shortIso(iso?: string): string {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
}
