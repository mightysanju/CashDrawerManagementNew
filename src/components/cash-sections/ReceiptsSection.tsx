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

  const handleAddReceipt = (e?: React.MouseEvent | React.KeyboardEvent | React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const amount = parseFloat(newReceiptAmount);
    if (!isNaN(amount) && amount > 0) {
      handler?.('receipt', amount, 1);
      setNewReceiptAmount('');
    }
  };

  const handleRemoveReceipt = (denomination: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    handler?.('receipt', denomination, 0);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition-colors flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Receipt size={16} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                Paid-Out Receipts
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Cash vouchers and slips
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
              Total
            </span>
            <span className="text-xs font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              ${totalReceipts.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Input Form */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
              $
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={newReceiptAmount}
              onChange={(e) => setNewReceiptAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddReceipt(e);
                }
              }}
              className="w-full pl-6 pr-3 py-1 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddReceipt(e);
            }}
            disabled={!newReceiptAmount || parseFloat(newReceiptAmount) <= 0}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        </div>

        {/* Receipts List */}
        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
          {receiptEntries.length === 0 ? (
            <div className="p-3 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-[11px]">
              No paid-out slips recorded in this till.
            </div>
          ) : (
            receiptEntries.map((entry, index) => (
              <div
                key={`${entry.denomination}-${index}`}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center space-x-2">
                  <Receipt className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-xs font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
                    ${entry.denomination.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleRemoveReceipt(entry.denomination, e)}
                  className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                  title="Remove voucher"
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