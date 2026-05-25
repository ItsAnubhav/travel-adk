import React from 'react';
import { BriefcaseBusiness, Check, Pencil } from 'lucide-react';

interface ExpenseReceiptViewProps {
  payload: any;
}

const pick = (source: any, ...keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const formatAmount = (amount: any) => {
  const numeric = typeof amount === 'number' ? amount : Number(String(amount ?? '').replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return String(amount ?? '0.00');
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (value: any) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const normalizeExpense = (payload: any) => {
  const expense = payload?.expense || payload?.item || payload?.data || payload || {};
  const attendees =
    pick(expense, 'attendees', 'Attendees', 'attendee_count', 'AttendeeCount') ??
    pick(payload, 'attendees', 'attendee_count');
  const includesClient =
    Boolean(pick(expense, 'includes_client', 'IncludesClient', 'client_attendee', 'ClientAttendee')) ||
    String(pick(expense, 'business_purpose', 'BusinessPurpose', 'purpose') || '').toLowerCase().includes('client');
  const confidence = Number(
    pick(expense, 'speech_confidence', 'SpeechConfidence', 'confidence', 'Confidence') ??
      pick(payload, 'speech_confidence', 'confidence') ??
      96,
  );

  return {
    merchant: pick(expense, 'merchant', 'Merchant', 'merchantName', 'MerchantName') || 'Untitled expense',
    category: pick(expense, 'category', 'CategoryName', 'categoryName') || 'Expense',
    purpose: pick(expense, 'purpose', 'business_purpose', 'BusinessPurpose', 'meal_type', 'MealType') || 'Client meal',
    currency: pick(expense, 'currency_symbol', 'currencySymbol', 'CurrencySymbol') || pick(expense, 'Currency', 'currency') || '$',
    amount: pick(expense, 'Amount', 'amount', 'total', 'Total') ?? 0,
    date: formatDate(pick(expense, 'ExpenseDate', 'expenseDate', 'date', 'Date')),
    attendees: attendees ? `${attendees}${includesClient ? ' - incl. client' : ''}` : includesClient ? 'Incl. client' : 'Not specified',
    payment: pick(expense, 'payment_label', 'paymentLabel', 'ModeOfPayment', 'modeOfPayment', 'payment', 'Payment') || 'Not specified',
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 96,
  };
};

const ExpenseReceiptView: React.FC<ExpenseReceiptViewProps> = ({ payload }) => {
  const expense = normalizeExpense(payload);

  return (
    <div className="erv-shell">
      <style>{styles}</style>
      <div className="erv-card" aria-label={`Expense ${expense.merchant}`}>
        <div className="erv-top">
          <div className="erv-icon" aria-hidden="true">
            <BriefcaseBusiness size={32} strokeWidth={1.9} />
          </div>
          <div className="erv-title-block">
            <div className="erv-title">{expense.merchant}</div>
            <div className="erv-meta">
              <span>{String(expense.category).toUpperCase()}</span>
              <span className="erv-dot">.</span>
              <span>{String(expense.purpose).toUpperCase()}</span>
            </div>
          </div>
          <div className="erv-amount">
            <span>{expense.currency}</span>
            {formatAmount(expense.amount)}
          </div>
        </div>

        <div className="erv-details">
          <div className="erv-cell">
            <div className="erv-label">Date</div>
            <div className="erv-value">{expense.date}</div>
          </div>
          <div className="erv-cell">
            <div className="erv-label">Attendees</div>
            <div className="erv-value">{expense.attendees}</div>
          </div>
          <div className="erv-cell">
            <div className="erv-label">Payment</div>
            <div className="erv-value">{expense.payment}</div>
          </div>
        </div>

        <div className="erv-actions">
          <div className="erv-confidence" aria-label={`Speech confidence ${expense.confidence}%`}>
            <span>Speech confidence</span>
            <div className="erv-meter">
              <div style={{ width: `${expense.confidence}%` }} />
            </div>
            <b>{expense.confidence}%</b>
          </div>
          <div className="erv-buttons">
            <button type="button" className="erv-btn erv-edit">
              <Pencil size={21} />
              Edit
            </button>
            <button type="button" className="erv-btn erv-confirm">
              <Check size={22} />
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = `
.erv-shell {
  width: 100%;
  color: #171710;
}
.erv-card {
  max-width: 840px;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid #d4c590;
  border-radius: 22px;
  background: #f8f2df;
  box-shadow: 0 18px 46px rgba(34, 30, 18, 0.18);
  font-family: Georgia, "Times New Roman", serif;
}
.erv-top {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 30px 32px 28px;
}
.erv-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: white;
  background: #f4b51f;
}
.erv-title {
  font-size: clamp(27px, 4vw, 38px);
  line-height: 0.95;
  font-weight: 700;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.erv-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 13px;
  margin-top: 13px;
  color: #807f74;
  font-family: "Courier New", ui-monospace, monospace;
  font-size: 21px;
  letter-spacing: 0.22em;
}
.erv-dot {
  letter-spacing: 0;
}
.erv-amount {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 4px;
  min-width: 190px;
  font-size: clamp(38px, 5vw, 50px);
  line-height: 1;
  font-weight: 700;
  white-space: nowrap;
}
.erv-amount span {
  color: #777669;
  font-size: 26px;
}
.erv-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 2px dashed #d4c590;
  border-bottom: 2px dashed #d4c590;
}
.erv-cell {
  min-width: 0;
  padding: 28px 32px 29px;
}
.erv-cell + .erv-cell {
  border-left: 2px dashed #d4c590;
}
.erv-label {
  color: #8b897b;
  font-family: "Courier New", ui-monospace, monospace;
  font-size: 19px;
  letter-spacing: 0.26em;
  text-transform: uppercase;
}
.erv-value {
  margin-top: 15px;
  color: #171710;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 29px;
  line-height: 1.12;
  font-weight: 500;
  word-break: break-word;
}
.erv-actions {
  display: grid;
  grid-template-columns: minmax(250px, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 21px 29px 23px;
}
.erv-confidence {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
  color: #817f72;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 24px;
}
.erv-confidence span {
  white-space: nowrap;
}
.erv-confidence b {
  font-weight: 500;
}
.erv-meter {
  width: 122px;
  height: 7px;
  border-radius: 999px;
  overflow: hidden;
  background: #e6dcc1;
}
.erv-meter div {
  height: 100%;
  border-radius: inherit;
  background: #d6caa8;
}
.erv-buttons {
  display: flex;
  align-items: center;
  gap: 16px;
}
.erv-btn {
  min-height: 70px;
  border-radius: 11px;
  padding: 0 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 25px;
  font-weight: 500;
  cursor: pointer;
}
.erv-edit {
  color: #4b473d;
  border: 2px solid #b8a776;
  background: #fbf7eb;
}
.erv-confirm {
  color: white;
  border: 2px solid #15160d;
  background: #15160d;
}
@media (max-width: 760px) {
  .erv-card {
    border-radius: 18px;
  }
  .erv-top {
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 13px;
    padding: 22px 20px 20px;
  }
  .erv-icon {
    width: 54px;
    height: 54px;
  }
  .erv-icon svg {
    width: 25px;
    height: 25px;
  }
  .erv-amount {
    grid-column: 1 / -1;
    justify-content: flex-start;
    min-width: 0;
  }
  .erv-meta {
    font-size: 14px;
    gap: 9px;
    letter-spacing: 0.16em;
  }
  .erv-details {
    grid-template-columns: 1fr;
  }
  .erv-cell {
    padding: 18px 20px;
  }
  .erv-cell + .erv-cell {
    border-left: 0;
    border-top: 2px dashed #d4c590;
  }
  .erv-label {
    font-size: 14px;
  }
  .erv-value {
    font-size: 23px;
  }
  .erv-actions {
    grid-template-columns: 1fr;
    padding: 18px 20px 20px;
  }
  .erv-confidence {
    flex-wrap: wrap;
    gap: 10px;
    font-size: 18px;
  }
  .erv-buttons {
    width: 100%;
    gap: 10px;
  }
  .erv-btn {
    flex: 1 1 0;
    min-height: 56px;
    padding: 0 14px;
    font-size: 19px;
  }
}
`;

export default ExpenseReceiptView;
