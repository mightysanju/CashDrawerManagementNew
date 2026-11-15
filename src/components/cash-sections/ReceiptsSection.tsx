import React, { useState } from 'react';
import { Receipt, Plus, Trash2 } from 'lucide-react';
import { CashEntry } from '../../types';

interface ReceiptsSectionProps {
  entries: CashEntry[];
  onUpdate?: (type: CashEntry['type'], denomination: number, quantity: number) => void;
  onUpdateEntry?: (type: CashEntry['type'], denomination: number, quantity: number) => void;
}

export function ReceiptsSection({ entries, onUpdate, onUpdateEntry }: ReceiptsSectionProps) {
  const [newReceiptAmount, setNewReceiptAmount] = useState('');
  const handler = onUpdate || onUpdateEntry;
  const receiptEntries = entries.filter((entry) => entry.type === 'receipt');

  const totalReceipts = receiptEntries.reduce((sum, e) => sum + e.total, 0);

  const handleAddReceipt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const amount = parseFloat(newReceiptAmount);
    if (!isNaN(amount) && amount > 0) {
      handler?.('receipt', amount, 1);
      setNewReceiptAmount('');
    }
  };

  const handleRemoveReceipt = (denomination: number) => {
    handler?.('receipt', denomination, 0);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-xs transition-colors flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
              <Receipt size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                Paid-Out Receipts
              </h3>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">
                Cash Vouchers & Slips
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-gray-400 dark:text-gray-400 block uppercase font-semibold">
              Total
            </span>
            <span className="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              ${totalReceipts.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAddReceipt} className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-mono text-xs">
              $
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={newReceiptAmount}
              onChange={(e) => setNewReceiptAmount(e.target.value)}
              className="w-full pl-6 pr-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={!newReceiptAmount || parseFloat(newReceiptAmount) <= 0}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-2xs"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </form>

        {/* Receipts List */}
        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
          {receiptEntries.length === 0 ? (
            <div className="p-3 text-center rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-[11px]">
              No paid-out slips or vouchers in this till.
            </div>
          ) : (
            receiptEntries.map((entry, index) => (
              <div
                key={`${entry.denomination}-${index}`}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-750/70 border border-gray-100 dark:border-gray-700/60"
              >
                <div className="flex items-center space-x-2">
                  <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                    ${entry.denomination.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveReceipt(entry.denomination)}
                  title="Remove receipt"
                  className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition rounded"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
