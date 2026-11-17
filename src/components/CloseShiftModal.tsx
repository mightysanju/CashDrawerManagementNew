import React, { useState, useEffect } from 'react';
import {
  Coins,
  CheckCircle2,
  X,
  ShieldAlert,
  FileText,
  Printer,
} from 'lucide-react';
import { ShiftRecord, ShiftLogEntry, AppSettings } from '../types';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftRecord | null;
  currentBalance: number;
  shiftLogs?: ShiftLogEntry[];
  appSettings?: AppSettings | null;
  onConfirmClose: (finalDrop: number, closingNotes: string) => Promise<void>;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  shift,
  currentBalance,
  shiftLogs = [],
  appSettings,
  onConfirmClose,
}) => {
  const [finalDrop, setFinalDrop] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill handover notes from shift logs created during this shift
  useEffect(() => {
    if (!isOpen || !shift) return;
    setFinalDrop(0);

    if (shiftLogs && shiftLogs.length > 0) {
      const shiftStartTime = new Date(shift.openTime).getTime();
      const currentShiftLogs = shiftLogs.filter((log) => {
        if (log.shiftId === shift.id) return true;
        const logTime = new Date(log.createdAt).getTime();
        return log.clerkId === shift.cashierId && logTime >= shiftStartTime;
      });

      if (currentShiftLogs.length > 0) {
        const bulletList = currentShiftLogs
          .map((l) => {
            const cat = l.category + (l.subCategory ? ` - ${l.subCategory}` : '');
            const title = l.name || l.topic || 'Note';
            const extra =
              l.category === 'Sales' && (l.actualClosedRevenue || l.potentialRevenue)
                ? ` (${l.roomRequirement || 1} rooms, $${(l.actualClosedRevenue || l.potentialRevenue || 0).toLocaleString()})`
                : l.category === 'Complaint' && l.roomNumber
                ? ` (Rm ${l.roomNumber})`
                : '';
            const note = l.clerkNotes ? `: "${l.clerkNotes}"` : '';
            return `• [${cat}] ${title}${extra}${note}`;
          })
          .join('\n');

        setClosingNotes(
          `Shift Handover Logs Summary (${currentShiftLogs.length} items):\n${bulletList}\n\nCashier Balancing & Handover Notes:\n`
        );
        return;
      }
    }
    setClosingNotes(shift.closingNotes || '');
  }, [isOpen, shift, shiftLogs]);

  if (!isOpen || !shift) return null;

  const totalDrops = (shift.shiftDrop || 0) + (finalDrop || 0);
  const variance = currentBalance - shift.openingBalance;
  const isOver = variance > 0.009;
  const isShort = variance < -0.009;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirmClose(finalDrop, closingNotes.trim());
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to close shift. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-600 rounded-xl">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Close Shift & Drawer #{shift.drawerNumber}</h3>
              <p className="text-xs text-gray-400">Final till balancing and safe deposit drop</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Shift Reconciliation Summary Grid */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Cashier</span>
              <span className="font-bold text-gray-800 text-xs">{shift.cashierName}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Opening Float</span>
              <span className="font-bold text-gray-800 text-xs">${shift.openingBalance.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Counted Till Cash</span>
              <span className="font-extrabold text-blue-700 text-sm">${currentBalance.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Shift Variance</span>
              <span className={`font-extrabold text-sm ${
                isShort ? 'text-rose-600' : isOver ? 'text-amber-600' : 'text-emerald-700'
              }`}>
                {isShort ? `-$${Math.abs(variance).toFixed(2)} (Short)` :
                 isOver ? `+$${variance.toFixed(2)} (Over)` :
                 'Balanced ($0.00)'}
              </span>
            </div>
          </div>

          {/* Variance Alert Banner if over or short */}
          {(isShort || isOver) && (
            <div className={`p-3 rounded-xl border flex items-center space-x-2 text-xs font-semibold ${
              isShort ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>
                {isShort ? `Drawer is short by $${Math.abs(variance).toFixed(2)}. Please record explanation in notes.` :
                 `Drawer has an overage of $${variance.toFixed(2)}. Verify all receipts before closing.`}
              </span>
            </div>
          )}

          {/* Final Safe Drop Deposit */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Final Cash Drop to Safe ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={finalDrop || ''}
                onChange={(e) => setFinalDrop(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Previous drops during this shift: ${(shift.shiftDrop || 0).toFixed(2)}. Total drop to safe: ${totalDrops.toFixed(2)}.
            </p>
          </div>

          {/* Closing & Handover Notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-gray-700 dark:text-gray-300">
                Closing & Shift Handover Notes
              </label>
              <span className="text-[10px] text-blue-600 font-medium">Pre-filled from Shift Logs</span>
            </div>
            <textarea
              rows={4}
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="Add till balancing notes, drop envelope #, or handoff notes for next clerk..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono resize-y"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center space-x-2 text-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Confirm & Close Shift
                {appSettings?.autoPrintPdfOnClose !== false ? ' (Auto-PDF)' : ''}
                {appSettings?.autoPrintReceiptOnClose ? ' (Auto-Receipt)' : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-xs"
            >
              Cancel / Keep Shift Open
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
