import React from 'react';
import { Banknote } from 'lucide-react';
import { CashEntry } from '../../types';

interface BillsSectionProps {
  entries: CashEntry[];
  denominations: number[];
  onUpdate: (type: CashEntry['type'], denomination: number, quantity: number) => void;
}

export function BillsSection({ entries, denominations, onUpdate }: BillsSectionProps) {
  return (
    <div className="bg-blue-50 p-4 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Banknote size={24} className="text-blue-600" />
        <h2 className="text-xl font-semibold text-blue-800">Bills</h2>
      </div>
      {denominations.map(denom => (
        <div key={`bill-${denom}`} className="flex items-center gap-2 mb-2">
          <span className="w-12">${denom}</span>
          <input
            type="number"
            min="0"
            value={entries.find(e => e.type === 'bill' && e.denomination === denom)?.quantity || ''}
            onChange={(e) => onUpdate('bill', denom, parseInt(e.target.value) || 0)}
            className="w-20 p-1 border rounded"
          />
        </div>
      ))}
    </div>
  );
}