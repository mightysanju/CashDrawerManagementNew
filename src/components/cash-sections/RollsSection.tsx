import React from 'react';
import { FileText } from 'lucide-react';
import { CashEntry } from '../../types';

interface RollsSectionProps {
  entries: CashEntry[];
  denominations: number[];
  onUpdate: (type: CashEntry['type'], denomination: number, quantity: number) => void;
}

export function RollsSection({ entries, denominations, onUpdate }: RollsSectionProps) {
  return (
    <div className="bg-purple-50 p-4 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={24} className="text-purple-600" />
        <h2 className="text-xl font-semibold text-purple-800">Rolls</h2>
      </div>
      {denominations.map(denom => (
        <div key={`roll-${denom}`} className="flex items-center gap-2 mb-2">
          <span className="w-12">${denom.toFixed(2)}</span>
          <input
            type="number"
            min="0"
            value={entries.find(e => e.type === 'roll' && e.denomination === denom)?.quantity || ''}
            onChange={(e) => onUpdate('roll', denom, parseInt(e.target.value) || 0)}
            className="w-20 p-1 border rounded"
          />
        </div>
      ))}
    </div>
  );
}