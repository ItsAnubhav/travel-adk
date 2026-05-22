import React, { FormEvent, useMemo, useState } from 'react';
import {
    FareRuleBadgeTone,
    ParsedFareRule,
    ParsedFareRuleAISummary,
    ParsedFareRuleChargeBlock,
    ParsedFareRulePaxCharges,
    ParsedFareRuleRoute,
} from './types';
import { Alert } from './shellWidgets';

interface FareRulesContentProps {
    rules: ParsedFareRule | null;
    loading: boolean;
    error: string | null;
    onAskQuestion?: (question: string, rules: ParsedFareRule) => Promise<string>;
}

interface ChatTurn {
    id: string;
    question: string;
    answer?: string;
    error?: string;
    pending?: boolean;
}

type TabKey = 'summary' | 'raw';

const InfoIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
    </svg>
);

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        style={{
            width: 14,
            height: 14,
            transition: 'transform 160ms ease',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
    >
        <path d="M9 6l6 6-6 6" />
    </svg>
);

const SparkleIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
);

const SendIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
);

const TLDR: React.FC<{ rules: ParsedFareRule }> = ({ rules }) => (
    <div className="ff-tldr">
        <div className="ff-tldr-item">
            <div className="lbl">Refund · max penalty</div>
            <div className={`val ${rules.headline.refundMax ? '' : 'dash'}`}>
                {rules.headline.refundMax ? (
                    <>
                        <span className="cur">{rules.headline.refundMax.currency}</span>
                        {rules.headline.refundMax.amount.toLocaleString()}
                    </>
                ) : '—'}
            </div>
            <div className="note">per ticket · sale currency</div>
        </div>
        <div className="ff-tldr-item">
            <div className="lbl">Change · penalty</div>
            {rules.headline.changePenalty === 'FREE' ? (
                <div className="val zero">FREE</div>
            ) : rules.headline.changePenalty ? (
                <div className="val">
                    <span className="cur">{rules.headline.changePenalty.currency}</span>
                    {Math.round(rules.headline.changePenalty.amount).toLocaleString()}
                </div>
            ) : (
                <div className="val dash">—</div>
            )}
            <div className="note">voluntary change</div>
        </div>
        <div className="ff-tldr-item">
            <div className="lbl">No-show penalty</div>
            <div className={`val ${rules.headline.noShow ? '' : 'dash'}`}>
                {rules.headline.noShow ? (
                    <>
                        <span className="cur">{rules.headline.noShow.currency}</span>
                        {rules.headline.noShow.amount.toLocaleString()}
                    </>
                ) : '—'}
            </div>
            <div className="note">before departure max</div>
        </div>
        <div className="ff-tldr-item">
            <div className="lbl">Revalidation</div>
            <div className="val dash">—</div>
            <div className="note">not applicable</div>
        </div>
    </div>
);

const badgeStyle = (tone: FareRuleBadgeTone): React.CSSProperties => {
    const map: Record<FareRuleBadgeTone, { bg: string; fg: string; bd: string }> = {
        success: { bg: 'var(--ff-success-soft)', fg: 'var(--ff-success)', bd: 'rgba(21,128,61,0.15)' },
        warning: { bg: 'var(--ff-warn-soft)', fg: 'var(--ff-warn)', bd: 'rgba(180,83,9,0.18)' },
        danger: { bg: 'rgba(220,38,38,0.10)', fg: '#b91c1c', bd: 'rgba(220,38,38,0.20)' },
        info: { bg: 'var(--ff-info-soft)', fg: 'var(--ff-info)', bd: 'rgba(29,78,216,0.15)' },
    };
    const c = map[tone] || map.info;
    return {
        background: c.bg,
        color: c.fg,
        borderColor: c.bd,
        border: `1px solid ${c.bd}`,
        padding: '4px 10px',
        borderRadius: 100,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '0.01em',
    };
};

