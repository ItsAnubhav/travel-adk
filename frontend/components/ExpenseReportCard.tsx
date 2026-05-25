import React from 'react';
import { ExpenseReportResponse, ExpenseItem } from '../types';
import ExpenseItemCard from './ExpenseItemCard';

interface Props {
  report: ExpenseReportResponse;
}

const getTotal = (items: ExpenseItem[]) =>
  items.reduce((sum, item) => sum + (item.Amount || 0), 0);

const collectRows = (report: any): ExpenseItem[] => {
  if (!report || typeof report !== 'object') return [];
  if (Array.isArray(report.items)) return report.items;
  if (Array.isArray(report.data)) return report.data;
  if (Array.isArray(report.data?.data)) return report.data.data;
  const data = report.Data || {};
  return [
    ...(Array.isArray(data.TripExpense) ? data.TripExpense : []),
    ...(Array.isArray(data.FiledTrip) ? data.FiledTrip : []),
    ...(Array.isArray(data.PersonalTrip) ? data.PersonalTrip : []),
    ...(Array.isArray(data.DeletedTrip) ? data.DeletedTrip : []),
  ];
};

const ExpenseReportCard: React.FC<Props> = ({ report }) => {
  const data = report.Data || {};
  const fallbackRows = collectRows(report);

  const sections = [
    { title: 'Trip Expense', items: Array.isArray(data.TripExpense) ? data.TripExpense : fallbackRows },
    { title: 'Filed Trip', items: Array.isArray(data.FiledTrip) ? data.FiledTrip : [] },
    { title: 'Personal Trip', items: Array.isArray(data.PersonalTrip) ? data.PersonalTrip : [] },
    { title: 'Deleted Trip', items: Array.isArray(data.DeletedTrip) ? data.DeletedTrip : [] }
  ];

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-4">
        <div className="text-sm font-semibold text-white">Expense Report</div>
        <div className="text-xs text-slate-400 mt-1">{report.Message}</div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {sections.map(section => (
            <div key={section.title} className="rounded-xl bg-black/20 border border-slate-800 p-3">
              <div className="text-[11px] uppercase text-slate-500">{section.title}</div>
              <div className="text-lg font-bold text-white">{section.items.length}</div>
              <div className="text-xs text-slate-400">Total: {getTotal(section.items).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      {sections.map(section => (
        <div key={section.title} className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {section.title} ({section.items.length})
          </div>

          {section.items.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-black/20 p-3 text-sm text-slate-500">
              No records found
            </div>
          ) : (
            section.items.map(item => (
              <ExpenseItemCard key={item.Expense_Id} item={item} />
            ))
          )}
        </div>
      ))}
    </div>
  );
};

export default ExpenseReportCard;
