import React, { useState } from 'react';
import { DollarSign, Check, X } from 'lucide-react';
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

  const total = calculateTotal();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
            <DollarSign size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Count Opening Float</h2>
            <p className="text-xs text-gray-500">Count all bills and coin rolls present in the drawer before starting transactions.</p>
          </div>
        </div>
        <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-full border border-blue-200">
          Step 2 of 2
        </span>
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

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 p-5 rounded-xl mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-xs uppercase tracking-wider text-blue-700 font-bold block mb-0.5">
            Total Starting Float
          </span>
          <span className="text-3xl font-extrabold text-blue-900 font-mono">
            ${total.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-semibold text-xs rounded-lg hover:bg-gray-50 transition shadow-xs"
          >
            <X size={15} />
            Back
          </button>
          <button
            type="button"
            onClick={() => onSubmit(entries)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700 transition shadow-sm hover:shadow"
          >
            <Check size={16} />
            Confirm & Open Register
          </button>
        </div>
      </div>
    </div>
  );
}
export default OpeningBalanceForm;
