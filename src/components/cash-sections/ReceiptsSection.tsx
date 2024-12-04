import React, { useState } from 'react';
import { Receipt, Plus, Trash2 } from 'lucide-react';
import { CashEntry } from '../../types';

interface ReceiptsSectionProps {
  entries: CashEntry[];
  onUpdate: (type: CashEntry['type'], denomination: number, quantity: number) => void;
}

export function ReceiptsSection({ entries, onUpdate }: ReceiptsSectionProps) {
  const [newReceiptAmount, setNewReceiptAmount] = useState('');
  const receiptEntries = entries.filter(entry => entry.type === 'receipt');

  const handleAddReceipt = () => {
    const amount = parseFloat(newReceiptAmount);
    if (!isNaN(amount) && amount > 0) {
      onUpdate('receipt', amount, 1);
      setNewReceiptAmount('');
    }
  };

  const handleRemoveReceipt = (denomination: number) => {
    onUpdate('receipt', denomination, 0);
  };

  return (
    <div className="bg-green-50 p-4 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={24} className="text-green-600" />
        <h2 className="text-xl font-semibold text-green-800">Receipts</h2>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={newReceiptAmount}
          onChange={(e) => setNewReceiptAmount(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        <button
          onClick={handleAddReceipt}
          className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {receiptEntries.map((entry, index) => (
          <div key={index} className="flex items-center justify-between bg-white p-2 rounded">
            <span>${entry.denomination.toFixed(2)}</span>
            <button
              onClick={() => handleRemoveReceipt(entry.denomination)}
              className="p-1 text-red-600 hover:text-red-700 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}