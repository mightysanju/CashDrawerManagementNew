import React from 'react';
import { Banknote, Coins, FileText } from 'lucide-react';
import { CashEntry } from '../../types';

interface CashSectionProps {
  title: string;
  type: CashEntry['type'];
  entries: CashEntry[];
  denominations: number[];
  onUpdate: (type: CashEntry['type'], denomination: number, quantity: number) => void;
}

const icons = {
  bill: Banknote,
  coin: Coins,
  roll: FileText,
  receipt: FileText,
};

const colors = {
  bill: 'blue',
  coin: 'yellow',
  roll: 'purple',
  receipt: 'green',
};

export function CashSection({ 
  title, 
  type, 
  entries, 
  denominations, 
  onUpdate 
}: CashSectionProps) {
  const Icon = icons[type];
  const color = colors[type];

  return (
    <div className={`bg-${color}-50 p-4 rounded-lg`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={24} className={`text-${color}-600`} />
        <h2 className={`text-xl font-semibold text-${color}-800`}>{title}</h2>
      </div>
      {denominations.map(denom => (
        <div key={`${type}-${denom}`} className="flex items-center gap-2 mb-2">
          <span className="w-12">${denom.toFixed(2)}</span>
          <input
            type="number"
            min="0"
            value={entries.find(e => e.type === type && e.denomination === denom)?.quantity || ''}
            onChange={(e) => onUpdate(type, denom, parseInt(e.target.value) || 0)}
            className="w-20 p-1 border rounded"
          />
        </div>
      ))}
    </div>
  );
}