import React from 'react';
import { format } from 'date-fns';
import { FileText, Download, Trash2, Clock } from 'lucide-react';
import { ShiftRecord } from '../types';
import { generatePDF, generateHistoryPDF } from '../utils/pdfGenerator';
import { ShiftHistoryItem } from './ShiftHistoryItem';

interface ShiftHistoryProps {
  history: ShiftRecord[];
  onHistoryCleared: () => void;
  onShiftSelect: (shift: ShiftRecord) => void;
  selectedShiftId?: string;
}

export function ShiftHistory({ 
  history, 
  onHistoryCleared, 
  onShiftSelect,
  selectedShiftId 
}: ShiftHistoryProps) {
  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all closed shift history? This action cannot be undone.')) {
      try {
        onHistoryCleared();
      } catch (error) {
        console.error('Error clearing history:', error);
        alert('Failed to clear history. Please try again.');
      }
    }
  };

  const openShifts = history.filter(shift => shift.status === 'open');
  const closedShifts = history.filter(shift => shift.status === 'closed');

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Shift History</h2>
        <div className="flex gap-2">
          <button
            onClick={() => generateHistoryPDF(history)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={20} />
            Export All
          </button>
          <button
            onClick={handleClearHistory}
            disabled={closedShifts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={20} />
            Clear History
          </button>
        </div>
      </div>

      {/* Open Shifts Section */}
      {openShifts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="text-green-600" size={20} />
            Active Shifts
          </h3>
          <div className="space-y-4">
            {openShifts.map((shift) => (
              <ShiftHistoryItem
                key={shift.id}
                shift={shift}
                onSelect={onShiftSelect}
                isSelected={shift.id === selectedShiftId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Closed Shifts Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Closed Shifts</h3>
        <div className="space-y-4">
          {closedShifts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No closed shifts available
            </div>
          ) : (
            closedShifts.map((shift) => (
              <ShiftHistoryItem
                key={shift.id}
                shift={shift}
                onSelect={onShiftSelect}
                isSelected={shift.id === selectedShiftId}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}