import React from 'react';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ShiftRecord } from '../types';

interface ShiftControlsProps {
  drawerNumber: string;
  cashierName: string;
  selectedShift: ShiftRecord | null;
  shiftDrop: number;
  onDrawerNumberChange: (value: string) => void;
  onCashierNameChange: (value: string) => void;
  onShiftDropChange: (value: number) => void;
  onStartShift: () => void;
  onEndShift: () => void;
}

export function ShiftControls({
  drawerNumber,
  cashierName,
  selectedShift,
  shiftDrop,
  onDrawerNumberChange,
  onCashierNameChange,
  onShiftDropChange,
  onStartShift,
  onEndShift
}: ShiftControlsProps) {
  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <input
          type="text"
          placeholder="Drawer Number *"
          value={drawerNumber}
          onChange={(e) => onDrawerNumberChange(e.target.value)}
          className="p-2 border rounded-lg"
          required
          disabled={selectedShift !== null}
        />
        <input
          type="text"
          placeholder="Cashier Name *"
          value={cashierName}
          onChange={(e) => onCashierNameChange(e.target.value)}
          className="p-2 border rounded-lg"
          required
          disabled={selectedShift !== null}
        />
      </div>

      {selectedShift ? (
        <div className="flex items-center justify-between bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-green-600" />
            <span className="text-green-700">
              Shift Started: {format(new Date(selectedShift.openTime), 'PPpp')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="number"
              placeholder="Shift Drop Amount"
              value={shiftDrop || ''}
              onChange={(e) => onShiftDropChange(parseFloat(e.target.value) || 0)}
              className="p-2 border rounded-lg w-40"
            />
            <button
              onClick={onEndShift}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              End Shift
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onStartShift}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Start New Shift
        </button>
      )}
    </div>
  );
}