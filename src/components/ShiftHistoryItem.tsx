import React from 'react';
import { format } from 'date-fns';
import { FileText, CheckCircle, Printer } from 'lucide-react';
import { ShiftRecord } from '../types';
import { generatePDF, printReceipt } from '../utils/pdfGenerator';

interface ShiftHistoryItemProps {
  shift: ShiftRecord;
  onSelect: (shift: ShiftRecord) => void;
  isSelected: boolean;
}

export function ShiftHistoryItem({ shift, onSelect, isSelected }: ShiftHistoryItemProps) {
  const difference = (shift.closingBalance !== undefined)
    ? shift.closingBalance - shift.openingBalance
    : null;

  return (
    <div 
      className={`border rounded-xl p-5 transition-all cursor-pointer ${
        isSelected ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'hover:border-gray-300 hover:shadow-xs bg-white'
      }`}
      onClick={() => onSelect(shift)}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">
              {shift.organizationName || 'Main Store'}
            </h3>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-mono">
              Drawer #{shift.drawerNumber}
            </span>
            {shift.status === 'open' ? (
              <span className="px-2.5 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                Active Open
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                Closed
              </span>
            )}
            {isSelected && (
              <CheckCircle size={18} className="text-blue-600" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Cashier: <strong className="text-gray-700">{shift.cashierName}</strong> • Opened: {format(new Date(shift.openTime), 'PP p')}
            {shift.closeTime && (
              <span> • Closed: {format(new Date(shift.closeTime), 'PP p')}</span>
            )}
          </p>
        </div>

        {/* Action Buttons: Print & Download PDF */}
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              printReceipt(shift);
            }}
            title="Print thermal or standard receipt"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 hover:text-blue-600 transition shadow-xs"
          >
            <Printer size={14} />
            Print Receipt
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              generatePDF(shift);
            }}
            title="Download PDF Shift Report"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition shadow-xs"
          >
            <FileText size={14} />
            PDF Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100 text-xs">
        <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
          <p className="text-gray-500 mb-0.5">Opening Float</p>
          <p className="text-sm font-bold text-gray-800">${shift.openingBalance.toFixed(2)}</p>
        </div>
        <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
          <p className="text-gray-500 mb-0.5">Counted Close</p>
          <p className="text-sm font-bold text-gray-800">
            {shift.closingBalance !== undefined ? `$${shift.closingBalance.toFixed(2)}` : 'In Progress'}
          </p>
        </div>
        <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
          <p className="text-gray-500 mb-0.5">Shift Drop</p>
          <p className="text-sm font-bold text-gray-800">
            {shift.shiftDrop !== undefined && shift.shiftDrop > 0 ? `$${shift.shiftDrop.toFixed(2)}` : '$0.00'}
          </p>
        </div>
        <div className={`p-2.5 rounded-lg border ${
          difference === null 
            ? 'bg-gray-50 border-gray-100' 
            : difference === 0 
              ? 'bg-green-50 border-green-200 text-green-900' 
              : difference > 0 
                ? 'bg-blue-50 border-blue-200 text-blue-900' 
                : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          <p className="text-gray-500 mb-0.5">Net Discrepancy</p>
          <p className="text-sm font-bold">
            {difference !== null 
              ? `${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}` 
              : '---'}
          </p>
        </div>
      </div>
    </div>
  );
}