const PolicyCard: React.FC<{ title: string; summary?: string; children?: React.ReactNode; tone?: 'normal' | 'good' | 'warn' | 'danger' }> = ({ title, summary, children, tone = 'normal' }) => {
    const accent =
        tone === 'good' ? 'var(--ff-success)' :
        tone === 'warn' ? 'var(--ff-warn)' :
        tone === 'danger' ? '#b91c1c' :
        'var(--ff-accent)';
    return (
        <div style={{
            border: '1px solid var(--ff-border)',
            borderRadius: 12,
            padding: '12px 14px',
            background: 'var(--ff-surface)',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
            }}>
                <span style={{ width: 4, height: 14, borderRadius: 2, background: accent }} />
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ff-text)', letterSpacing: '0.01em' }}>{title}</div>
            </div>
            {summary && (
                <div style={{ fontSize: 12.5, color: 'var(--ff-text-2)', lineHeight: 1.5, marginBottom: children ? 8 : 0 }}>
                    {summary}
                </div>
            )}
            {children}
        </div>
    );
};

const KvRow: React.FC<{ label: string; value: React.ReactNode; tone?: 'zero' | 'warn' | 'normal' }> = ({ label, value, tone }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 12,
        padding: '5px 0',
        borderTop: '1px dashed var(--ff-border)',
    }}>
        <div style={{ color: 'var(--ff-text-3)' }}>{label}</div>
        <div style={{
            color: tone === 'zero' ? 'var(--ff-success)' : tone === 'warn' ? 'var(--ff-warn)' : 'var(--ff-text)',
            fontWeight: 600,
            fontFamily: "'Geist Mono', ui-monospace, monospace",
        }}>
            {value}
        </div>
    </div>
);

