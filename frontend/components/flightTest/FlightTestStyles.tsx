import React from 'react';

const CSS = `
.ff-test {
  --ff-bg: #F6F5F1;
  --ff-surface: #FFFFFF;
  --ff-surface-2: #FAF9F6;
  --ff-border: #E7E5E0;
  --ff-border-strong: #D6D3CC;
  --ff-text: #0F0F0E;
  --ff-text-2: #44403C;
  --ff-text-3: #78716C;
  --ff-text-4: #A8A29E;
  --ff-primary: #111111;
  --ff-primary-hover: #2A2A2A;
  --ff-primary-text: #FFFFFF;
  --ff-accent: #C2410C;
  --ff-accent-soft: #FEF3EC;
  --ff-success: #15803D;
  --ff-success-soft: #ECFDF5;
  --ff-info: #1D4ED8;
  --ff-info-soft: #EFF6FF;
  --ff-warn: #B45309;
  --ff-warn-soft: #FFFBEB;
  --ff-danger: #B91C1C;

  background: var(--ff-bg);
  color: var(--ff-text);
  font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
}
.ff-test.embedded {
  height: 100%;
}
.ff-test *, .ff-test *::before, .ff-test *::after { box-sizing: border-box; }
.ff-test::-webkit-scrollbar { width: 10px; }
.ff-test::-webkit-scrollbar-track { background: transparent; }
.ff-test::-webkit-scrollbar-thumb {
  background: rgba(120, 113, 108, 0.35);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.ff-test::-webkit-scrollbar-thumb:hover { background: rgba(120, 113, 108, 0.55); background-clip: padding-box; }

.ff-chat-panel {
  max-width: 640px;
  margin: 0 auto;
  padding: 18px 16px 60px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* PROGRESS BAR */
.ff-progress {
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.ff-progress .step-info { flex: 1; }
.ff-progress .step-label {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ff-text-3);
  margin-bottom: 2px;
}
.ff-progress .step-name { font-size: 13px; font-weight: 600; }
.ff-progress .step-dots { display: flex; gap: 4px; }
.ff-progress .dot { width: 22px; height: 4px; border-radius: 2px; background: var(--ff-border); }
.ff-progress .dot.done { background: var(--ff-success); }
.ff-progress .dot.active { background: var(--ff-primary); }

/* SEARCH SUMMARY */
.ff-search-summary {
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.ff-search-summary .route {
  display: flex; align-items: center; gap: 6px;
  font-weight: 600; font-size: 13px;
}
.ff-search-summary .arrow { color: var(--ff-text-3); font-size: 14px; }
.ff-search-summary .detail {
  color: var(--ff-text-3);
  font-size: 11px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  letter-spacing: 0.02em;
}

/* SECTION LABEL */
.ff-section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ff-text-3);
  padding: 8px 2px 2px;
}
.ff-section-label::before, .ff-section-label::after {
  content: ''; height: 1px; flex: 1; background: var(--ff-border);
}

/* FILTER + SORT controls */
.ff-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  padding: 0 2px;
}
.ff-controls-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ff-controls-label {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ff-text-3);
}

/* TABS */
.ff-tabs {
  display: flex; gap: 5px;
  padding: 0 2px;
  flex-wrap: wrap;
}
.ff-tab {
  background: transparent;
  border: 1px solid var(--ff-border);
  color: var(--ff-text-3);
  padding: 4px 10px;
  font-size: 11.5px;
  border-radius: 100px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
}
.ff-tab.active { background: var(--ff-primary); color: var(--ff-primary-text); border-color: var(--ff-primary); }
.ff-tab .count {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  margin-left: 3px;
  opacity: 0.7;
}

/* LOADING SCREEN (air-shopping) */
.ff-loading-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 32px 8px;
}
.ff-loading-card {
  width: 100%;
  max-width: 360px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.ff-loading-orbit {
  position: relative;
  width: 112px;
  height: 112px;
  margin-bottom: 18px;
  display: flex; align-items: center; justify-content: center;
}
.ff-loading-orbit .ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(17, 17, 17, 0.08);
}
.ff-loading-orbit .ring.r1 {
  inset: 0;
  animation: ffOrbitPulse 2.6s ease-in-out infinite;
}
.ff-loading-orbit .ring.r2 {
  inset: 14px;
  border-color: rgba(194, 65, 12, 0.18);
  border-style: dashed;
  animation: ffOrbitSpin 6s linear infinite;
}
.ff-loading-orbit .ring.r3 {
  inset: 30px;
  border-color: rgba(17, 17, 17, 0.06);
  animation: ffOrbitPulse 2.6s ease-in-out infinite reverse;
}
@keyframes ffOrbitPulse {
  0%, 100% { transform: scale(1);    opacity: 1; }
  50%      { transform: scale(1.06); opacity: 0.55; }
}
@keyframes ffOrbitSpin {
  to { transform: rotate(360deg); }
}
.ff-loading-plane {
  position: relative;
  width: 32px; height: 32px;
  color: var(--ff-primary);
  display: flex; align-items: center; justify-content: center;
  filter: drop-shadow(0 6px 14px rgba(17,17,17,0.2));
  animation: ffPlaneFloat 2.6s ease-in-out infinite;
}
.ff-loading-plane svg { width: 100%; height: 100%; transform: rotate(45deg); }
@keyframes ffPlaneFloat {
  0%, 100% { transform: translateY(0)   rotate(0deg); }
  50%      { transform: translateY(-6px) rotate(-3deg); }
}

.ff-loading-eyebrow {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--ff-accent);
}
.ff-loading-title {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ff-text);
  margin-top: 4px;
}
.ff-loading-sub {
  font-size: 12px;
  color: var(--ff-text-3);
  margin-top: 2px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  letter-spacing: 0.02em;
}

.ff-loading-status {
  margin-top: 14px;
  min-height: 18px;
  font-size: 12.5px;
  color: var(--ff-text-2);
}
.ff-loading-status-text {
  display: inline-block;
  animation: ffStatusIn 0.4s ease-out;
}
@keyframes ffStatusIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.ff-loading-bar {
  margin-top: 18px;
  width: 180px;
  height: 2px;
  background: var(--ff-border);
  border-radius: 999px;
  overflow: hidden;
  position: relative;
}
.ff-loading-bar span {
  position: absolute;
  inset: 0;
  background: var(--ff-primary);
  border-radius: 999px;
  animation: ffBarSlide 1.6s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  transform-origin: left center;
}
@keyframes ffBarSlide {
  0%   { transform: translateX(-100%) scaleX(0.4); }
  50%  { transform: translateX(20%)   scaleX(0.7); }
  100% { transform: translateX(120%)  scaleX(0.4); }
}

/* FRIENDLY ERROR STAGE */
.ff-error-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 32px 8px;
}
.ff-error-card {
  width: 100%;
  max-width: 420px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.ff-error-glyph {
  width: 84px; height: 84px;
  border-radius: 50%;
  background: var(--ff-accent-soft);
  color: var(--ff-accent);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 14px;
  position: relative;
  animation: ffWiggle 1.2s ease-in-out;
}
.ff-error-glyph svg { width: 32px; height: 32px; }
.ff-error-glyph::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1px dashed rgba(194,65,12,0.28);
  animation: ffOrbitSpin 9s linear infinite;
}
@keyframes ffWiggle {
  0%, 100% { transform: rotate(0deg); }
  20%      { transform: rotate(-6deg); }
  45%      { transform: rotate(5deg); }
  70%      { transform: rotate(-3deg); }
}
.ff-error-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ff-text);
}
.ff-error-sub {
  font-size: 13px;
  color: var(--ff-text-2);
  line-height: 1.55;
  margin-top: 2px;
}
.ff-error-detail {
  margin-top: 12px;
  padding: 8px 10px;
  background: var(--ff-surface);
  border: 1px dashed var(--ff-border-strong);
  border-radius: 8px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--ff-text-3);
  word-break: break-word;
  max-width: 100%;
  text-align: left;
}
.ff-error-actions {
  margin-top: 18px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

/* RESULTS META STRIP */
.ff-results-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 2px 2px;
  font-size: 11.5px;
  color: var(--ff-text-3);
}
.ff-results-meta-left {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.ff-results-meta-left .count {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--ff-text);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.ff-results-meta-left .muted { color: var(--ff-text-3); }
.ff-results-meta-right {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--ff-text-3);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* FLIGHT CARD */
.ff-card {
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ff-card:hover { border-color: var(--ff-border-strong); box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.ff-card-head {
  padding: 12px 14px;
  border-bottom: 1px solid var(--ff-border);
  background: var(--ff-surface-2);
  display: flex; justify-content: space-between; align-items: center;
}
.ff-card-head h2 {
  font-size: 13px; font-weight: 600; margin: 0;
  display: flex; align-items: center; gap: 8px;
}
.ff-card-head h2 svg { width: 15px; height: 15px; color: var(--ff-accent); }
.ff-card-head .meta {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px; color: var(--ff-text-3);
  letter-spacing: 0.05em; text-transform: uppercase;
}

.ff-card-top {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 12px;
  padding: 10px 14px 8px;
  align-items: center;
}
.ff-airline-mark {
  width: 36px; height: 36px;
  border-radius: 8px;
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  object-fit: contain;
  flex-shrink: 0;
}
.ff-airline-mark.fallback {
  background: var(--ff-primary);
  color: var(--ff-primary-text);
  border-color: var(--ff-primary);
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.04em;
  font-family: 'Geist Mono', ui-monospace, monospace;
}
.ff-airline-info { min-width: 0; }
.ff-airline-name {
  font-weight: 500; font-size: 13px; color: var(--ff-text); line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ff-airline-name .meta { color: var(--ff-text-3); font-weight: 400; }
.ff-badges { display: flex; gap: 5px; margin-top: 4px; flex-wrap: wrap; }
.ff-badge {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--ff-surface-2);
  border: 1px solid var(--ff-border);
  color: var(--ff-text-3);
  letter-spacing: 0.04em;
  font-weight: 500;
  white-space: nowrap;
}
.ff-badge.refund { background: var(--ff-success-soft); color: var(--ff-success); border-color: rgba(21,128,61,0.15); }
.ff-badge.stop { background: var(--ff-accent-soft); color: var(--ff-accent); border-color: rgba(194,65,12,0.15); }
.ff-badge.nonstop { background: var(--ff-info-soft); color: var(--ff-info); border-color: rgba(29,78,216,0.15); }

.ff-price-action {
  display: flex; flex-direction: column;
  align-items: flex-end; gap: 6px; flex-shrink: 0;
}
.ff-price {
  font-size: 18px; font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.ff-price .cur {
  font-size: 10px; color: var(--ff-text-3); font-weight: 500;
  margin-right: 2px; vertical-align: 4px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  letter-spacing: 0.04em;
}
.ff-price .dec { font-size: 12px; color: var(--ff-text-3); font-weight: 500; }

/* BUTTONS */
.ff-btn-primary {
  background: var(--ff-primary);
  color: var(--ff-primary-text);
  border: none;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, transform 0.1s;
  display: inline-flex; align-items: center; gap: 4px;
  white-space: nowrap;
}
.ff-btn-primary:hover { background: var(--ff-primary-hover); }
.ff-btn-primary:active { transform: scale(0.97); }
.ff-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ff-btn-primary svg { width: 12px; height: 12px; }
.ff-btn-ghost {
  background: transparent;
  border: 1px solid var(--ff-border);
  color: var(--ff-text-2);
  padding: 7px 14px;
  font-size: 12.5px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
}
.ff-btn-ghost:hover { background: var(--ff-surface); border-color: var(--ff-border-strong); }
.ff-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

/* LEGS */
.ff-legs { border-top: 1px solid var(--ff-border); background: var(--ff-surface-2); }
.ff-leg-row {
  display: grid;
  grid-template-columns: 60px 1fr auto;
  gap: 10px;
  padding: 9px 14px;
  align-items: center;
  border-bottom: 1px dashed var(--ff-border);
}
.ff-leg-row:last-child { border-bottom: 0; }
.ff-leg-dir { display: flex; flex-direction: column; }
.ff-leg-dir .dir {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--ff-text-3); font-weight: 600;
  display: inline-flex; align-items: center; gap: 3px;
}
.ff-leg-dir .day {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10.5px; color: var(--ff-text-2); font-weight: 500;
  letter-spacing: 0.02em; margin-top: 2px;
}
.ff-leg-route {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.ff-leg-ep .time {
  font-size: 15px; font-weight: 600;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}
.ff-leg-ep .time .plus {
  font-size: 10px; color: var(--ff-accent);
  vertical-align: super; margin-left: 2px; font-weight: 500;
}
.ff-leg-ep .iata {
  font-size: 11px; color: var(--ff-text-3); margin-top: 3px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  letter-spacing: 0.05em; line-height: 1;
}
.ff-leg-ep.r { text-align: right; }
.ff-leg-arrow {
  position: relative;
  width: 40px; height: 1px;
  background: var(--ff-border-strong);
}
.ff-leg-arrow::before, .ff-leg-arrow::after {
  content: ''; position: absolute; top: 50%;
  width: 3px; height: 3px; border-radius: 50%;
  background: var(--ff-text-4);
  transform: translateY(-50%);
}
.ff-leg-arrow::before { left: 0; } .ff-leg-arrow::after { right: 0; }
.ff-leg-meta {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px; color: var(--ff-text-3);
  letter-spacing: 0.02em; text-align: right; white-space: nowrap;
}
.ff-leg-meta .dur { color: var(--ff-text); font-weight: 500; }

/* SUMMARY BAR */
.ff-summary-bar {
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px;
}
.ff-summary-bar .left { display: flex; align-items: center; gap: 10px; }
.ff-summary-bar .icon {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: var(--ff-surface-2);
  border: 1px solid var(--ff-border);
  display: flex; align-items: center; justify-content: center;
  color: var(--ff-text-2);
}
.ff-summary-bar .icon svg { width: 14px; height: 14px; }
.ff-summary-bar .label { font-size: 11px; color: var(--ff-text-3); }
.ff-summary-bar .value { font-size: 13px; font-weight: 600; margin-top: 1px; }
.ff-summary-bar .right .price { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.ff-summary-bar .right .price .cur {
  font-size: 10px; color: var(--ff-text-3); font-weight: 500;
  margin-right: 2px; vertical-align: 4px;
  font-family: 'Geist Mono', ui-monospace, monospace;
}

/* MATCH BANNER */
.ff-match-banner {
  background: linear-gradient(135deg, var(--ff-success-soft), var(--ff-surface));
  border: 1px solid rgba(21,128,61,0.15);
  border-radius: 14px;
  padding: 12px 14px;
  display: flex; align-items: center; gap: 10px;
  font-size: 13px;
}
.ff-match-banner .check {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--ff-success); color: white;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ff-match-banner .check svg { width: 14px; height: 14px; }
.ff-match-banner b { color: var(--ff-success); font-weight: 600; }
.ff-match-banner .timer {
  margin-left: auto;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px; color: var(--ff-text-3);
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 100px; padding: 3px 8px;
}

/* PRICE TABLE */
.ff-itin-recap { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.ff-itin-line { display: grid; grid-template-columns: 80px 1fr auto; gap: 12px; align-items: center; font-size: 12.5px; }
.ff-itin-line .leg-tag {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px; color: var(--ff-text-3);
  letter-spacing: 0.05em; text-transform: uppercase;
}
.ff-itin-line .route { display: flex; align-items: center; gap: 6px; font-weight: 500; }
.ff-itin-line .route .arrow { color: var(--ff-text-4); }
.ff-itin-line .route .via {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px; color: var(--ff-text-3); font-weight: 400; margin-left: 4px;
}
.ff-itin-line .when {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px; color: var(--ff-text-3); letter-spacing: 0.02em;
}

.ff-policy {
  margin: 0 16px 14px;
  padding: 10px 12px;
  background: var(--ff-info-soft);
  border: 1px solid rgba(29,78,216,0.15);
  border-radius: 10px;
  display: flex; gap: 10px; align-items: center;
  font-size: 12.5px;
}
.ff-policy svg { width: 16px; height: 16px; color: var(--ff-info); flex-shrink: 0; }
.ff-policy .text { flex: 1; color: var(--ff-text-2); }
.ff-policy .text b { color: var(--ff-info); font-weight: 600; }
.ff-policy .badge-info {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  background: var(--ff-info); color: white;
  padding: 3px 7px; border-radius: 6px;
  letter-spacing: 0.04em; text-transform: uppercase;
}

.ff-price-table { border-top: 1px solid var(--ff-border); }
.ff-section-title {
  padding: 10px 16px 4px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10.5px; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--ff-text-3);
}
.ff-pax-tabs-row {
  display: flex; gap: 4px;
  padding: 8px 16px;
  border-top: 1px solid var(--ff-border);
  background: var(--ff-surface-2);
  flex-wrap: wrap;
}
.ff-pax-tabs-row .ff-tab { padding: 4px 10px; font-size: 11.5px; }
.ff-line {
  display: grid; grid-template-columns: 1fr auto;
  padding: 7px 16px; font-size: 12.5px; align-items: baseline;
}
.ff-line .label { color: var(--ff-text-2); }
.ff-line .label .sub {
  display: block; font-size: 10.5px; color: var(--ff-text-4);
  font-family: 'Geist Mono', ui-monospace, monospace; margin-top: 1px;
}
.ff-line .val { font-variant-numeric: tabular-nums; font-weight: 500; color: var(--ff-text); }
.ff-line.indent { padding-left: 32px; }
.ff-line.indent .label { color: var(--ff-text-3); font-size: 12px; }
.ff-line.indent .val { color: var(--ff-text-3); font-size: 12px; font-weight: 400; }
.ff-line.subtotal {
  padding-top: 10px; padding-bottom: 10px;
  border-top: 1px dashed var(--ff-border);
  background: var(--ff-surface-2);
}
.ff-line.subtotal .label { font-weight: 600; color: var(--ff-text); }
.ff-line.subtotal .val { font-weight: 600; }
.ff-line.total {
  padding: 14px 16px;
  background: var(--ff-surface-2);
  border-top: 1px solid var(--ff-border);
  align-items: center;
}
.ff-line.total .label { font-size: 13px; font-weight: 600; color: var(--ff-text); }
.ff-line.total .label .sub {
  font-size: 11px; color: var(--ff-text-3); margin-top: 2px;
  font-family: 'Geist', sans-serif;
}
.ff-line.total .val { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
.ff-line.total .val .cur {
  font-size: 11px; color: var(--ff-text-3); font-weight: 500;
  margin-right: 4px; vertical-align: 6px;
  font-family: 'Geist Mono', ui-monospace, monospace; letter-spacing: 0.05em;
}
.ff-line.total .val .dec { font-size: 13px; color: var(--ff-text-3); font-weight: 500; }

/* PAY METHODS */
.ff-pay-list {
  padding: 8px 16px 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.ff-pay {
  display: grid;
  grid-template-columns: 20px auto 1fr auto;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--ff-border);
  border-radius: 10px;
  cursor: pointer;
  align-items: center;
  transition: border-color 0.15s, background 0.15s;
  background: var(--ff-surface);
}
.ff-pay:hover { background: var(--ff-surface-2); }
.ff-pay.selected {
  border-color: var(--ff-primary);
  background: var(--ff-surface-2);
  box-shadow: 0 0 0 3px rgba(17,17,17,0.06);
}
.ff-pay .radio {
  width: 16px; height: 16px; border-radius: 50%;
  border: 1.5px solid var(--ff-border-strong);
  position: relative;
}
.ff-pay.selected .radio { border-color: var(--ff-primary); }
.ff-pay.selected .radio::after {
  content: ''; position: absolute; inset: 3px;
  border-radius: 50%; background: var(--ff-primary);
}
.ff-pay .pmark {
  width: 32px; height: 22px;
  border-radius: 4px;
  background: var(--ff-surface-2);
  border: 1px solid var(--ff-border);
  display: flex; align-items: center; justify-content: center;
}
.ff-pay .pmark svg { width: 18px; height: 18px; color: var(--ff-text-2); }
.ff-pay .pinfo .pname { font-size: 13px; font-weight: 500; }
.ff-pay .pinfo .psub { font-size: 11.5px; color: var(--ff-text-3); margin-top: 1px; }
.ff-pay .pchip {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px; padding: 3px 7px; border-radius: 6px;
  background: var(--ff-accent-soft); color: var(--ff-accent);
  letter-spacing: 0.05em; text-transform: uppercase;
}

/* FOOT ACTIONS */
.ff-foot-actions {
  display: flex; gap: 8px;
  padding: 12px 14px;
  background: var(--ff-surface-2);
  border-top: 1px solid var(--ff-border);
}
.ff-foot-actions .ff-btn-primary { flex: 1; justify-content: center; padding: 9px 16px; font-size: 13px; }

/* PASSENGER FORM */
.ff-pax-tabs {
  display: flex; gap: 1px;
  background: var(--ff-border);
  padding: 1px;
  border-radius: 10px;
  margin: 12px 14px 0;
}
.ff-pax-tab {
  flex: 1;
  background: var(--ff-surface);
  border: none;
  padding: 8px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--ff-text-3);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-weight: 500;
}
.ff-pax-tab:first-child { border-radius: 9px 0 0 9px; }
.ff-pax-tab:last-child { border-radius: 0 9px 9px 0; }
.ff-pax-tab.active { background: var(--ff-primary); color: var(--ff-primary-text); }
.ff-pax-tab .tag {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 9.5px; letter-spacing: 0.04em; opacity: 0.6;
}
.ff-pax-tab .num {
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--ff-surface-2);
  border: 1px solid var(--ff-border);
  font-size: 9.5px;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 600;
  font-family: 'Geist Mono', ui-monospace, monospace;
  color: var(--ff-text-3);
}
.ff-pax-tab.active .num { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.3); color: white; }
.ff-pax-tab .check {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--ff-success-soft); color: var(--ff-success);
  display: inline-flex; align-items: center; justify-content: center;
}
.ff-pax-tab.active .check { background: rgba(255,255,255,0.2); color: white; }
.ff-pax-tab .check svg { width: 9px; height: 9px; }

.ff-form { padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.ff-field-group-label {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ff-text-3);
  display: flex; align-items: center; gap: 8px;
  padding-top: 4px;
}
.ff-field-group-label::after { content: ''; flex: 1; height: 1px; background: var(--ff-border); }
.ff-collapsible-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 0 4px;
  background: transparent;
  border: 0;
  font: inherit;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ff-text-3);
  cursor: pointer;
  text-align: left;
}
.ff-collapsible-head:hover { color: var(--ff-text-2); }
.ff-collapsible-head .chev {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease;
}
.ff-collapsible-head .chev.open { transform: rotate(90deg); }
.ff-collapsible-head .chev svg { width: 11px; height: 11px; }
.ff-collapsible-head .opt {
  font-family: 'Geist', 'Inter', sans-serif;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
  color: var(--ff-text-4);
}
.ff-collapsible-head::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--ff-border);
}
.ff-field-row { display: grid; gap: 8px; }
.ff-field-row.cols-2 { grid-template-columns: 1fr 1fr; }
.ff-field-row.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.ff-field-row.cols-title-name { grid-template-columns: 80px 1fr 1fr; }
.ff-field-row.cols-phone { grid-template-columns: 110px 1fr; }
.ff-field-row.cols-doc-num { grid-template-columns: 130px 1fr; }
.ff-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ff-field label {
  font-size: 11px; color: var(--ff-text-3); font-weight: 500;
  display: flex; justify-content: space-between; align-items: center;
}
.ff-field label .req { color: var(--ff-accent); margin-left: 2px; }
.ff-field label .hint {
  font-size: 10px; color: var(--ff-text-4); font-weight: 400;
  font-family: 'Geist Mono', ui-monospace, monospace; letter-spacing: 0.02em;
}
.ff-field input, .ff-field select, .ff-field textarea {
  width: 100%; height: 34px;
  border: 1px solid var(--ff-border);
  border-radius: 8px;
  background: var(--ff-surface);
  padding: 0 10px;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--ff-text);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ff-field input::placeholder { color: var(--ff-text-4); }
.ff-field input:focus, .ff-field select:focus, .ff-field textarea:focus {
  border-color: var(--ff-primary);
  box-shadow: 0 0 0 3px rgba(17,17,17,0.06);
}
.ff-field select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2378716C' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 14px;
  padding-right: 28px;
  cursor: pointer;
}
.ff-field .helper { font-size: 10.5px; color: var(--ff-text-3); margin-top: 1px; }
.ff-checkbox-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0;
}
.ff-checkbox-row input[type=checkbox] { width: 16px; height: 16px; accent-color: var(--ff-primary); cursor: pointer; }
.ff-checkbox-row label { font-size: 12px; color: var(--ff-text-2); cursor: pointer; }

/* FARE RULE */
.ff-tldr {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--ff-border);
}
.ff-tldr-item { background: var(--ff-surface); padding: 14px 16px; }
.ff-tldr-item .lbl {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10.5px; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--ff-text-3); margin-bottom: 6px;
}
.ff-tldr-item .val {
  font-size: 20px; font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.ff-tldr-item .val.zero { color: var(--ff-success); }
.ff-tldr-item .val.dash { color: var(--ff-text-4); font-weight: 500; }
.ff-tldr-item .val .cur {
  font-size: 11px; color: var(--ff-text-3); font-weight: 500;
  margin-right: 3px; vertical-align: 4px;
  font-family: 'Geist Mono', ui-monospace, monospace;
}
.ff-tldr-item .note { font-size: 11px; color: var(--ff-text-3); margin-top: 2px; }
.ff-tag-row {
  padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 6px;
  border-top: 1px solid var(--ff-border);
  border-bottom: 1px solid var(--ff-border);
  background: var(--ff-surface-2);
}
.ff-tag-pill {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px; padding: 3px 7px; border-radius: 6px;
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  color: var(--ff-text-3);
  letter-spacing: 0.04em; font-weight: 500;
}
.ff-tag-pill.good { background: var(--ff-success-soft); color: var(--ff-success); border-color: rgba(21,128,61,0.15); }
.ff-tag-pill.warn { background: var(--ff-accent-soft); color: var(--ff-accent); border-color: rgba(194,65,12,0.15); }
.ff-sector { border-bottom: 1px solid var(--ff-border); }
.ff-sector:last-child { border-bottom: 0; }
.ff-sector-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px;
  background: var(--ff-surface-2);
  border-bottom: 1px solid var(--ff-border);
}
.ff-sector-head .route { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
.ff-sector-head .route .arrow { color: var(--ff-accent); font-size: 14px; }
.ff-sector-head .basis {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px; color: var(--ff-text-3); letter-spacing: 0.03em;
}
.ff-rules { padding: 6px 16px 14px; }
.ff-rule {
  display: grid; grid-template-columns: 1fr auto;
  gap: 12px; padding: 10px 0;
  border-bottom: 1px dashed var(--ff-border);
  align-items: baseline;
}
.ff-rule:last-child { border-bottom: 0; }
.ff-rule .label { font-size: 13px; color: var(--ff-text-2); }
.ff-rule .label .sub {
  display: block; font-size: 11px; color: var(--ff-text-4); margin-top: 2px;
  font-family: 'Geist Mono', ui-monospace, monospace; letter-spacing: 0.02em;
}
.ff-rule .val {
  font-size: 13.5px; font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right; white-space: nowrap;
}
.ff-rule .val .cur {
  font-size: 10px; color: var(--ff-text-3); font-weight: 500;
  margin-right: 2px;
  font-family: 'Geist Mono', ui-monospace, monospace; letter-spacing: 0.05em;
}
.ff-rule .val.zero { color: var(--ff-success); }
.ff-rule .val.warn { color: var(--ff-accent); }
.ff-rule .val.dash { color: var(--ff-text-4); font-weight: 400; }

.ff-notice {
  background: var(--ff-warn-soft);
  border: 1px solid rgba(180, 83, 9, 0.18);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex; gap: 10px; align-items: flex-start;
  font-size: 12.5px;
  color: var(--ff-text-2);
  line-height: 1.5;
}
.ff-notice svg { width: 16px; height: 16px; color: var(--ff-warn); flex-shrink: 0; margin-top: 2px; }
.ff-notice b { color: var(--ff-text); font-weight: 600; }

/* PNR HERO */
.ff-pnr-hero {
  background: linear-gradient(135deg, var(--ff-primary), #1f1f1f);
  color: white;
  border-radius: 14px;
  padding: 16px 18px;
  position: relative;
  overflow: hidden;
}
.ff-pnr-hero .top { display: flex; align-items: center; justify-content: space-between; }
.ff-pnr-hero .conf {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px;
  color: var(--ff-success);
  font-weight: 600;
  background: rgba(21,128,61,0.18);
  padding: 4px 8px; border-radius: 100px;
}
.ff-pnr-hero .conf .pulse {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--ff-success);
  box-shadow: 0 0 6px var(--ff-success);
}
.ff-pnr-hero .status {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10.5px; color: rgba(255,255,255,0.6);
  letter-spacing: 0.05em; text-transform: uppercase;
}
.ff-pnr-hero .lbl {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px; color: rgba(255,255,255,0.55);
  letter-spacing: 0.06em; text-transform: uppercase;
  margin-top: 12px;
}
.ff-pnr-hero .pnr {
  font-size: 32px; font-weight: 700;
  letter-spacing: 0.12em;
  font-family: 'Geist Mono', ui-monospace, monospace;
  margin-top: 4px;
}
.ff-pnr-hero .meta-row {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px; margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(255,255,255,0.1);
}
.ff-pnr-hero .meta-row .m { min-width: 0; }
.ff-pnr-hero .meta-row .l {
  font-size: 10px; color: rgba(255,255,255,0.5);
  font-family: 'Geist Mono', ui-monospace, monospace;
  letter-spacing: 0.06em; text-transform: uppercase;
}
.ff-pnr-hero .meta-row .v {
  font-size: 12.5px; font-weight: 500;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* PNR PASSENGERS */
.ff-pax-list .pax {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px dashed var(--ff-border);
  align-items: center;
}
.ff-pax-list .pax:last-child { border-bottom: 0; }
.ff-pax-list .pax .ic {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--ff-accent-soft);
  color: var(--ff-accent);
  display: flex; align-items: center; justify-content: center;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.02em;
  font-family: 'Geist Mono', ui-monospace, monospace;
}
.ff-pax-list .pax .info .name {
  font-size: 13px; font-weight: 600;
}
.ff-pax-list .pax .info .name .title {
  font-weight: 400; color: var(--ff-text-3); margin-right: 6px;
}
.ff-pax-list .pax .info .sub {
  font-size: 11px; color: var(--ff-text-3);
  margin-top: 2px;
  font-family: 'Geist Mono', ui-monospace, monospace;
}
.ff-pax-list .pax .type {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 6px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: var(--ff-surface-2);
  border: 1px solid var(--ff-border);
  color: var(--ff-text-3);
}

/* PNR SEGMENTS */
.ff-seg {
  padding: 12px 16px;
  border-bottom: 1px dashed var(--ff-border);
}
.ff-seg:last-child { border-bottom: 0; }
.ff-seg .seg-head {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 8px;
}
.ff-seg .seg-head .name { font-size: 13px; font-weight: 600; }
.ff-seg .seg-head .name .num {
  font-size: 11px; color: var(--ff-text-3); font-weight: 400;
  font-family: 'Geist Mono', ui-monospace, monospace;
  margin-left: 4px;
}
.ff-seg .seg-head .day {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px; color: var(--ff-text-3);
  letter-spacing: 0.04em;
}
.ff-seg .seg-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px; align-items: center;
}
.ff-seg .seg-ep .time {
  font-size: 18px; font-weight: 500;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums; line-height: 1;
}
.ff-seg .seg-ep .time .plus {
  font-size: 11px; color: var(--ff-accent);
  vertical-align: super; margin-left: 3px; font-weight: 500;
}
.ff-seg .seg-ep .iata {
  font-size: 11px; color: var(--ff-text-3);
  margin-top: 4px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  letter-spacing: 0.06em;
}
.ff-seg .seg-ep .iata b { color: var(--ff-text-2); font-weight: 600; }
.ff-seg .seg-ep.r { text-align: right; }
.ff-seg .seg-path { text-align: center; min-width: 100px; }
.ff-seg .seg-path .dur {
  font-size: 10.5px; color: var(--ff-text-3);
  font-family: 'Geist Mono', ui-monospace, monospace;
}
.ff-seg .seg-path .line {
  position: relative; height: 1px;
  background: var(--ff-border-strong);
  margin: 6px 4px;
}
.ff-seg .seg-path .line::before, .ff-seg .seg-path .line::after {
  content: ''; position: absolute; top: 50%;
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--ff-text-3);
  transform: translateY(-50%);
}
.ff-seg .seg-path .line::before { left: 0; } .ff-seg .seg-path .line::after { right: 0; }
.ff-seg .seg-foot {
  margin-top: 10px;
  font-size: 11px; color: var(--ff-text-3);
  font-family: 'Geist Mono', ui-monospace, monospace;
  letter-spacing: 0.02em;
  display: flex; justify-content: space-between;
}

/* TOTAL CARD */
.ff-total-card {
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex; justify-content: space-between; align-items: center;
}
.ff-total-card .l { font-size: 13px; color: var(--ff-text-2); font-weight: 500; }
.ff-total-card .l .s {
  display: block; font-size: 11px; color: var(--ff-text-3);
  font-family: 'Geist Mono', ui-monospace, monospace;
  margin-top: 2px; letter-spacing: 0.02em;
}
.ff-total-card .v {
  font-size: 22px; font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.ff-total-card .v .cur {
  font-size: 11px; color: var(--ff-text-3); font-weight: 500;
  margin-right: 4px; vertical-align: 6px;
  font-family: 'Geist Mono', ui-monospace, monospace;
}
.ff-total-card .v .dec { font-size: 13px; color: var(--ff-text-3); font-weight: 500; }

/* CONTACT */
.ff-contact-row {
  display: grid; grid-template-columns: auto 1fr;
  gap: 12px; padding: 12px 16px;
  border-bottom: 1px dashed var(--ff-border);
  align-items: center;
}
.ff-contact-row:last-child { border-bottom: 0; }
.ff-contact-row .ic {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: var(--ff-surface-2);
  border: 1px solid var(--ff-border);
  display: flex; align-items: center; justify-content: center;
  color: var(--ff-text-2);
}
.ff-contact-row .ic svg { width: 15px; height: 15px; }
.ff-contact-row .info .l {
  font-size: 11px; color: var(--ff-text-3);
  text-transform: uppercase;
  font-family: 'Geist Mono', ui-monospace, monospace;
  letter-spacing: 0.05em; margin-bottom: 1px;
}
.ff-contact-row .info .v { font-size: 13px; font-weight: 500; word-break: break-all; }

/* ALERTS */
.ff-alert {
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 12.5px;
  border: 1px solid;
  display: flex; gap: 8px; align-items: flex-start;
}
.ff-alert.error { background: #FEF2F2; border-color: #FCA5A5; color: #991B1B; }
.ff-alert.info { background: var(--ff-info-soft); border-color: rgba(29,78,216,0.18); color: var(--ff-text-2); }
.ff-alert.loading { background: var(--ff-surface-2); border-color: var(--ff-border); color: var(--ff-text-3); }
.ff-alert svg { width: 14px; height: 14px; margin-top: 2px; flex-shrink: 0; }
.ff-alert b { color: inherit; font-weight: 600; }

/* MODAL */
.ff-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 15, 14, 0.55);
  z-index: 60;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 16px 24px;
  overflow-y: auto;
  backdrop-filter: blur(2px);
  animation: ffFadeIn 0.15s ease-out;
}
.ff-modal {
  width: 100%;
  max-width: 620px;
  background: var(--ff-bg);
  border: 1px solid var(--ff-border);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ffSlideIn 0.18s ease-out;
}
.ff-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ff-border);
  background: var(--ff-surface);
}
.ff-modal-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  display: flex; align-items: center; gap: 8px;
}
.ff-modal-head h3 svg { width: 15px; height: 15px; color: var(--ff-accent); }
.ff-modal-close {
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--ff-text-3);
  width: 30px; height: 30px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font: inherit;
}
.ff-modal-close:hover { background: var(--ff-surface-2); color: var(--ff-text); }
.ff-modal-body {
  padding: 14px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--ff-bg);
}

@keyframes ffFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* FARE RULE BUTTON ROW (passenger page) */
.ff-rules-trigger {
  background: var(--ff-surface);
  border: 1px dashed var(--ff-border-strong);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex; align-items: center; gap: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.ff-rules-trigger:hover {
  background: var(--ff-surface-2);
  border-color: var(--ff-primary);
}
.ff-rules-trigger .ic {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: var(--ff-accent-soft);
  color: var(--ff-accent);
  display: flex; align-items: center; justify-content: center;
}
.ff-rules-trigger .ic svg { width: 16px; height: 16px; }
.ff-rules-trigger .info { flex: 1; min-width: 0; }
.ff-rules-trigger .info .t { font-size: 13px; font-weight: 600; }
.ff-rules-trigger .info .s {
  font-size: 11px; color: var(--ff-text-3);
  margin-top: 2px;
}
.ff-rules-trigger .badge-mini {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 100px;
  background: var(--ff-surface-2);
  color: var(--ff-text-3);
  border: 1px solid var(--ff-border);
}
.ff-rules-trigger .badge-mini.loading { color: var(--ff-text-3); }
.ff-rules-trigger .badge-mini.ready { background: var(--ff-success-soft); color: var(--ff-success); border-color: rgba(21,128,61,0.2); }
.ff-rules-trigger .badge-mini.error { background: #FEF2F2; color: var(--ff-danger); border-color: rgba(185,28,28,0.2); }
.ff-rules-trigger .chev { color: var(--ff-text-3); }

/* DEBUG TOGGLE */
.ff-debug-strip {
  position: sticky; top: 0; z-index: 30;
  background: var(--ff-surface);
  border-bottom: 1px solid var(--ff-border);
  padding: 8px 14px;
  display: flex; align-items: center; gap: 10px;
  font-size: 12px;
}
.ff-debug-strip .badge-mono {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--ff-text-3);
  background: var(--ff-surface-2);
  border: 1px solid var(--ff-border);
  padding: 3px 8px; border-radius: 100px;
}
.ff-debug-strip .grow { flex: 1; }
.ff-debug-strip button {
  background: transparent;
  border: 1px solid var(--ff-border);
  color: var(--ff-text-2);
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}
.ff-debug-strip button.active { background: var(--ff-primary); color: var(--ff-primary-text); border-color: var(--ff-primary); }

.ff-debug-drawer {
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 12px;
  overflow: hidden;
}
.ff-debug-drawer pre {
  margin: 0;
  padding: 12px 14px;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--ff-text-2);
  background: var(--ff-surface-2);
  overflow: auto;
  max-height: 360px;
}

@keyframes ffSlideIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.ff-progress, .ff-search-summary, .ff-summary-bar, .ff-card, .ff-match-banner, .ff-total-card, .ff-pnr-hero, .ff-brand-card {
  animation: ffSlideIn 0.32s ease-out backwards;
}
.ff-card:nth-of-type(2) { animation-delay: 0.06s; }
.ff-card:nth-of-type(3) { animation-delay: 0.1s; }

/* RESULT-CARD "from N fares" hints */
.ff-badge.fares {
  background: var(--ff-info-soft);
  color: var(--ff-info);
  border-color: rgba(29,78,216,0.15);
}
.ff-from-label {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ff-text-3);
  margin-bottom: -2px;
}

/* CABIN-CLASS TABS (branded fare page) */
.ff-cabin-tabs {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 12px;
  flex-wrap: wrap;
}
.ff-cabin-tab {
  flex: 1 1 auto;
  min-width: 120px;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 8px;
  row-gap: 0;
  align-items: center;
  padding: 8px 12px;
  border-radius: 9px;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
  color: var(--ff-text-2);
  text-align: left;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.ff-cabin-tab:hover { background: var(--ff-surface-2); }
.ff-cabin-tab.active {
  background: var(--ff-primary);
  border-color: var(--ff-primary);
  color: var(--ff-primary-text);
}
.ff-cabin-tab .cabin-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-transform: capitalize;
  line-height: 1.2;
}
.ff-cabin-tab .cabin-min {
  grid-column: 1;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: var(--ff-text-3);
  letter-spacing: 0.02em;
  margin-top: 2px;
}
.ff-cabin-tab.active .cabin-min { color: rgba(255,255,255,0.7); }
.ff-cabin-tab .cabin-count {
  grid-row: 1 / span 2;
  grid-column: 2;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 100px;
  background: var(--ff-surface-2);
  color: var(--ff-text-3);
}
.ff-cabin-tab.active .cabin-count {
  background: rgba(255,255,255,0.18);
  color: white;
}

/* BRANDED FARE CARDS */
.ff-brand-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
@media (min-width: 540px) {
  .ff-brand-grid { grid-template-columns: 1fr 1fr; }
}
.ff-brand-card {
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
.ff-brand-card:hover {
  border-color: var(--ff-border-strong);
  background: var(--ff-surface-2);
}
.ff-brand-card.selected {
  border-color: var(--ff-primary);
  background: var(--ff-surface);
  box-shadow: 0 0 0 3px rgba(17,17,17,0.06);
}
.ff-brand-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.ff-brand-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ff-brand-title .brand-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ff-text);
  text-transform: capitalize;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.ff-brand-title .brand-class {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ff-text-3);
}
.ff-brand-radio {
  flex-shrink: 0;
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 1.5px solid var(--ff-border-strong);
  background: var(--ff-surface);
  display: flex; align-items: center; justify-content: center;
  color: transparent;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.ff-brand-radio svg { width: 12px; height: 12px; }
.ff-brand-radio.on {
  background: var(--ff-primary);
  border-color: var(--ff-primary);
  color: white;
}
.ff-brand-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.ff-brand-diff {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: var(--ff-accent);
  background: var(--ff-accent-soft);
  border: 1px solid rgba(194,65,12,0.15);
  padding: 2px 6px;
  border-radius: 6px;
  letter-spacing: 0.02em;
}
.ff-brand-diff.cheapest {
  color: var(--ff-success);
  background: var(--ff-success-soft);
  border-color: rgba(21,128,61,0.15);
}
.ff-brand-feats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px dashed var(--ff-border);
  padding-top: 10px;
}
.ff-brand-feats li {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px;
  color: var(--ff-text-2);
}
.ff-brand-feats li .icn {
  width: 16px; height: 16px;
  border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--ff-surface-2);
  flex-shrink: 0;
}
.ff-brand-feats li .icn svg { width: 10px; height: 10px; }
.ff-brand-feats li.good { color: var(--ff-text-2); }
.ff-brand-feats li.good .icn { background: var(--ff-success-soft); color: var(--ff-success); }
.ff-brand-feats li.bad { color: var(--ff-text-3); }
.ff-brand-feats li.bad .icn { background: var(--ff-surface-2); color: var(--ff-text-4); }
.ff-brand-feats li.neutral .dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--ff-text-4);
  flex-shrink: 0;
  margin: 0 6px;
}
.ff-brand-feats li.neutral { color: var(--ff-text-3); font-size: 11.5px; font-family: 'Geist Mono', ui-monospace, monospace; letter-spacing: 0.02em; }

/* Floating foot bar used on the branded fare page */
.ff-foot-actions-floating {
  position: sticky;
  bottom: 0;
  margin-top: 4px;
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex; align-items: center; gap: 12px;
  box-shadow: 0 -2px 10px rgba(17,17,17,0.04);
}
.ff-foot-summary { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ff-foot-summary-label {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ff-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ff-foot-actions-floating .ff-btn-primary {
  padding: 10px 16px;
  font-size: 13px;
}
.ff-foot-actions-floating .ff-btn-ghost {
  padding: 9px 12px;
  font-size: 12px;
}

/* "Fare breakup" trigger in the sticky bar */
.ff-breakup-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px dashed var(--ff-border-strong);
  color: var(--ff-text-2);
  padding: 8px 12px;
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  white-space: nowrap;
}
.ff-breakup-link:hover {
  background: var(--ff-surface-2);
  border-color: var(--ff-text-3);
  color: var(--ff-text);
}
.ff-breakup-link svg { color: var(--ff-accent); }
`;

export const FlightTestStyles: React.FC = () => <style>{CSS}</style>;
