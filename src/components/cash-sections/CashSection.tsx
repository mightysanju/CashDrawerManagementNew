import React from 'react';
import { Banknote, Coins, Layers, FileText } from 'lucide-react';
import { CashEntry } from '../../types';

interface CashSectionProps {
  title: string;
  type: CashEntry['type'];
  entries: CashEntry[];
  denominations: number[];
  onUpdate?: (type: CashEntry['type'], denomination: number, quantity: number) => void;
  onUpdateEntry?: (type: CashEntry['type'], denomination: number, quantity: number) => void;
}

const SECTION_CONFIG = {
  bill: {
    icon: Banknote,
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
    badgeText: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-100 dark:border-blue-900/50',
    accentText: 'text-blue-600 dark:text-blue-400',
  },
  coin: {
    icon: Coins,
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-100 dark:border-amber-900/50',
    accentText: 'text-amber-600 dark:text-amber-400',
  },
  roll: {
    icon: Layers,
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
    badgeText: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-100 dark:border-purple-900/50',
    accentText: 'text-purple-600 dark:text-purple-400',
  },
  receipt: {
    icon: FileText,
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-100 dark:border-emerald-900/50',
    accentText: 'text-emerald-600 dark:text-emerald-400',
  },
};

export function CashSection({
  title,
  type,
  entries,
  denominations,
  onUpdate,
  onUpdateEntry,
}: CashSectionProps) {
  const handler = onUpdate || onUpdateEntry;
  const config = SECTION_CONFIG[type] || SECTION_CONFIG.bill;
  const Icon = config.icon;

  const sectionTotal = denominations.reduce((sum, denom) => {
    const qty = entries.find((e) => e.type === type && e.denomination === denom)?.quantity || 0;
    return sum + denom * qty;
  }, 0);

  const handleQuantityChange = (denom: number, valStr: string) => {
    const rawVal = valStr.replace(/^0+(?=\d)/, ''); // Remove leading zeros
    const parsed = parseInt(rawVal, 10);
    const qty = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    handler?.(type, denom, qty);
  };

  const handleStep = (denom: number, delta: number) => {
    const currentQty = entries.find((e) => e.type === type && e.denomination === denom)?.quantity || 0;
    const nextQty = Math.max(0, currentQty + delta);
    handler?.(type, denom, nextQty);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-xs transition-colors flex flex-col justify-between">
      <div>
        {/* Section Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700/80">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${config.badgeBg} ${config.badgeText}`}>
              <Icon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                {title}
              </h3>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">
                {type === 'roll' ? 'Coin Roll Wrappers' : `${title} Tally`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-gray-400 dark:text-gray-400 block uppercase font-semibold">
              Total
            </span>
            <span className="text-sm font-extrabold font-mono text-gray-900 dark:text-white">
              ${sectionTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Denomination Rows */}
        <div className="space-y-2">
          {denominations.map((denom) => {
            const entry = entries.find((e) => e.type === type && e.denomination === denom);
            const quantity = entry?.quantity || 0;
            const lineTotal = denom * quantity;

            return (
              <div
                key={`${type}-${denom}`}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-750/70 hover:bg-gray-100/80 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700/60 transition"
              >
                {/* Denomination Value */}
                <div className="w-18 flex-shrink-0">
                  <span className="text-xs font-bold font-mono text-gray-800 dark:text-gray-200">
                    ${denom.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    {type === 'roll' ? 'per roll' : 'each'}
                  </span>
                </div>

                {/* Input & Increment Controls */}
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleStep(denom, -1)}
                    disabled={quantity <= 0}
                    className="w-6 h-6 rounded bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xs font-bold transition"
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={quantity === 0 ? '' : quantity}
                    onChange={(e) => handleQuantityChange(denom, e.target.value)}
                    className="w-16 px-2 py-1 text-center font-mono font-bold text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />

                  <button
                    type="button"
                    onClick={() => handleStep(denom, 1)}
                    className="w-6 h-6 rounded bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center text-xs font-bold transition"
                  >
                    +
                  </button>
                </div>

                {/* Line Total */}
                <div className="w-20 text-right flex-shrink-0">
                  <span
                    className={`text-xs font-mono font-bold ${
                      quantity > 0
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}
                  >
                    ${lineTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
