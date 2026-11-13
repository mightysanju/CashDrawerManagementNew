import React, { useState } from 'react';
import { Plus, Store, Hash, User, ArrowRight } from 'lucide-react';
import { CashEntry } from '../types';
import { OpeningBalanceForm } from './OpeningBalanceForm';

interface DrawerControlsProps {
  drawerNumber: string;
  cashierName: string;
  organizationName: string;
  onDrawerNumberChange: (value: string) => void;
  onCashierNameChange: (value: string) => void;
  onOrganizationNameChange: (value: string) => void;
  onStartShift: (entries: CashEntry[]) => void;
  disabled?: boolean;
}

export function DrawerControls({
  drawerNumber,
  cashierName,
  organizationName,
  onDrawerNumberChange,
  onCashierNameChange,
  onOrganizationNameChange,
  onStartShift,
  disabled
}: DrawerControlsProps) {
  const [showOpeningBalance, setShowOpeningBalance] = useState(false);

  const handleStartShift = () => {
    if (!drawerNumber || !cashierName) {
      alert('Please enter both drawer number and cashier name.');
      return;
    }
    setShowOpeningBalance(true);
  };

  if (showOpeningBalance) {
    return (
      <OpeningBalanceForm
        onSubmit={(entries) => {
          setShowOpeningBalance(false);
          onStartShift(entries);
        }}
        onCancel={() => setShowOpeningBalance(false)}
      />
    );
  }

  const isValid = Boolean(drawerNumber.trim() && cashierName.trim());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Open a New Cash Drawer</h2>
          <p className="text-xs text-gray-500">Register the drawer and cashier to begin counting the opening float.</p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
          Step 1 of 2
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="relative">
          <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Store / Company Name (Optional)"
            value={organizationName}
            onChange={(e) => onOrganizationNameChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            disabled={disabled}
          />
        </div>

        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Drawer / Register # *"
            value={drawerNumber}
            onChange={(e) => onDrawerNumberChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-medium"
            required
            disabled={disabled}
          />
        </div>

        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Cashier Full Name *"
            value={cashierName}
            onChange={(e) => onCashierNameChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-medium"
            required
            disabled={disabled}
          />
        </div>
      </div>

      <button
        onClick={handleStartShift}
        disabled={disabled || !isValid}
        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition shadow-sm ${
          isValid && !disabled
            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
        }`}
      >
        <Plus size={18} />
        Continue to Opening Float Count
        <ArrowRight size={16} className="ml-1" />
      </button>
    </div>
  );
}