const AISummaryView: React.FC<{ summary: ParsedFareRuleAISummary; saleCurrency: string }> = ({ summary, saleCurrency }) => {
    const fmt = (amt?: number | null, cur?: string) =>
        amt === null || amt === undefined ? '—' : `${cur || saleCurrency} ${amt.toLocaleString()}`;
    const yesNo = (b?: boolean) => (b === true ? 'Yes' : b === false ? 'No' : '—');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
            {/* Airline / fare banner */}
            {(summary.airline || summary.fareInfo) && (
                <div style={{
                    background: 'linear-gradient(135deg, var(--ff-primary), #1f1f1f)',
                    color: 'white',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: "'Geist Mono', ui-monospace, monospace", letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {summary.airline?.code || '—'}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>
                            {summary.airline?.name || 'Carrier'}
                        </div>
                    </div>
                    {summary.fareInfo && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {summary.fareInfo.cabinClass && (
                                <div>
                                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cabin</div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{summary.fareInfo.cabinClass}</div>
                                </div>
                            )}
                            {summary.fareInfo.bookingClass && (
                                <div>
                                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>RBD</div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{summary.fareInfo.bookingClass}</div>
                                </div>
                            )}
                            {summary.fareInfo.fareType && (
                                <div>
                                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fare</div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{summary.fareInfo.fareType}</div>
                                </div>
                            )}
                            {summary.fareInfo.refundable && (
                                <div>
                                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Refund</div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{summary.fareInfo.refundable}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* UI badges */}
            {summary.uiBadges && summary.uiBadges.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {summary.uiBadges.map((b, i) => (
                        <span key={i} style={badgeStyle(b.type)}>{b.label}</span>
                    ))}
                </div>
            )}

            {/* Policy grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {summary.changePolicy && (
                    <PolicyCard
                        title="Change policy"
                        summary={summary.changePolicy.summary}
                        tone={summary.changePolicy.allowed ? 'good' : 'danger'}
                    >
                        <KvRow label="Allowed" value={yesNo(summary.changePolicy.allowed)} tone={summary.changePolicy.allowed ? 'zero' : 'warn'} />
                        {summary.changePolicy.fee && (
                            <KvRow
                                label="Change fee"
                                value={fmt(summary.changePolicy.fee.amount ?? undefined, summary.changePolicy.fee.currency)}
                            />
                        )}
                        <KvRow label="Same brand only" value={yesNo(summary.changePolicy.sameBrandOnly)} />
                        <KvRow label="No-show change" value={yesNo(summary.changePolicy.noShowChangeAllowed)} tone={summary.changePolicy.noShowChangeAllowed ? 'zero' : 'warn'} />
                    </PolicyCard>
                )}

                {summary.cancellationPolicy && (
                    <PolicyCard
                        title="Cancellation policy"
                        summary={summary.cancellationPolicy.beforeDeparture?.summary || summary.cancellationPolicy.afterDeparture?.summary}
                        tone="warn"
                    >
                        <KvRow
                            label="Before departure"
                            value={
                                summary.cancellationPolicy.beforeDeparture?.allowed
                                    ? fmt(summary.cancellationPolicy.beforeDeparture.fee?.amount, summary.cancellationPolicy.beforeDeparture.fee?.currency)
                                    : 'Not allowed'
                            }
                            tone={summary.cancellationPolicy.beforeDeparture?.allowed ? 'normal' : 'warn'}
                        />
                        <KvRow
                            label="After departure"
                            value={summary.cancellationPolicy.afterDeparture?.allowed ? 'Allowed' : 'Non-refundable'}
                            tone={summary.cancellationPolicy.afterDeparture?.allowed ? 'normal' : 'warn'}
                        />
                        <KvRow
                            label="No-show"
                            value={summary.cancellationPolicy.noShow?.allowed ? 'Allowed' : 'Not permitted'}
                            tone={summary.cancellationPolicy.noShow?.allowed ? 'normal' : 'warn'}
                        />
                    </PolicyCard>
                )}

                {summary.refundPolicy && (
                    <PolicyCard
                        title="Refund policy"
                        summary={summary.refundPolicy.summary}
                        tone={summary.refundPolicy.refundable === 'NONE' ? 'danger' : 'warn'}
                    >
                        <KvRow label="Refundable" value={summary.refundPolicy.refundable || '—'} />
                        <KvRow label="Unused taxes refundable" value={yesNo(summary.refundPolicy.unusedTaxesRefundable)} tone={summary.refundPolicy.unusedTaxesRefundable ? 'zero' : 'warn'} />
                        {summary.refundPolicy.specialCases && summary.refundPolicy.specialCases.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 11, color: 'var(--ff-text-3)', marginBottom: 4 }}>Special cases</div>
                                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--ff-text-2)', lineHeight: 1.5 }}>
                                    {summary.refundPolicy.specialCases.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        )}
                    </PolicyCard>
                )}

                {summary.ticketingPolicy && (
                    <PolicyCard title="Ticketing" summary={summary.ticketingPolicy.summary}>
                        {summary.ticketingPolicy.advancePurchaseDays !== undefined && (
                            <KvRow label="Advance purchase" value={`${summary.ticketingPolicy.advancePurchaseDays}d`} />
                        )}
                        {summary.ticketingPolicy.ticketingTimeLimitHours !== undefined && (
                            <KvRow label="TTL after booking" value={`${summary.ticketingPolicy.ticketingTimeLimitHours}h`} />
                        )}
                        {summary.ticketingPolicy.sameDayTicketingRequiredWithinHours !== undefined && (
                            <KvRow label="Auto-cancel if not ticketed" value={`${summary.ticketingPolicy.sameDayTicketingRequiredWithinHours}h pre-dep`} />
                        )}
                    </PolicyCard>
                )}

                {summary.stayPolicy && (summary.stayPolicy.minimumStay || summary.stayPolicy.maximumStay) && (
                    <PolicyCard title="Stay">
                        <KvRow label="Minimum" value={summary.stayPolicy.minimumStay || '—'} />
                        <KvRow label="Maximum" value={summary.stayPolicy.maximumStay || '—'} />
                    </PolicyCard>
                )}

                {summary.stopoverPolicy && (
                    <PolicyCard title="Stopovers" summary={summary.stopoverPolicy.summary} tone={summary.stopoverPolicy.allowed ? 'good' : 'normal'}>
                        <KvRow label="Allowed" value={yesNo(summary.stopoverPolicy.allowed)} />
                        {summary.stopoverPolicy.freeStopovers !== undefined && (
                            <KvRow label="Free" value={String(summary.stopoverPolicy.freeStopovers)} />
                        )}
                        {summary.stopoverPolicy.paidStopovers !== undefined && (
                            <KvRow
                                label="Paid"
                                value={`${summary.stopoverPolicy.paidStopovers} @ ${fmt(summary.stopoverPolicy.paidStopoverFee?.amount, summary.stopoverPolicy.paidStopoverFee?.currency)}`}
                            />
                        )}
                    </PolicyCard>
                )}

                {summary.transferPolicy && (
                    <PolicyCard title="Transfers">
                        <KvRow label="Unlimited transfers" value={yesNo(summary.transferPolicy.unlimitedTransfers)} />
                        <KvRow label="Surface sector" value={yesNo(summary.transferPolicy.surfaceSectorAllowed)} />
                    </PolicyCard>
                )}

                {summary.childPolicy && (
                    <PolicyCard title="Child / infant pricing">
                        {summary.childPolicy.childDiscountPercent !== undefined && (
                            <KvRow label="Child fare" value={`${summary.childPolicy.childDiscountPercent}%`} />
                        )}
                        {summary.childPolicy.infantWithSeatPercent !== undefined && (
                            <KvRow label="Infant w/ seat" value={`${summary.childPolicy.infantWithSeatPercent}%`} />
                        )}
                        {summary.childPolicy.infantWithoutSeatPercent !== undefined && (
                            <KvRow label="Infant w/o seat" value={`${summary.childPolicy.infantWithoutSeatPercent}%`} />
                        )}
                        <KvRow label="Unaccompanied minor" value={yesNo(summary.childPolicy.unaccompaniedMinorAllowed)} />
                    </PolicyCard>
                )}

                {summary.restrictions && (
                    <PolicyCard title="Restrictions">
                        <KvRow label="Blackout dates" value={yesNo(summary.restrictions.blackoutDates)} tone={summary.restrictions.blackoutDates ? 'warn' : 'zero'} />
                        <KvRow label="Travel restrictions" value={yesNo(summary.restrictions.travelRestrictions)} tone={summary.restrictions.travelRestrictions ? 'warn' : 'zero'} />
                        <KvRow label="Sales restrictions" value={yesNo(summary.restrictions.salesRestrictions)} tone={summary.restrictions.salesRestrictions ? 'warn' : 'zero'} />
                    </PolicyCard>
                )}
            </div>

            {/* Important notes */}
            {summary.importantNotes && summary.importantNotes.length > 0 && (
                <div className="ff-notice">
                    <InfoIcon />
                    <div>
                        <b>Important notes</b>
                        <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.55 }}>
                            {summary.importantNotes.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                    </div>
                </div>
            )}

            {/* AI confidence */}
            {summary.aiConfidence && summary.aiConfidence.overall !== undefined && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 100,
                    background: 'var(--ff-surface-2)',
                    border: '1px solid var(--ff-border)',
                    alignSelf: 'flex-start',
                    fontSize: 11.5,
                    color: 'var(--ff-text-2)',
                }}>
                    <SparkleIcon />
                    <span><b>AI confidence:</b> {Math.round((summary.aiConfidence.overall || 0) * 100)}%</span>
                    {summary.aiConfidence.refundability !== undefined && (
                        <span style={{ color: 'var(--ff-text-3)' }}>· refund {Math.round(summary.aiConfidence.refundability * 100)}%</span>
                    )}
                    {summary.aiConfidence.changeability !== undefined && (
                        <span style={{ color: 'var(--ff-text-3)' }}>· change {Math.round(summary.aiConfidence.changeability * 100)}%</span>
                    )}
                </div>
            )}
        </div>
    );
};

