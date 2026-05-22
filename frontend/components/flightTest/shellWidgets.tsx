import React, { useState } from 'react';
import { splitMoney } from './parsers';

export const Modal: React.FC<{
    open: boolean;
    title: React.ReactNode;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ open, title, onClose, children }) => {
    if (!open) return null;
    return (
        <div className="ff-modal-overlay" onClick={onClose}>
            <div className="ff-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="ff-modal-head">
                    <h3>{title}</h3>
                    <button className="ff-modal-close" onClick={onClose} aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>
                </div>
                <div className="ff-modal-body">{children}</div>
            </div>
        </div>
    );
};

export const BackLink: React.FC<{ label?: string; onClick: () => void }> = ({ label = 'Back', onClick }) => (
    <button
        type="button"
        onClick={onClick}
        style={{
            background: 'transparent',
            border: 0,
            padding: '4px 0',
            color: 'var(--ff-text-3)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            font: 'inherit',
            fontSize: 12,
            fontWeight: 500,
        }}
    >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
            <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        {label}
    </button>
);

export type Stage = 'results' | 'branded' | 'passenger' | 'price' | 'confirmed';

export const STAGE_LABELS: Record<Stage, string> = {
    results: 'Flight selection',
    branded: 'Fare selection',
    passenger: 'Passenger details',
    price: 'Review & payment',
    confirmed: 'Booking confirmed',
};

export const STAGE_ORDER: Stage[] = ['results', 'branded', 'passenger', 'price', 'confirmed'];

export const ProgressBar: React.FC<{ stage: Stage }> = ({ stage }) => {
    const idx = STAGE_ORDER.indexOf(stage);
    return (
        <div className="ff-progress">
            <div className="step-info">
                <div className="step-label">Step {idx + 1} of {STAGE_ORDER.length}</div>
                <div className="step-name">{STAGE_LABELS[stage]}</div>
            </div>
            <div className="step-dots">
                {STAGE_ORDER.map((s, i) => (
                    <span
                        key={s}
                        className={'dot ' + (i < idx ? 'done' : i === idx ? 'active' : '')}
                    />
                ))}
            </div>
        </div>
    );
};

export const SearchSummary: React.FC<{
    origin?: string;
    destination?: string;
    tripType: 'OW' | 'RT' | 'MC';
    departDate?: string;
    returnDate?: string;
    paxCounts: { ADT: number; CHD: number; INF: number };
}> = ({ origin, destination, tripType, departDate, returnDate, paxCounts }) => {
    const arrow = tripType === 'RT' ? '⇄' : '→';
    const datePart =
        tripType === 'RT' && returnDate
            ? `${shortIso(departDate)} – ${shortIso(returnDate)}`
            : tripType === 'MC'
                ? `${shortIso(departDate)} · multi-city`
                : shortIso(departDate);
    const paxBits: string[] = [];
    if (paxCounts.ADT) paxBits.push(`${paxCounts.ADT} ADT`);
    if (paxCounts.CHD) paxBits.push(`${paxCounts.CHD} CHD`);
    if (paxCounts.INF) paxBits.push(`${paxCounts.INF} INF`);
    return (
        <div className="ff-search-summary">
            <div className="route">
                <span>{origin || '—'}</span>
                <span className="arrow">{arrow}</span>
                <span>{destination || '—'}</span>
            </div>
            <div className="detail">{datePart}{paxBits.length ? ` · ${paxBits.join(', ')}` : ''}</div>
        </div>
    );
};

export const PriceTag: React.FC<{ currency: string; amount: number; size?: 'sm' | 'md' | 'lg' }> = ({
    currency,
    amount,
    size = 'md',
}) => {
    const { intPart, dec } = splitMoney(amount);
    const fontSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
    const decSize = size === 'sm' ? 10 : size === 'lg' ? 13 : 12;
    return (
        <span className="ff-price" style={{ fontSize }}>
            <span className="cur">{currency}</span>
            {intPart}
            <span className="dec" style={{ fontSize: decSize }}>{dec}</span>
        </span>
    );
};

export const Alert: React.FC<{
    tone: 'error' | 'info' | 'loading';
    title?: string;
    children?: React.ReactNode;
}> = ({ tone, title, children }) => (
    <div className={`ff-alert ${tone}`}>
        {tone === 'error' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
            </svg>
        )}
        {tone === 'info' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
            </svg>
        )}
        {tone === 'loading' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
        )}
        <div>
            {title && <b>{title}</b>}
            {title && children && ' '}
            {children}
        </div>
    </div>
);

export const AirlineLogo: React.FC<{ code?: string; size?: number; title?: string }> = ({
    code,
    size = 36,
    title,
}) => {
    const upper = (code || '').toUpperCase();
    const [failed, setFailed] = useState(false);
    const style: React.CSSProperties = { width: size, height: size };
    if (!upper || failed) {
        return (
            <span className="ff-airline-mark fallback" style={style} title={title || upper}>
                {upper || '?'}
            </span>
        );
    }
    return (
        <img
            className="ff-airline-mark"
            src={`https://images.kiwi.com/airlines/64x64/${upper}.png`}
            alt={title || upper}
            title={title || upper}
            width={size}
            height={size}
            loading="lazy"
            onError={() => setFailed(true)}
            style={style}
        />
    );
};

function shortIso(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
}
