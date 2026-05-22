import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { ExpenseItem } from '../types';

interface EditExpenseModalProps {
  item: ExpenseItem;
  onClose: () => void;
}

const CATEGORIES = [
  { id: 2, name: 'Meals' },
  { id: 3, name: 'Hotel' },
  { id: 4, name: 'Cab' },
  { id: 1, name: 'Flights' },
  { id: 5, name: 'Rail' },
  { id: 6, name: 'Conveyance' },
  { id: 10, name: 'Other' },
];

const PAYMENT_MODES = [
  { code: 'PC', name: 'Personal Card' },
  { code: 'CC', name: 'Corporate Card' },
  { code: 'PD', name: 'Cash' },
  { code: 'IC', name: 'Invoice to Company' },
  { code: 'AA', name: 'Advance Account' },
];

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({ item, onClose }) => {
  const [merchant, setMerchant] = useState(item.Merchant || '');
  const [amount, setAmount] = useState(String(item.Amount || ''));
  const [taxAmount, setTaxAmount] = useState(String(item.TaxAmount || ''));
  const [invoiceNo, setInvoiceNo] = useState(item.InvoiceNo || '');
  const [gstNumber, setGstNumber] = useState(item.GSTNumber || '');
  const [comments, setComments] = useState(item.Comments || '');
  const [isPersonal, setIsPersonal] = useState(item.IsPersonal === true);
  
  // Find initial Category ID matching the CategoryName, default to Cab (4) or first category
  const initialCat = CATEGORIES.find(c => c.name.toLowerCase() === (item.CategoryName || '').toLowerCase());
  const [categoryId, setCategoryId] = useState(String(initialCat?.id || '4'));

  // Find initial Payment Mode matching the code or display name
  const initialMode = PAYMENT_MODES.find(m => m.code === item.ModeOfPayment || m.name === item.ModeOfPayment);
  const [paymentMode, setPaymentMode] = useState(initialMode?.code || 'PC');

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a valid positive number');
      return;
    }

    const parsedTax = parseFloat(taxAmount || '0');
    if (isNaN(parsedTax) || parsedTax < 0) {
      setError('Tax Amount must be a valid non-negative number');
      return;
    }

    // Build standard descriptive message to send to the AI Agent
    const command = `Update expense ${item.Expense_Id} details:
- Merchant: ${merchant.trim() || 'N/A'}
- Amount: ${parsedAmount}
- Category ID: ${categoryId}
- Payment Mode: ${paymentMode}
- Comments: ${comments.trim() || 'N/A'}
- Tax Amount: ${parsedTax}
- Invoice Number: ${invoiceNo.trim() || 'N/A'}
- GST Number: ${gstNumber.trim() || 'N/A'}
- Is Personal: ${isPersonal ? 'true' : 'false'}`;

    // Dispatch the custom event to ChatPage to trigger agent flow
    window.dispatchEvent(
      new CustomEvent('aiva:send-message', {
        detail: { text: command },
      })
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl transition-all duration-300">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-white">Edit Expense</h3>
            <p className="text-xs text-slate-400 mt-0.5">Expense ID: {item.Expense_Id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="rounded-xl border border-red-900/30 bg-red-950/20 px-4 py-2.5 text-xs text-red-400 font-semibold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Merchant */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Merchant
              </label>
              <input
                type="text"
                required
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black/35 px-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Uber, Ola, Zomato"
              />
            </div>

            {/* Category */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black/35 px-4 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Amount ({item.Currency || 'INR'})
              </label>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black/35 px-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>

            {/* Tax Amount */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Tax Amount
              </label>
              <input
                type="number"
                step="any"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black/35 px-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>

            {/* Payment Mode */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black/35 px-4 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode.code} value={mode.code}>
                    {mode.name}
                  </option>
                ))}
              </select>
            </div>

            {/* GST Number */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                GST Number
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black/35 px-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="GSTIN"
              />
            </div>

            {/* Invoice Number */}
            <div className="col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Invoice Number
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black/35 px-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Invoice No"
              />
            </div>

            {/* Comments */}
            <div className="col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Comments
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-black/35 px-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-20 resize-none"
                placeholder="Any special remarks..."
              />
            </div>

            {/* Is Personal */}
            <div className="col-span-2 flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-black/20">
              <div>
                <span className="block text-xs font-bold text-slate-200">Personal Expense</span>
                <span className="text-[10px] text-slate-400">Flag this if it was a personal trip expense</span>
              </div>
              <input
                type="checkbox"
                checked={isPersonal}
                onChange={(e) => setIsPersonal(e.target.checked)}
                className="h-4 w-4 rounded border-slate-800 bg-black/35 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-transparent px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/10 transition-colors"
            >
              <Check size={14} />
              Save Changes
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
