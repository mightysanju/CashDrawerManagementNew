import React from 'react';
import { format } from 'date-fns';
import { FileText, CheckCircle } from 'lucide-react';
import { ShiftRecord } from '../types';
import { generatePDF } from '../utils/pdfGenerator';

interface ShiftHistoryItemProps {
  shift: ShiftRecord;
  onSelect: (shift: ShiftRecord) => void;
  isSelected: boolean;
}

export function ShiftHistoryItem({ shift, onSelect, isSelected }: ShiftHistoryItemProps) {
  return (
    <div 
      className={`border rounded-lg p-4 transition-colors cursor-pointer ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
      }`}
      onClick={() => onSelect(shift)}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">
              {shift.organizationName || 'Unnamed Organization'}
            </h3>
            {shift.status === 'open' && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                Active
              </span>
            )}
            {isSelected && (
              <CheckCircle size={20} className="text-blue-500" />
            )}
          </div>
          <p className="text-sm text-gray-600">
            Cashier: {shift.cashierName} | Drawer: {shift.drawerNumber}
          </p>
          <p className="text-sm text-gray-600">
            Opened: {format(new Date(shift.openTime), 'PPpp')}
          </p>
          {shift.closeTime && (
            <p className="text-sm text-gray-600">
              Closed: {format(new Date(shift.closeTime), 'PPpp')}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            generatePDF(shift);
          }}
          className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        >
          <FileText size={16} />
          Export PDF
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-sm text-gray-600">Opening Balance</p>
          <p className="text-lg font-semibold">${shift.openingBalance.toFixed(2)}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-sm text-gray-600">Closing Balance</p>
          <p className="text-lg font-semibold">
            ${shift.closingBalance?.toFixed(2) || '---'}
          </p>
        </div>
      </div>
    </div>
  );
}