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
  Banknote,
  Layers,
  FileText,
} from 'lucide-react';
import { CashEntry } from '../types';
import { CashSection } from './cash-sections/CashSection';
import { ReceiptsSection } from './cash-sections/ReceiptsSection';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartShift: (drawerNumber: string, openingFloat: number, entries: CashEntry[]) => void;
  onRemindLater: () => void;
  defaultDrawerNumber?: string;
  cashierName: string;
  rememberedTillEntries?: CashEntry[];
}

const DENOMINATIONS = {
  bill: [100, 50, 20, 10, 5, 2, 1],
  coin: [1, 0.25, 0.10, 0.05, 0.01],
  roll: [10, 5, 2, 1, 0.5],
};

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
  const [activeSection, setActiveSection] = useState<'all' | 'bill' | 'coin' | 'roll' | 'receipt'>('all');

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

    setEntries(initialEntries);
  }, [isOpen, rememberedTillEntries]);

  const updateEntry = (type: CashEntry['type'], denomination: number, quantity: number) => {
    const total = Math.round(denomination * quantity * 100) / 100;
    setEntries((prev) => {
      const existingIndex = prev.findIndex(
        (e) => e.type === type && Math.abs(e.denomination - denomination) < 0.001
      );
      const next = [...prev];
      if (existingIndex >= 0) {
        if (quantity === 0) {
          next.splice(existingIndex, 1);
        } else {
          next[existingIndex] = { type, denomination, quantity, total };
        }
      } else if (quantity > 0) {
        next.push({ type, denomination, quantity, total });
      }
      return next;
    });
  };

  const totals = useMemo(() => {
    const bills = entries.filter((e) => e.type === 'bill').reduce((s, e) => s + e.total, 0);
    const coins = entries.filter((e) => e.type === 'coin').reduce((s, e) => s + e.total, 0);
    const rolls = entries.filter((e) => e.type === 'roll').reduce((s, e) => s + e.total, 0);
    const receipts = entries.filter((e) => e.type === 'receipt').reduce((s, e) => s + e.total, 0);
    const total = Math.round((bills + coins + rolls + receipts) * 100) / 100;
    return { bills, coins, rolls, receipts, total };
  }, [entries]);

  if (!isOpen) return null;

  const handleResetToStandardFloat = (targetAmount: number = 200) => {
    const standardMap: { [denom: number]: number } = {
      20: Math.floor((targetAmount * 0.5) / 20),
      10: Math.floor((targetAmount * 0.25) / 10),
      5: Math.floor((targetAmount * 0.15) / 5),
      1: Math.round(targetAmount * 0.1),
    };

    const newEntries: CashEntry[] = Object.entries(standardMap).map(([denomStr, qty]) => {
      const denomination = Number(denomStr);
      return {
        type: 'bill',
        denomination,
        quantity: qty,
        total: Math.round(qty * denomination * 100) / 100,
      };
    });

    setEntries(newEntries);
    setIsFromPreviousClosedTill(false);
  };

  const handleReloadPreviousClosedTill = () => {
    if (rememberedTillEntries && rememberedTillEntries.length > 0) {
      setEntries(rememberedTillEntries);
      setIsFromPreviousClosedTill(true);
      return;
    }
    try {
      const saved = localStorage.getItem('cdm_last_closed_till');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEntries(parsed);
          setIsFromPreviousClosedTill(true);
          return;
        }
      }
    } catch {
      // ignore
    }
    alert('No previous closed till data found. Standard default float active.');
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerNumber.trim()) {
      alert('Please enter a drawer / till station number');
      return;
    }
    if (totals.total <= 0) {
      alert('Opening float cannot be $0.00. Please enter the cash counted in the drawer.');
      return;
    }

    const activeEntries = entries.filter((e) => e.quantity > 0 || (e.type === 'receipt' && e.total > 0));
    onStartShift(drawerNumber.trim(), totals.total, activeEntries.length > 0 ? activeEntries : entries);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden flex flex-col my-4 animate-in zoom-in-95 duration-150 max-h-[94vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Open Cash Drawer & Till Count</h3>
              <p className="text-xs text-gray-400">
                Complete till counter: Bills, Coins, Rolls, and Receipts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
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

          {/* Till Continuity Status & Metric Summary Card */}
          <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-xs text-blue-900 dark:text-blue-200">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>
                  {isFromPreviousClosedTill
                    ? 'Till Count Pre-Filled from Previous Closed Drawer'
                    : 'Standard Till Float Active'}
                </span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                {isFromPreviousClosedTill
                  ? 'Counts match the closing till from the previous shift across all 4 categories.'
                  : 'Verify each section (Bills, Coins, Rolls, Receipts) to balance opening drawer float.'}
              </p>
              {/* Category Subtotal Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-semibold bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md text-gray-700 dark:text-gray-300">
                  Bills: <strong className="text-gray-900 dark:text-white">${totals.bills.toFixed(2)}</strong>
                </span>
                <span className="text-[10px] font-semibold bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md text-gray-700 dark:text-gray-300">
                  Coins: <strong className="text-gray-900 dark:text-white">${totals.coins.toFixed(2)}</strong>
                </span>
                <span className="text-[10px] font-semibold bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md text-gray-700 dark:text-gray-300">
                  Rolls: <strong className="text-gray-900 dark:text-white">${totals.rolls.toFixed(2)}</strong>
                </span>
                <span className="text-[10px] font-semibold bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md text-gray-700 dark:text-gray-300">
                  Receipts: <strong className="text-gray-900 dark:text-white">${totals.receipts.toFixed(2)}</strong>
                </span>
              </div>
            </div>
            <div className="text-right shrink-0 sm:pl-3">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Counted Float</span>
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300 font-mono">
                ${totals.total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Section View Tabs: All 4 Options | Bills | Coins | Rolls | Receipts */}
          <div className="flex items-center space-x-1.5 border-b border-gray-200 dark:border-gray-700 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveSection('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                activeSection === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <span>All 4 Options</span>
              <span className="text-[10px] opacity-80">(${totals.total.toFixed(0)})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('bill')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                activeSection === 'bill'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Bills</span>
              <span className="text-[10px] opacity-80">(${totals.bills.toFixed(0)})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('coin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                activeSection === 'coin'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Coins</span>
              <span className="text-[10px] opacity-80">(${totals.coins.toFixed(0)})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('roll')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                activeSection === 'roll'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Coin Rolls</span>
              <span className="text-[10px] opacity-80">(${totals.rolls.toFixed(0)})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('receipt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                activeSection === 'receipt'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Receipts</span>
              <span className="text-[10px] opacity-80">(${totals.receipts.toFixed(0)})</span>
            </button>
          </div>

          {/* All 4 Sections Grid or Focused Section */}
          {activeSection === 'all' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CashSection
                  type="bill"
                  title="Bills"
                  denominations={DENOMINATIONS.bill}
                  entries={entries}
                  onUpdateEntry={updateEntry}
                />
                <CashSection
                  type="coin"
                  title="Coins"
                  denominations={DENOMINATIONS.coin}
                  entries={entries}
                  onUpdateEntry={updateEntry}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CashSection
                  type="roll"
                  title="Coin Rolls"
                  denominations={DENOMINATIONS.roll}
                  entries={entries}
                  onUpdateEntry={updateEntry}
                />
                <ReceiptsSection
                  entries={entries}
                  onUpdateEntry={updateEntry}
                />
              </div>
            </div>
          )}

          {activeSection === 'bill' && (
            <CashSection
              type="bill"
              title="Bills"
              denominations={DENOMINATIONS.bill}
              entries={entries}
              onUpdateEntry={updateEntry}
            />
          )}

          {activeSection === 'coin' && (
            <CashSection
              type="coin"
              title="Coins"
              denominations={DENOMINATIONS.coin}
              entries={entries}
              onUpdateEntry={updateEntry}
            />
          )}

          {activeSection === 'roll' && (
            <CashSection
              type="roll"
              title="Coin Rolls"
              denominations={DENOMINATIONS.roll}
              entries={entries}
              onUpdateEntry={updateEntry}
            />
          )}

          {activeSection === 'receipt' && (
            <ReceiptsSection
              entries={entries}
              onUpdateEntry={updateEntry}
            />
          )}

          {/* Quick Float Presets & Reload Button */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-750">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-gray-500">Quick Resets:</span>
              {[150, 200, 250, 300].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleResetToStandardFloat(amt)}
                  className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-bold transition cursor-pointer"
                >
                  ${amt}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleReloadPreviousClosedTill}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reload Previous Closed Till</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={onRemindLater}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition cursor-pointer flex items-center space-x-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Remind Me Later</span>
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1.5 cursor-pointer"
            >
              <span>Open Drawer & Start Shift (${totals.total.toFixed(2)})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
