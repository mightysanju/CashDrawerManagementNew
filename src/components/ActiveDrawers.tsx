import React from 'react';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ShiftRecord } from '../types';

interface ActiveDrawersProps {
  shifts: ShiftRecord[];
  onSelectShift: (shift: ShiftRecord) => void;
  selectedShiftId: string | null;
}

export function ActiveDrawers({ shifts, onSelectShift, selectedShiftId }: ActiveDrawersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {shifts.map((shift) => (
        <div
          key={shift.id}
          onClick={() => onSelectShift(shift)}
          className={`cursor-pointer p-4 rounded-lg border-2 transition-colors ${
            selectedShiftId === shift.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock size={20} className="text-blue-600" />
            <span className="font-semibold">Drawer #{shift.drawerNumber}</span>
          </div>
          <div className="text-sm text-gray-600">
            <p>Cashier: {shift.cashierName}</p>
            <p>Started: {format(new Date(shift.openTime), 'PPpp')}</p>
            <p className="mt-2 font-medium">
              Current Balance: ${shift.entries.reduce((sum, entry) => sum + entry.total, 0).toFixed(2)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}