import React, { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { CashEntry } from '../types';
import { CashSection } from './cash-sections/CashSection';
import { ReceiptsSection } from './cash-sections/ReceiptsSection';

interface OpeningBalanceFormProps {
  onSubmit: (entries: CashEntry[]) => void;
  onCancel: () => void;
}

const DENOMINATIONS = {
  bill: [100, 50, 20, 10, 5, 1],
  coin: [1, 0.25, 0.10, 0.05, 0.01],
  roll: [10, 5, 2, 1, 0.5],
};

export function OpeningBalanceForm({ onSubmit, onCancel }: OpeningBalanceFormProps) {
  const [entries, setEntries] = useState<CashEntry[]>([]);

  const updateEntry = (type: CashEntry['type'], denomination: number, quantity: number) => {
    const total = denomination * quantity;
    const existingIndex = entries.findIndex(
      e => e.type === type && e.denomination === denomination
    );

    const newEntries = [...entries];
    if (existingIndex >= 0) {
      if (quantity === 0) {
        newEntries.splice(existingIndex, 1);
      } else {
        newEntries[existingIndex] = { type, denomination, quantity, total };
      }
    } else if (quantity > 0) {
      newEntries.push({ type, denomination, quantity, total });
    }
    setEntries(newEntries);
  };

  const calculateTotal = () => 
    entries.reduce((sum, entry) => sum + entry.total, 0);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <DollarSign size={24} className="text-green-600" />
        <h2 className="text-2xl font-semibold">Enter Opening Balance</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <CashSection
          title="Bills"
          type="bill"
          entries={entries}
          denominations={DENOMINATIONS.bill}
          onUpdate={updateEntry}
        />
        <CashSection
          title="Coins"
          type="coin"
          entries={entries}
          denominations={DENOMINATIONS.coin}
          onUpdate={updateEntry}
        />
        <CashSection
          title="Rolls"
          type="roll"
          entries={entries}
          denominations={DENOMINATIONS.roll}
          onUpdate={updateEntry}
        />
        <ReceiptsSection 
          entries={entries} 
          onUpdate={updateEntry} 
        />
      </div>

      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center">
          <span className="text-xl font-semibold">Opening Balance:</span>
          <span className="text-2xl font-bold text-green-600">
            ${calculateTotal().toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit(entries)}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Confirm Opening Balance
        </button>
      </div>
    </div>
  );
}