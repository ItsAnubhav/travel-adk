import React from 'react';

interface ResultsErrorProps {
    error: string;
    onRetry?: () => void;
    retrying?: boolean;
}

const FRIENDLY_MAP: Array<{ test: RegExp; title: string; sub: string }> = [
    {
        test: /network|fetch|cors|failed to fetch/i,
        title: "We couldn't reach the airline",
        sub: "Looks like a network hiccup or the host isn't accepting requests from here. Check your connection and try again.",
    },
    {
        test: /401|unauthor/i,
        title: 'Your session has expired',
        sub: 'The airline API rejected your token. Sign in again or paste a fresh JWT, then re-run the search.',
    },
    {
        test: /403|forbidden/i,
        title: "You don't have access to this fare set",
        sub: 'Your account may not be permitted to query these suppliers. Contact admin to update permissions.',
    },
    {
        test: /404|not found/i,
        title: 'The flight service is unreachable',
        sub: "We couldn't find the air-shopping endpoint. The base URL may be wrong.",
    },
    {
        test: /500|503|gateway|timeout/i,
        title: 'The airline is taking a moment',
        sub: 'Their system returned a temporary error. Give it a few seconds and retry.',
    },
    {
        test: /no.*offers|empty/i,
        title: "We couldn't find any flights",
        sub: 'No itineraries match this route and dates. Try a different date, nearby airports, or fewer filters.',
    },
];

export const ResultsError: React.FC<ResultsErrorProps> = ({ error, onRetry, retrying }) => {
    const match = FRIENDLY_MAP.find((m) => m.test.test(error));
    const title = match?.title || 'Something went sideways';
    const sub =
        match?.sub ||
        "We hit an unexpected problem while searching for flights. Try again, and if it keeps happening let us know with the details below.";

    return (
        <div className="ff-error-stage">
            <div className="ff-error-card">
                <div className="ff-error-glyph" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S11 2.67 11 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5l8 2.5z" />
                    </svg>
                </div>

                <div className="ff-error-title">{title}</div>
                <div className="ff-error-sub">{sub}</div>

                <details className="ff-error-detail" style={{ marginTop: 12 }}>
                    <summary style={{ cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: 'var(--ff-text-3)', userSelect: 'none' }}>
                        Technical details
                    </summary>
                    <div style={{ marginTop: 6 }}>{error}</div>
                </details>

                {onRetry && (
                    <div className="ff-error-actions">
                        <button
                            className="ff-btn-primary"
                            onClick={onRetry}
                            disabled={retrying}
                            style={{ padding: '9px 16px', fontSize: 13 }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" style={{ marginRight: 6 }}>
                                <path d="M3 12a9 9 0 1015 -6.7L21 8M21 3v5h-5" />
                            </svg>
                            {retrying ? 'Retrying…' : 'Try again'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
