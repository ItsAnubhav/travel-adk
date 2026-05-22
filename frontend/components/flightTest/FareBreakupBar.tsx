import React, { useState } from 'react';
import { Modal, PriceTag } from './shellWidgets';
import { splitMoney } from './parsers';
import { ParsedPaxBreakdown, ParsedSearch } from './types';

interface FareBreakupBarProps {
    label: string;
    currency: string;
    totalAmount: number;
    paxBreakdown: ParsedPaxBreakdown[];
    paxCounts: ParsedSearch['paxCounts'];
    ctaLabel: string;
    onCta: () => void;
    ctaDisabled?: boolean;
    secondaryLabel?: string;
    onSecondary?: () => void;
}

const Arrow: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
);

const ReceiptIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <path d="M4 4h12l2 2v14l-2-1-2 1-2-1-2 1-2-1-2 1V4z" />
        <path d="M8 9h6M8 13h6M8 17h4" />
    </svg>
);

export const FareBreakupBar: React.FC<FareBreakupBarProps> = ({
    label,
    currency,
    totalAmount,
    paxBreakdown,
    paxCounts,
    ctaLabel,
    onCta,
    ctaDisabled,
    secondaryLabel,
    onSecondary,
}) => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <div className="ff-foot-actions ff-foot-actions-floating">
                <div className="ff-foot-summary">
                    <div className="ff-foot-summary-label">{label}</div>
                    <PriceTag currency={currency} amount={totalAmount} />
                </div>
                <button
                    type="button"
                    className="ff-breakup-link"
                    onClick={() => setOpen(true)}
                    aria-label="View fare breakup"
                >
                    <ReceiptIcon />
                    Fare breakup
                </button>
                {secondaryLabel && onSecondary && (
                    <button type="button" className="ff-btn-ghost" onClick={onSecondary}>
                        {secondaryLabel}
                    </button>
                )}
                <button
                    type="button"
                    className="ff-btn-primary"
                    onClick={onCta}
                    disabled={ctaDisabled}
                >
                    {ctaLabel}
                    <Arrow />
                </button>
            </div>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title={
                    <>
                        <ReceiptIcon />
                        Fare breakup
                    </>
                }
            >
                <FareBreakupPanel
                    currency={currency}
                    totalAmount={totalAmount}
                    paxBreakdown={paxBreakdown}
                    paxCounts={paxCounts}
                />
            </Modal>
        </>
    );
};

const FareBreakupPanel: React.FC<{
    currency: string;
    totalAmount: number;
    paxBreakdown: ParsedPaxBreakdown[];
    paxCounts: ParsedSearch['paxCounts'];
}> = ({ currency, totalAmount, paxBreakdown, paxCounts }) => {
    const [tab, setTab] = useState<string>(paxBreakdown[0]?.type || 'ALL');
    const visible = tab === 'ALL' ? paxBreakdown : paxBreakdown.filter((p) => p.type === tab);

    return (
        <div className="ff-price-table" style={{ borderTop: 0 }}>
            {paxBreakdown.length > 1 && (
                <div className="ff-pax-tabs-row" style={{ borderTop: 0 }}>
                    {paxBreakdown.map((p) => (
                        <button
                            key={p.type}
                            className={`ff-tab ${tab === p.type ? 'active' : ''}`}
                            onClick={() => setTab(p.type)}
                        >
                            {labelForPax(p.type)} <span className="count">×{countOfPax(paxCounts, p.type)}</span>
                        </button>
                    ))}
                    <button
                        className={`ff-tab ${tab === 'ALL' ? 'active' : ''}`}
                        onClick={() => setTab('ALL')}
                    >
                        All
                    </button>
                </div>
            )}

            {visible.map((p) => (
                <PaxBreakdownBlock key={p.type} pax={p} />
            ))}

            <div className="ff-line total">
                <div className="label">
                    Total payable
                    <span className="sub">
                        {paxCounts.total} passenger{paxCounts.total === 1 ? '' : 's'} · {currency} · all-inclusive
                    </span>
                </div>
                <div className="val">
                    <span className="cur">{currency}</span>
                    {splitMoney(totalAmount).intPart}
                    <span className="dec">{splitMoney(totalAmount).dec}</span>
                </div>
            </div>
        </div>
    );
};

const PaxBreakdownBlock: React.FC<{ pax: ParsedPaxBreakdown }> = ({ pax }) => {
    const subtotal = pax.subtotal || 0;
    return (
        <>
            <div className="ff-line">
                <div className="label">
                    {labelForPax(pax.type)} · base fare
                    {pax.fareBasis?.length ? (
                        <span className="sub">{pax.fareBasis.join(' / ')}</span>
                    ) : null}
                </div>
                <div className="val">{fmt(pax.baseAmount)}</div>
            </div>
            <div className="ff-line">
                <div className="label">
                    Taxes &amp; surcharges
                    {pax.taxSummary?.length ? (
                        <span className="sub">{pax.taxSummary.slice(0, 3).map((t) => t.code).join(' + ')}</span>
                    ) : null}
                </div>
                <div className="val">{fmt(pax.tax)}</div>
            </div>
            {pax.taxSummary?.slice(0, 3).map((t, i) => (
                <div className="ff-line indent" key={i}>
                    <div className="label">↳ {t.code}{t.name ? ` · ${t.name}` : ''}</div>
                    <div className="val">{fmt(t.amount)}</div>
                </div>
            ))}
            {pax.transactionFee ? (
                <div className="ff-line">
                    <div className="label">Transaction fee<span className="sub">corporate</span></div>
                    <div className="val">{fmt(pax.transactionFee)}</div>
                </div>
            ) : null}
            {pax.autoChargeAdditional ? (
                <div className="ff-line">
                    <div className="label">Additional hour charge<span className="sub">AOHC</span></div>
                    <div className="val">{fmt(pax.autoChargeAdditional)}</div>
                </div>
            ) : null}
            {pax.vat ? (
                <div className="ff-line">
                    <div className="label">VAT / GST</div>
                    <div className="val">{fmt(pax.vat)}</div>
                </div>
            ) : null}
            <div className="ff-line subtotal">
                <div className="label">{labelForPax(pax.type)} subtotal</div>
                <div className="val">{fmt(subtotal)}</div>
            </div>
        </>
    );
};

function fmt(n?: number): string {
    return (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function labelForPax(t: string): string {
    if (t === 'ADT') return 'Adult';
    if (t === 'CHD') return 'Child';
    if (t === 'INF') return 'Infant';
    if (t === 'YOUTH') return 'Youth';
    if (t === 'SENIOR') return 'Senior';
    return t;
}

function countOfPax(paxCounts: ParsedSearch['paxCounts'], t: string): number {
    if (t === 'ADT') return paxCounts.ADT;
    if (t === 'CHD') return paxCounts.CHD;
    if (t === 'INF') return paxCounts.INF;
    return 1;
}
