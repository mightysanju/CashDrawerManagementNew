import React from 'react';
import { Coins } from 'lucide-react';
import { CashEntry } from '../../types';

interface CoinsSectionProps {
  entries: CashEntry[];
  denominations: number[];
  onUpdate: (type: CashEntry['type'], denomination: number, quantity: number) => void;
}

export function CoinsSection({ entries, denominations, onUpdate }: CoinsSectionProps) {
  return (
    <div className="bg-yellow-50 p-4 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Coins size={24} className="text-yellow-600" />
        <h2 className="text-xl font-semibold text-yellow-800">Coins</h2>
      </div>
      {denominations.map(denom => (
        <div key={`coin-${denom}`} className="flex items-center gap-2 mb-2">
          <span className="w-12">${denom.toFixed(2)}</span>
          <input
            type="number"
            min="0"
            value={entries.find(e => e.type === 'coin' && e.denomination === denom)?.quantity || ''}
            onChange={(e) => onUpdate('coin', denom, parseInt(e.target.value) || 0)}
            className="w-20 p-1 border rounded"
          />
        </div>
      ))}
    </div>
  );
}