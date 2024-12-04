import React, { useState } from 'react';
import { Plus } from 'lucide-react';
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
      alert('Please enter both drawer number and cashier name');
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

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Start New Drawer</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <input
          type="text"
          placeholder="Organization Name (Optional)"
          value={organizationName}
          onChange={(e) => onOrganizationNameChange(e.target.value)}
          className="p-2 border rounded-lg"
          disabled={disabled}
        />
        <input
          type="text"
          placeholder="Drawer Number *"
          value={drawerNumber}
          onChange={(e) => onDrawerNumberChange(e.target.value)}
          className="p-2 border rounded-lg"
          required
          disabled={disabled}
        />
        <input
          type="text"
          placeholder="Cashier Name *"
          value={cashierName}
          onChange={(e) => onCashierNameChange(e.target.value)}
          className="p-2 border rounded-lg"
          required
          disabled={disabled}
        />
      </div>
      <button
        onClick={handleStartShift}
        disabled={disabled || !drawerNumber || !cashierName}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus size={20} />
        Start New Drawer
      </button>
    </div>
  );
}