const RouteSection: React.FC<{ route: ParsedFareRuleRoute; defaultOpenIdx?: number }> = ({ route, defaultOpenIdx = -1 }) => {
    const [openIdx, setOpenIdx] = useState<number>(defaultOpenIdx);
    return (
        <div className="ff-sector">
            <div className="ff-sector-head">
                <div className="route">
                    {route.title.split('-').map((part, idx, arr) => (
                        <React.Fragment key={idx}>
                            <span>{part}</span>
                            {idx < arr.length - 1 && <span className="arrow">→</span>}
                        </React.Fragment>
                    ))}
                </div>
                <div className="basis">{route.sections.length} categor{route.sections.length === 1 ? 'y' : 'ies'}</div>
            </div>
            <div style={{ padding: '6px 8px 12px' }}>
                {route.sections.map((s, i) => {
                    const open = openIdx === i;
                    return (
                        <div
                            key={i}
                            style={{
                                border: '1px solid var(--ff-border)',
                                borderRadius: 10,
                                marginBottom: 6,
                                background: open ? 'var(--ff-surface-2)' : 'var(--ff-surface)',
                                overflow: 'hidden',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setOpenIdx(open ? -1 : i)}
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: 0,
                                    padding: '10px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    cursor: 'pointer',
                                    font: 'inherit',
                                    color: 'var(--ff-text)',
                                    fontWeight: 600,
                                    fontSize: 12.5,
                                    letterSpacing: '0.02em',
                                    textAlign: 'left',
                                }}
                            >
                                <ChevronIcon open={open} />
                                <span style={{ flex: 1 }}>{s.title}</span>
                                <span style={{
                                    fontSize: 10.5,
                                    color: 'var(--ff-text-3)',
                                    fontWeight: 500,
                                    fontFamily: "'Geist Mono', ui-monospace, monospace",
                                }}>
                                    {s.value.length > 1 ? `${countLines(s.value)} ln` : '—'}
                                </span>
                            </button>
                            {open && (
                                <pre
                                    style={{
                                        margin: 0,
                                        padding: '10px 14px 14px 36px',
                                        background: 'transparent',
                                        color: 'var(--ff-text-2)',
                                        fontFamily: "'Geist Mono', ui-monospace, monospace",
                                        fontSize: 11.5,
                                        lineHeight: 1.55,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        borderTop: '1px solid var(--ff-border)',
                                    }}
                                >
                                    {s.value}
                                </pre>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ChargeRow: React.FC<{ label: string; pax: ParsedFareRulePaxCharges[]; field: keyof ParsedFareRulePaxCharges; saleCurrency: string }> = ({ label, pax, field, saleCurrency }) => {
    const values = pax.map((p) => Number(p[field] || 0));
    const allZero = values.every((v) => v === 0);
    return (
        <tr>
            <td style={{ padding: '7px 10px', color: 'var(--ff-text-2)', fontSize: 12.5 }}>{label}</td>
            {pax.map((p, i) => {
                const v = values[i];
                return (
                    <td
                        key={p.paxType}
                        style={{
                            padding: '7px 10px',
                            textAlign: 'right',
                            fontFamily: "'Geist Mono', ui-monospace, monospace",
                            fontSize: 12,
                            color: v === 0 ? 'var(--ff-text-4)' : 'var(--ff-text)',
                            fontWeight: v === 0 ? 400 : 600,
                        }}
                    >
                        {allZero ? '—' : v === 0 ? '0' : `${saleCurrency} ${v.toLocaleString()}`}
                    </td>
                );
            })}
        </tr>
    );
};

const ChargesBlock: React.FC<{ block: ParsedFareRuleChargeBlock; saleCurrency: string; index: number }> = ({ block, saleCurrency, index }) => {
    const pax = block.pax;
    const meta = [
        block.airline && `Airline ${block.airline}`,
        block.fareType && `Fare ${block.fareType}`,
        block.bookingClass && `RBD ${block.bookingClass}`,
        block.fareBasisCode && `Basis ${block.fareBasisCode}`,
    ].filter(Boolean) as string[];

    return (
        <div className="ff-sector">
            <div className="ff-sector-head">
                <div className="route">
                    <span style={{ fontWeight: 600 }}>Cancellation &amp; change charges{index > 0 ? ` · ${index + 1}` : ''}</span>
                </div>
                <div className="basis">{meta.join(' · ') || 'per pax type'}</div>
            </div>
            <div style={{ padding: '4px 12px 14px' }}>
                <div style={{ overflow: 'auto', border: '1px solid var(--ff-border)', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                        <thead>
                            <tr style={{ background: 'var(--ff-surface-2)' }}>
                                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--ff-text-3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Event</th>
                                {pax.map((p) => (
                                    <th key={p.paxType} style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11, color: 'var(--ff-text-3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                        {p.paxType}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <ChargeRow label="Before departure" pax={pax} field="beforeDeparture" saleCurrency={saleCurrency} />
                            <ChargeRow label="After departure" pax={pax} field="afterDeparture" saleCurrency={saleCurrency} />
                            <ChargeRow label="Voluntary change" pax={pax} field="voluntaryChange" saleCurrency={saleCurrency} />
                            <ChargeRow label="Involuntary change" pax={pax} field="involuntaryChange" saleCurrency={saleCurrency} />
                            <ChargeRow label="Cancellation" pax={pax} field="cancellation" saleCurrency={saleCurrency} />
                            <ChargeRow label="Reissue" pax={pax} field="reissue" saleCurrency={saleCurrency} />
                            <ChargeRow label="Rerouting" pax={pax} field="rerouting" saleCurrency={saleCurrency} />
                            <ChargeRow label="No-show" pax={pax} field="noShow" saleCurrency={saleCurrency} />
                            <ChargeRow label="Airline service" pax={pax} field="airlineCharge" saleCurrency={saleCurrency} />
                        </tbody>
                    </table>
                </div>
                {block.canxRemarks && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ff-text-2)', lineHeight: 1.5 }}>
                        <b style={{ color: 'var(--ff-text)' }}>Remarks: </b>{block.canxRemarks}
                    </div>
                )}
            </div>
        </div>
    );
};

const RawView: React.FC<{ rules: ParsedFareRule }> = ({ rules }) => {
    const hasNewShape = (rules.routes && rules.routes.length) || (rules.chargeBlocks && rules.chargeBlocks.length);

    if (hasNewShape) {
        return (
            <div style={{ padding: '0 0 12px' }}>
                {rules.routes?.map((r, i) => (
                    <RouteSection key={`${r.title}-${i}`} route={r} defaultOpenIdx={i === 0 ? 0 : -1} />
                ))}
                {rules.chargeBlocks?.map((b, i) => (
                    <ChargesBlock key={i} block={b} saleCurrency={rules.saleCurrency} index={i} />
                ))}
            </div>
        );
    }

    // Legacy sectors fallback.
    return (
        <div style={{ padding: '0 0 12px' }}>
            {rules.sectors.length === 0 ? (
                <div style={{ padding: 16 }}>
                    <Alert tone="info">No per-sector rules were returned. Refer to the headline penalties above.</Alert>
                </div>
            ) : (
                rules.sectors.map((s, i) => (
                    <div className="ff-sector" key={i}>
                        <div className="ff-sector-head">
                            <div className="route">
                                {(s.segment || '').split('-').map((part, idx, arr) => (
                                    <React.Fragment key={idx}>
                                        <span>{part}</span>
                                        {idx < arr.length - 1 && <span className="arrow">→</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="basis">{s.fareBasis || ''}{s.rbd ? ` · ${s.rbd}` : ''}</div>
                        </div>
                        <div className="ff-rules">
                            {s.rules.map((r, idx) => (
                                <div className="ff-rule" key={idx}>
                                    <div className="label">{r.label}</div>
                                    <div className={`val ${r.tone === 'zero' ? 'zero' : r.tone === 'warn' ? 'warn' : ''}`}>{r.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

const QuestionPanel: React.FC<{
    rules: ParsedFareRule;
    onAskQuestion?: FareRulesContentProps['onAskQuestion'];
}> = ({ rules, onAskQuestion }) => {
    const [question, setQuestion] = useState('');
    const [turns, setTurns] = useState<ChatTurn[]>([]);
    const submitting = turns.some((t) => t.pending);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const q = question.trim();
        if (!q || submitting) return;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setQuestion('');
        setTurns((prev) => [...prev, { id, question: q, pending: true }]);

        if (!onAskQuestion) {
            setTurns((prev) => prev.map((t) => t.id === id ? {
                ...t,
                pending: false,
                error: 'AI assistant is not wired up yet — pass an onAskQuestion handler to enable answers.',
            } : t));
            return;
        }
        try {
            const answer = await onAskQuestion(q, rules);
            setTurns((prev) => prev.map((t) => t.id === id ? { ...t, pending: false, answer } : t));
        } catch (err: any) {
            setTurns((prev) => prev.map((t) => t.id === id ? {
                ...t,
                pending: false,
                error: err?.message || 'Request failed',
            } : t));
        }
    };

    return (
        <div style={{
            borderTop: '1px solid var(--ff-border)',
            background: 'var(--ff-surface)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--ff-text-2)',
            }}>
                <SparkleIcon />
                Ask about these fare rules
            </div>

            {turns.length > 0 && (
                <div style={{
                    maxHeight: 220,
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '4px 2px',
                }}>
                    {turns.map((t) => (
                        <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{
                                alignSelf: 'flex-end',
                                background: 'var(--ff-accent-soft)',
                                color: 'var(--ff-accent)',
                                padding: '7px 10px',
                                borderRadius: 12,
                                fontSize: 12.5,
                                maxWidth: '85%',
                                lineHeight: 1.45,
                            }}>
                                {t.question}
                            </div>
                            <div style={{
                                alignSelf: 'flex-start',
                                background: 'var(--ff-surface-2)',
                                border: '1px solid var(--ff-border)',
                                color: t.error ? '#b91c1c' : 'var(--ff-text)',
                                padding: '7px 10px',
                                borderRadius: 12,
                                fontSize: 12.5,
                                maxWidth: '90%',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                            }}>
                                {t.pending ? 'Thinking…' : t.error ? t.error : (t.answer || '—')}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={onAskQuestion ? 'e.g. Can I refund this ticket before departure?' : 'Pass an onAskQuestion handler to enable this input'}
                    disabled={submitting}
                    style={{
                        flex: 1,
                        height: 36,
                        border: '1px solid var(--ff-border)',
                        borderRadius: 10,
                        background: 'var(--ff-surface-2)',
                        color: 'var(--ff-text)',
                        padding: '0 12px',
                        fontSize: 13,
                        outline: 'none',
                    }}
                />
                <button
                    type="submit"
                    disabled={!question.trim() || submitting}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '0 14px',
                        height: 36,
                        borderRadius: 10,
                        border: 0,
                        background: 'var(--ff-primary)',
                        color: 'white',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: !question.trim() || submitting ? 'not-allowed' : 'pointer',
                        opacity: !question.trim() || submitting ? 0.5 : 1,
                    }}
                >
                    <SendIcon />
                    {submitting ? 'Asking…' : 'Send'}
                </button>
            </form>
        </div>
    );
};

/**
 * Renders fare-rule content as a standalone block (no progress bar, no
 * back/continue actions). Designed to be mounted inside a modal/drawer.
 */
export const FareRulesContent: React.FC<FareRulesContentProps> = ({ rules, loading, error, onAskQuestion }) => {
    const [tab, setTab] = useState<TabKey>('summary');
    const hasSummary = !!rules?.summary;

    // If AI summary is missing, fall back to Raw tab as default.
    const effectiveTab: TabKey = hasSummary ? tab : 'raw';

    const tldr = useMemo(() => (rules ? <TLDR rules={rules} /> : null), [rules]);

    if (loading) {
        return (
            <Alert tone="loading" title="Loading fare rules">
                This usually takes 1–3 seconds.
            </Alert>
        );
    }

    if (error && !rules) {
        return (
            <Alert tone="error" title="Fare rule request failed">
                {error}
            </Alert>
        );
    }

    if (!rules) {
        return <Alert tone="info">No fare rules returned for this offer.</Alert>;
    }

    return (
        <>
            <div className="ff-card">
                {tldr}

                {rules.tags.length > 0 && (
                    <div className="ff-tag-row">
                        {rules.tags.map((t, i) => (
                            <span key={i} className={`ff-tag-pill ${t.tone === 'good' ? 'good' : t.tone === 'warn' ? 'warn' : ''}`}>
                                {t.label}
                            </span>
                        ))}
                    </div>
                )}

                {/* Tab strip */}
                <div style={{
                    display: 'flex',
                    gap: 2,
                    padding: '8px 12px 0',
                    borderBottom: '1px solid var(--ff-border)',
                }}>
                    <TabButton
                        active={effectiveTab === 'summary'}
                        onClick={() => setTab('summary')}
                        disabled={!hasSummary}
                    >
                        <SparkleIcon />
                        AI Summary
                        {!hasSummary && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--ff-text-4)' }}>(unavailable)</span>}
                    </TabButton>
                    <TabButton
                        active={effectiveTab === 'raw'}
                        onClick={() => setTab('raw')}
                    >
                        Raw
                    </TabButton>
                </div>

                {effectiveTab === 'summary' && rules.summary
                    ? <AISummaryView summary={rules.summary} saleCurrency={rules.saleCurrency} />
                    : <RawView rules={rules} />}

                <QuestionPanel rules={rules} onAskQuestion={onAskQuestion} />
            </div>

            <div className="ff-notice">
                <InfoIcon />
                <div>
                    <b>Note:</b> Penalties below are charged in <b>{rules.saleCurrency}</b> (the fare's sale currency). The AI Summary is generated from the airline's published rule text; for legal or refund disputes always refer to the Raw tab.
                </div>
            </div>
        </>
    );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ active, onClick, disabled, children }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'transparent',
            border: 0,
            borderBottom: active ? '2px solid var(--ff-accent)' : '2px solid transparent',
            marginBottom: -1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: active ? 'var(--ff-text)' : 'var(--ff-text-3)',
            fontSize: 12.5,
            fontWeight: 600,
            fontFamily: 'inherit',
            opacity: disabled ? 0.6 : 1,
        }}
    >
        {children}
    </button>
);

function countLines(s: string): number {
    if (!s) return 0;
    return s.split(/\r?\n/).length;
}
