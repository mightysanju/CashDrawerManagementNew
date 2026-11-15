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
    subtitle: 'Paper notes tally',
  },
  coin: {
    icon: Coins,
    subtitle: 'Loose coins tally',
  },
  roll: {
    icon: Layers,
    subtitle: 'Coin roll wrappers',
  },
  receipt: {
    icon: FileText,
    subtitle: 'Paid-out vouchers',
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
    const rawVal = valStr.replace(/^0+(?=\d)/, '');
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition-colors flex flex-col justify-between">
      <div>
        {/* Section Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Icon size={16} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {config.subtitle}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
              Total
            </span>
            <span className="text-xs font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              ${sectionTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Denomination Rows */}
        <div className="space-y-1.5">
          {denominations.map((denom) => {
            const entry = entries.find((e) => e.type === type && e.denomination === denom);
            const quantity = entry?.quantity || 0;
            const lineTotal = denom * quantity;

            return (
              <div
                key={`${type}-${denom}`}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-colors"
              >
                {/* Denomination Value */}
                <div className="w-16 flex-shrink-0">
                  <span className="text-xs font-medium font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    ${denom.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {type === 'roll' ? 'roll' : 'each'}
                  </span>
                </div>

                {/* Input & Increment Controls */}
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleStep(denom, -1)}
                    disabled={quantity <= 0}
                    className="w-6 h-6 rounded bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center text-xs font-medium transition-colors"
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
                    className="w-16 px-2 py-1 text-center font-mono tabular-nums text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                  <button
                    type="button"
                    onClick={() => handleStep(denom, 1)}
                    className="w-6 h-6 rounded bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center justify-center text-xs font-medium transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Line Total */}
                <div className="w-20 text-right flex-shrink-0">
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      quantity > 0
                        ? 'font-semibold text-slate-900 dark:text-white'
                        : 'text-slate-400 dark:text-slate-600'
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