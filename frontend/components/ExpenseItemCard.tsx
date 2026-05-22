import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { ExpenseItem } from '../types';
import { EditExpenseModal } from './EditExpenseModal';

interface Props {
  item: ExpenseItem;
}

const ExpenseItemCard: React.FC<Props> = ({ item }) => {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 relative">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{item.CategoryName}</div>
          <div className="text-xs text-slate-400">{item.Merchant}</div>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right">
            <div className="text-sm font-bold text-emerald-400">
              {item.Currency} {item.Amount.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500">Tax: {item.TaxAmount.toFixed(2)}</div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition-colors shrink-0"
            title="Edit Expense"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
        <div>Expense Date: {item.ExpenseDate}</div>
        <div>Invoice No: {item.InvoiceNo || '-'}</div>
        <div>Mode: {item.ModeOfPayment}</div>
        <div>GST: {item.GSTNumber || '-'}</div>
        {item.Trip_Name && <div>Trip: {item.Trip_Name}</div>}
        {item.Comments && <div>Comments: {item.Comments}</div>}
      </div>

      {isEditOpen && (
        <EditExpenseModal item={item} onClose={() => setIsEditOpen(false)} />
      )}
    </div>
  );
};

export default ExpenseItemCard;
