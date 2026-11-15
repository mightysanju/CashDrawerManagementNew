import React, { useState } from 'react';
import {
  Coins,
  Clock,
  ArrowRight,
  Hash,
  X,
} from 'lucide-react';
import { CashEntry } from '../types';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartShift: (drawerNumber: string, openingFloat: number, entries: CashEntry[]) => void;
  onRemindLater: () => void;
  defaultDrawerNumber?: string;
  cashierName: string;
}

const DEFAULT_FLOAT_PRESETS = [100, 150, 200, 250, 300];

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({
  isOpen,
  onClose,
  onStartShift,
  onRemindLater,
  defaultDrawerNumber = '1',
  cashierName,
}) => {
  const [drawerNumber, setDrawerNumber] = useState(defaultDrawerNumber);
  const [selectedFloat, setSelectedFloat] = useState<number>(200);
  const [customFloat, setCustomFloat] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);

  if (!isOpen) return null;

  const finalFloat = isCustom ? (parseFloat(customFloat) || 0) : selectedFloat;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerNumber.trim()) {
      alert('Please enter a drawer number');
      return;
    }
    if (finalFloat <= 0) {
      alert('Please select or enter a valid opening float amount');
      return;
    }

    // Generate standard cash entries for the starting float
    const entries: CashEntry[] = [
      { type: 'bill', denomination: 20, quantity: Math.floor(finalFloat * 0.5 / 20), total: Math.floor(finalFloat * 0.5 / 20) * 20 },
      { type: 'bill', denomination: 10, quantity: Math.floor(finalFloat * 0.25 / 10), total: Math.floor(finalFloat * 0.25 / 10) * 10 },
      { type: 'bill', denomination: 5, quantity: Math.floor(finalFloat * 0.15 / 5), total: Math.floor(finalFloat * 0.15 / 5) * 5 },
      { type: 'bill', denomination: 1, quantity: Math.round(finalFloat * 0.10), total: Math.round(finalFloat * 0.10) },
    ];

    onStartShift(drawerNumber.trim(), finalFloat, entries);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Start Shift — Open Cash Drawer</h3>
              <p className="text-xs text-gray-400">Confirm opening till float before taking payments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-6 space-y-4 text-xs">
          {/* Clerk ID */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                {cashierName.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Clerk on Duty</span>
                <span className="text-xs font-bold text-gray-800">{cashierName}</span>
              </div>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
              Shift Active
            </span>
          </div>

          {/* Drawer Number */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">Drawer / Till Station #</label>
            <div className="relative">
              <Hash className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={drawerNumber}
                onChange={(e) => setDrawerNumber(e.target.value)}
                placeholder="e.g. 1, Front Desk 2"
                className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Opening Float Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-gray-700">Starting Till Float</label>
              <span className="text-[11px] font-bold text-blue-600">
                ${finalFloat.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {DEFAULT_FLOAT_PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedFloat(amt);
                    setIsCustom(false);
                  }}
                  className={`py-2 px-1 text-center rounded-lg font-bold transition text-xs border ${
                    !isCustom && selectedFloat === amt
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  isCustom
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                Custom Float:
              </button>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="$0.00"
                value={customFloat}
                onFocus={() => setIsCustom(true)}
                onChange={(e) => {
                  setIsCustom(true);
                  setCustomFloat(e.target.value);
                }}
                className={`flex-1 px-3 py-1.5 bg-gray-50 border rounded-lg text-xs font-semibold focus:outline-none ${
                  isCustom ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'
                }`}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center space-x-1.5 text-xs"
            >
              <span>Open Drawer & Confirm Float (${finalFloat.toFixed(2)})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {/* Remind Me Later Option */}
            <button
              type="button"
              onClick={onRemindLater}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition flex items-center justify-center space-x-1 text-xs"
            >
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span>Remind Me Later (I'm busy with guests)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
