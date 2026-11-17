import React, { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  Clock,
  ArrowRight,
  Hash,
  X,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  SlidersHorizontal,
} from 'lucide-react';
import { CashEntry } from '../types';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartShift: (drawerNumber: string, openingFloat: number, entries: CashEntry[]) => void;
  onRemindLater: () => void;
  defaultDrawerNumber?: string;
  cashierName: string;
  rememberedTillEntries?: CashEntry[];
}

const STANDARD_DENOMINATIONS: { type: CashEntry['type']; denomination: number; label: string }[] = [
  // Bills
  { type: 'bill', denomination: 100, label: '$100 Bill' },
  { type: 'bill', denomination: 50, label: '$50 Bill' },
  { type: 'bill', denomination: 20, label: '$20 Bill' },
  { type: 'bill', denomination: 10, label: '$10 Bill' },
  { type: 'bill', denomination: 5, label: '$5 Bill' },
  { type: 'bill', denomination: 2, label: '$2 Bill' },
  { type: 'bill', denomination: 1, label: '$1 Bill' },
  // Coins
  { type: 'coin', denomination: 1, label: '$1 Coin' },
  { type: 'coin', denomination: 0.25, label: '25¢ Quarter' },
  { type: 'coin', denomination: 0.10, label: '10¢ Dime' },
  { type: 'coin', denomination: 0.05, label: '5¢ Nickel' },
  { type: 'coin', denomination: 0.01, label: '1¢ Penny' },
  // Rolls
  { type: 'roll', denomination: 10, label: '$10 Quarter Roll' },
  { type: 'roll', denomination: 5, label: '$5 Dime Roll' },
  { type: 'roll', denomination: 2, label: '$2 Nickel Roll' },
  { type: 'roll', denomination: 0.50, label: '50¢ Penny Roll' },
];

