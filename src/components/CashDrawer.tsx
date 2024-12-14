import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, History } from 'lucide-react';
import { CashEntry, ShiftRecord } from '../types';
import { ShiftHistory } from './ShiftHistory';
import { DatabaseManager } from '../utils/database';
//import { AdUnit } from './AdUnit';
import { CashSection } from './cash-sections/CashSection';
import { ReceiptsSection } from './cash-sections/ReceiptsSection';
import { ActiveDrawers } from './ActiveDrawers';
import { DrawerControls } from './DrawerControls';
import { Navbar } from './Navbar';

const DENOMINATIONS = {
  bill: [100, 50, 20, 10, 5, 1],
  coin: [1, 0.25, 0.1, 0.05, 0.01],
  roll: [10, 5, 2, 1, 0.5],
};

const db = new DatabaseManager();

export function CashDrawer() {
  const [organizationName, setOrganizationName] = useState('');
  const [drawerNumber, setDrawerNumber] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [activeShifts, setActiveShifts] = useState<ShiftRecord[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftRecord | null>(null);
  const [shiftHistory, setShiftHistory] = useState<ShiftRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [shiftDrop, setShiftDrop] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const allShifts = await db.getAllShifts();
      const active = allShifts.filter((shift) => shift.status === 'open');
      const closed = allShifts.filter((shift) => shift.status === 'closed');

      setActiveShifts(active);
      setShiftHistory(closed);

      if (active.length > 0 && !selectedShift) {
        handleSelectShift(active[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectShift = (shift: ShiftRecord) => {
    setSelectedShift(shift);
    setEntries(shift.entries);
    setOrganizationName(shift.organizationName || '');
    setDrawerNumber(shift.drawerNumber);
    setCashierName(shift.cashierName);
  };

  const startShift = async (openingEntries: CashEntry[]) => {
    if (!drawerNumber || !cashierName) {
      alert('Please enter both drawer number and cashier name');
      return;
    }

    // Check if drawer number is already in use
    if (activeShifts.some((shift) => shift.drawerNumber === drawerNumber)) {
      alert(
        'This drawer number is already in use. Please choose a different one.'
      );
      return;
    }

    try {
      setIsLoading(true);
      const openingBalance = openingEntries.reduce(
        (sum, entry) => sum + entry.total,
        0
      );

      const newShift: ShiftRecord = {
        id: Date.now().toString(),
        organizationName,
        drawerNumber,
        cashierName,
        openTime: new Date().toISOString(),
        openingBalance,
        entries: openingEntries,
        status: 'open',
      };

      await db.saveShift(newShift);
      await loadData();
      handleSelectShift(newShift);

      // Clear form
      setDrawerNumber('');
      setCashierName('');
    } catch (error) {
      console.error('Error starting shift:', error);
      alert('Failed to start shift. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const endShift = async () => {
    if (!selectedShift) return;

    const currentBalance = calculateTotal();
    const difference = currentBalance - selectedShift.openingBalance;

    if (
      !window.confirm(`
      Opening Balance: $${selectedShift.openingBalance.toFixed(2)}
      Current Balance: $${currentBalance.toFixed(2)}
      Difference: ${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}
      
      Are you sure you want to end this shift?
    `)
    ) {
      return;
    }

    try {
      setIsLoading(true);
      const closedShift: ShiftRecord = {
        ...selectedShift,
        closeTime: new Date().toISOString(),
        closingBalance: currentBalance,
        shiftDrop,
        entries: [...entries],
        status: 'closed',
      };

      await db.saveShift(closedShift);

      // Generate PDF after saving the shift
      setTimeout(() => {
        generatePDF(closedShift);
      }, 100);

      setSelectedShift(null);
      setEntries([]);
      setShiftDrop(0);
      await loadData();
    } catch (error) {
      console.error('Error ending shift:', error);
      alert('Failed to end shift. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotal = () =>
    entries.reduce((sum, entry) => sum + entry.total, 0);

  const updateEntry = (
    type: CashEntry['type'],
    denomination: number,
    quantity: number
  ) => {
    const total = denomination * quantity;
    const existingIndex = entries.findIndex(
      (e) => e.type === type && e.denomination === denomination
    );

    const newEntries = [...entries];
    if (existingIndex >= 0) {
      if (quantity === 0) {
        newEntries.splice(existingIndex, 1);
      } else {
        newEntries[existingIndex] = { type, denomination, quantity, total };
      }
    } else if (quantity > 0) {
      newEntries.push({ type, denomination, quantity, total });
    }
    setEntries(newEntries);

    // Update the active shift in real-time
    if (selectedShift) {
      const updatedShift = { ...selectedShift, entries: newEntries };
      setSelectedShift(updatedShift);
      db.saveShift(updatedShift).catch(console.error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-xl font-semibold text-gray-700">Loading...</div>
          <p className="mt-2 text-gray-500">
            Please wait while we initialize the system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div> <Navbar />
    <div className="min-h-screen pt-32 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/*<div className="mb-8">
          <AdUnit slot="top-banner" className="mx-auto max-w-[728px]" />
        </div>*/}

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Cash Drawer Manager
          </h1>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <History size={20} />
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <DrawerControls
          drawerNumber={drawerNumber}
          cashierName={cashierName}
          organizationName={organizationName}
          onDrawerNumberChange={setDrawerNumber}
          onCashierNameChange={setCashierName}
          onOrganizationNameChange={setOrganizationName}
          onStartShift={startShift}
        />

        {activeShifts.length > 0 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Active Drawers</h2>
            <ActiveDrawers
              shifts={activeShifts}
              onSelectShift={handleSelectShift}
              selectedShiftId={selectedShift?.id || null}
            />
          </>
        )}

        {selectedShift && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between bg-green-50 p-4 rounded-lg mb-6">
              <div className="flex items-center gap-2">
                <Clock size={20} className="text-green-600" />
                <div className="text-green-700">
                  <div>
                    Drawer #{selectedShift.drawerNumber} -{' '}
                    {selectedShift.cashierName}
                  </div>
                  <div>
                    Started: {format(new Date(selectedShift.openTime), 'PPpp')}
                  </div>
                  <div className="font-medium">
                    Opening Balance: ${selectedShift.openingBalance.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  placeholder="Shift Drop Amount"
                  value={shiftDrop || ''}
                  onChange={(e) =>
                    setShiftDrop(parseFloat(e.target.value) || 0)
                  }
                  className="p-2 border rounded-lg w-40"
                />
                <button
                  onClick={endShift}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  End Shift
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <CashSection
                title="Bills"
                type="bill"
                entries={entries}
                denominations={DENOMINATIONS.bill}
                onUpdate={updateEntry}
              />
              <CashSection
                title="Coins"
                type="coin"
                entries={entries}
                denominations={DENOMINATIONS.coin}
                onUpdate={updateEntry}
              />
              <CashSection
                title="Rolls"
                type="roll"
                entries={entries}
                denominations={DENOMINATIONS.roll}
                onUpdate={updateEntry}
              />
              <ReceiptsSection entries={entries} onUpdate={updateEntry} />
            </div>

            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-xl font-semibold">Current Balance:</span>
                <div className="text-right">
                  <span className="text-2xl font-bold">
                    ${calculateTotal().toFixed(2)}
                  </span>
                  {calculateTotal() !== selectedShift.openingBalance && (
                    <div
                      className={`text-sm font-medium ${
                        calculateTotal() > selectedShift.openingBalance
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {calculateTotal() > selectedShift.openingBalance
                        ? '+'
                        : ''}
                      $
                      {(
                        calculateTotal() - selectedShift.openingBalance
                      ).toFixed(2)}{' '}
                      from opening
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showHistory && (
          <ShiftHistory history={shiftHistory} onHistoryCleared={loadData} />
        )}

        {/*<div className="mt-8">
          <AdUnit slot="bottom-banner" className="mx-auto max-w-[728px]" />
        </div>*/}
      </div>
    </div></div>
  );
}