function buildDefaultEntries(): CashEntry[] {
  return [
    { type: 'bill', denomination: 20, quantity: 5, total: 100 },
    { type: 'bill', denomination: 10, quantity: 5, total: 50 },
    { type: 'bill', denomination: 5, quantity: 6, total: 30 },
    { type: 'bill', denomination: 1, quantity: 20, total: 20 },
  ];
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({
  isOpen,
  onClose,
  onStartShift,
  onRemindLater,
  defaultDrawerNumber = '1',
  cashierName,
  rememberedTillEntries,
}) => {
  const [drawerNumber, setDrawerNumber] = useState(defaultDrawerNumber);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [isFromPreviousClosedTill, setIsFromPreviousClosedTill] = useState(false);
  const [activeTab, setActiveTab] = useState<'till-count' | 'quick-float'>('till-count');

  // Initialize till count from previous closed drawer or defaults
  useEffect(() => {
    if (!isOpen) return;

    let initialEntries: CashEntry[] | null = null;

    if (rememberedTillEntries && rememberedTillEntries.length > 0) {
      initialEntries = rememberedTillEntries;
      setIsFromPreviousClosedTill(true);
    } else {
      try {
        const saved = localStorage.getItem('cdm_last_closed_till');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialEntries = parsed;
            setIsFromPreviousClosedTill(true);
          }
        }
      } catch {
        // ignore
      }
    }

    if (!initialEntries || initialEntries.length === 0) {
      initialEntries = buildDefaultEntries();
      setIsFromPreviousClosedTill(false);
    }

    // Merge with full standard denominations list for a complete till counter
    const merged: CashEntry[] = STANDARD_DENOMINATIONS.map((std) => {
      const found = initialEntries?.find(
        (e) => e.type === std.type && Math.abs(e.denomination - std.denomination) < 0.001
      );
      const qty = found ? found.quantity : 0;
      return {
        type: std.type,
        denomination: std.denomination,
        quantity: qty,
        total: Math.round(qty * std.denomination * 100) / 100,
      };
    });

    setEntries(merged);
  }, [isOpen, rememberedTillEntries]);

  const totalCalculatedFloat = useMemo(() => {
    return Math.round(entries.reduce((sum, e) => sum + e.total, 0) * 100) / 100;
  }, [entries]);

  if (!isOpen) return null;

  const handleQuantityChange = (index: number, newQty: number) => {
    const qty = Math.max(0, newQty || 0);
    setEntries((prev) => {
      const updated = [...prev];
      const item = updated[index];
      updated[index] = {
        ...item,
        quantity: qty,
        total: Math.round(qty * item.denomination * 100) / 100,
      };
      return updated;
    });
  };

  const handleResetToStandardFloat = (targetAmount: number = 200) => {
    // Generate standard distribution for chosen float
    const standardMap: { [denom: number]: number } = {
      20: Math.floor((targetAmount * 0.5) / 20),
      10: Math.floor((targetAmount * 0.25) / 10),
      5: Math.floor((targetAmount * 0.15) / 5),
      1: Math.round(targetAmount * 0.1),
    };

    setEntries((prev) =>
      prev.map((e) => {
        if (e.type === 'bill' && standardMap[e.denomination] !== undefined) {
          const qty = standardMap[e.denomination];
          return { ...e, quantity: qty, total: qty * e.denomination };
        }
        return { ...e, quantity: 0, total: 0 };
      })
    );
    setIsFromPreviousClosedTill(false);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerNumber.trim()) {
      alert('Please enter a drawer / till station number');
      return;
    }
    if (totalCalculatedFloat <= 0) {
      alert('Opening float cannot be $0.00. Please enter the cash counted in the drawer.');
      return;
    }

    // Filter to only non-zero entries for clean shift storage
    const activeEntries = entries.filter((e) => e.quantity > 0);
    onStartShift(drawerNumber.trim(), totalCalculatedFloat, activeEntries.length > 0 ? activeEntries : entries);
  };

  const billEntries = entries.filter((e) => e.type === 'bill');
  const coinAndRollEntries = entries.filter((e) => e.type === 'coin' || e.type === 'roll');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden flex flex-col my-6 animate-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Open Cash Drawer & Till Count</h3>
              <p className="text-xs text-gray-400">
                Verify cash in drawer before starting shift payments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Clerk on Duty & Drawer Selection Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-600 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                  {cashierName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Opening Cashier</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{cashierName}</span>
                </div>
              </div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                Shift Starting
              </span>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                Drawer / Till Station #
              </label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={drawerNumber}
                  onChange={(e) => setDrawerNumber(e.target.value)}
                  placeholder="e.g. 1, Front Desk 2"
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Till Continuity Status Card */}
          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5 font-bold text-xs text-blue-900 dark:text-blue-200">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>
                  {isFromPreviousClosedTill
                    ? 'Till Count Pre-Filled from Previous Closed Drawer'
                    : 'Standard Till Float Active'}
                </span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                {isFromPreviousClosedTill
                  ? 'Counts match the closing till from the previous shift. Adjust any quantity below if change was added or swapped.'
                  : 'Adjust individual denominations below to match your physical drawer cash count.'}
              </p>
            </div>
            <div className="text-right shrink-0 pl-3">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Counted Float</span>
              <span className="text-base font-black text-blue-700 dark:text-blue-300">
                ${totalCalculatedFloat.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Denominations Count Grid (Bills & Coins/Rolls) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bills Section */}
            <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50/40 dark:bg-gray-800/40">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200 dark:border-gray-700">
                <span className="font-bold text-[11px] uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Paper Currency (Bills)
                </span>
                <span className="font-bold text-xs text-gray-900 dark:text-white">
                  ${billEntries.reduce((s, e) => s + e.total, 0).toFixed(2)}
                </span>
              </div>

              <div className="space-y-1.5">
                {billEntries.map((entry) => {
                  const globalIdx = entries.indexOf(entry);
                  return (
                    <div
                      key={entry.denomination}
                      className="flex items-center justify-between bg-white dark:bg-gray-700/60 p-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <span className="font-bold text-xs text-gray-800 dark:text-gray-200 w-16">
                        ${entry.denomination}
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(globalIdx, entry.quantity - 1)}
                          className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-200 font-bold hover:bg-gray-200 text-xs transition"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={entry.quantity || ''}
                          onChange={(e) => handleQuantityChange(globalIdx, parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-12 py-1 text-center font-bold text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(globalIdx, entry.quantity + 1)}
                          className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-200 font-bold hover:bg-gray-200 text-xs transition"
                        >
                          +
                        </button>
                      </div>
                      <span className="w-16 text-right font-extrabold text-xs text-gray-900 dark:text-white">
                        ${entry.total.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coins & Coin Rolls Section */}
            <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50/40 dark:bg-gray-800/40">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200 dark:border-gray-700">
                <span className="font-bold text-[11px] uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Coins & Coin Rolls
                </span>
                <span className="font-bold text-xs text-gray-900 dark:text-white">
                  ${coinAndRollEntries.reduce((s, e) => s + e.total, 0).toFixed(2)}
                </span>
              </div>

              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {coinAndRollEntries.map((entry) => {
                  const globalIdx = entries.indexOf(entry);
                  const isRoll = entry.type === 'roll';
                  return (
                    <div
                      key={`${entry.type}-${entry.denomination}`}
                      className="flex items-center justify-between bg-white dark:bg-gray-700/60 p-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 w-24 truncate">
                        {isRoll ? `Roll: $${entry.denomination}` : `$${entry.denomination.toFixed(2)}`}
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(globalIdx, entry.quantity - 1)}
                          className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-200 font-bold hover:bg-gray-200 text-xs transition"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={entry.quantity || ''}
                          onChange={(e) => handleQuantityChange(globalIdx, parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-12 py-1 text-center font-bold text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(globalIdx, entry.quantity + 1)}
                          className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-200 font-bold hover:bg-gray-200 text-xs transition"
                        >
                          +
                        </button>
                      </div>
                      <span className="w-16 text-right font-extrabold text-xs text-gray-900 dark:text-white">
                        ${entry.total.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] text-gray-400 font-medium">Quick Resets:</span>
              {[150, 200, 250, 300].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleResetToStandardFloat(amt)}
                  className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded text-[11px] font-semibold transition cursor-pointer"
                >
                  ${amt}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const saved = localStorage.getItem('cdm_last_closed_till');
                if (saved) {
                  try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                      setEntries((prev) =>
                        prev.map((p) => {
                          const found = parsed.find(
                            (e: CashEntry) => e.type === p.type && Math.abs(e.denomination - p.denomination) < 0.001
                          );
                          const qty = found ? found.quantity : 0;
                          return { ...p, quantity: qty, total: qty * p.denomination };
                        })
                      );
                      setIsFromPreviousClosedTill(true);
                    }
                  } catch {
                    // ignore
                  }
                }
              }}
              className="text-[11px] text-blue-600 hover:underline font-bold flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reload Previous Closed Till</span>
            </button>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center space-x-2">
            <button
              type="button"
              onClick={onRemindLater}
              className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl transition text-xs cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Clock className="w-4 h-4 text-gray-400" />
              <span>Remind Me Later</span>
            </button>

            <button
              type="submit"
              className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition text-xs cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Open Drawer & Start Shift (${totalCalculatedFloat.toFixed(2)})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
