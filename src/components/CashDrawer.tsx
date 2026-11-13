import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, History, Printer, FileText, Wifi } from 'lucide-react';
import { CashEntry, ShiftRecord } from '../types';
import { ShiftHistory } from './ShiftHistory';
import { DatabaseManager } from '../utils/database';
import { AdUnit } from './AdUnit';
import { CashSection } from './cash-sections/CashSection';
import { ReceiptsSection } from './cash-sections/ReceiptsSection';
import { ActiveDrawers } from './ActiveDrawers';
import { DrawerControls } from './DrawerControls';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { NetworkSyncModal } from './NetworkSyncModal';
import { generatePDF, printReceipt } from '../utils/pdfGenerator';
import { p2pSyncManager, SyncState } from '../utils/p2pSyncManager';

const DENOMINATIONS = {
  bill: [100, 50, 20, 10, 5, 1],
  coin: [1, 0.25, 0.10, 0.05, 0.01],
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
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(p2pSyncManager.getState());

  const loadData = async () => {
    try {
      const allShifts = await db.getAllShifts();
      const active = allShifts.filter((shift) => shift.status === 'open');
      const closed = allShifts.filter((shift) => shift.status === 'closed');

      setActiveShifts(active);
      setShiftHistory(closed);

      setSelectedShift((prevSelected) => {
        if (prevSelected) {
          const updated = active.find((s) => s.id === prevSelected.id);
          if (updated) {
            setEntries(updated.entries);
            setShiftDrop(updated.shiftDrop || 0);
            return updated;
          }
        }
        if (active.length > 0) {
          setEntries(active[0].entries);
          setShiftDrop(active[0].shiftDrop || 0);
          setOrganizationName(active[0].organizationName || '');
          setDrawerNumber(active[0].drawerNumber);
          setCashierName(active[0].cashierName);
          return active[0];
        }
        return null;
      });
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-discover and connect immediately on startup!
    p2pSyncManager.autoConnect();

    // Listen for P2P network changes and remote sync payloads
    const unsubState = p2pSyncManager.subscribeState(setSyncState);
    const unsubData = p2pSyncManager.subscribeData(() => {
      loadData();
    });

    return () => {
      unsubState();
      unsubData();
    };
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
      alert('Please enter both drawer number and cashier name.');
      return;
    }

    if (activeShifts.some((shift) => shift.drawerNumber === drawerNumber)) {
      alert(
        'This drawer number is already in use. Please select a different number or close the active shift.'
      );
      return;
    }

    try {
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
      p2pSyncManager.broadcastShift(newShift);

      await loadData();
      handleSelectShift(newShift);

      // Clear form
      setDrawerNumber('');
      setCashierName('');
    } catch (error) {
      console.error('Error starting shift:', error);
      alert('Failed to start shift. Please try again.');
    }
  };

  const endShift = async () => {
    if (!selectedShift) return;

    const currentBalance = calculateTotal();
    const difference = currentBalance - selectedShift.openingBalance;

    const confirmMessage = `
Shift Summary for Drawer #${selectedShift.drawerNumber}
Cashier: ${selectedShift.cashierName}
---------------------------------
Opening Float:    $${selectedShift.openingBalance.toFixed(2)}
Counted Balance:  $${currentBalance.toFixed(2)}
Shift Drop:       $${shiftDrop.toFixed(2)}
Variance:         ${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}

Would you like to close this shift and generate your report?
    `;

    if (!window.confirm(confirmMessage.trim())) {
      return;
    }

    try {
      const closedShift: ShiftRecord = {
        ...selectedShift,
        closeTime: new Date().toISOString(),
        closingBalance: currentBalance,
        shiftDrop,
        entries: [...entries],
        status: 'closed',
      };

      await db.saveShift(closedShift);
      p2pSyncManager.broadcastShift(closedShift);

      // Safely download PDF report without popup blocker issues
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
      (entry) => entry.type === type && entry.denomination === denomination
    );

    let updatedEntries: CashEntry[] = [];
    if (existingIndex >= 0) {
      updatedEntries = [...entries];
      updatedEntries[existingIndex] = { type, denomination, quantity, total };
    } else {
      updatedEntries = [
        ...entries,
        { type, denomination, quantity, total },
      ];
    }

    setEntries(updatedEntries);
    if (selectedShift) {
      const updatedShift: ShiftRecord = {
        ...selectedShift,
        entries: updatedEntries,
      };
      db.saveShift(updatedShift);
      p2pSyncManager.broadcastShift(updatedShift);
    }
  };

  const currentTotal = calculateTotal();
  const currentDifference = selectedShift ? currentTotal - selectedShift.openingBalance : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pt-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
        {/* AdSense Top Banner */}
        <AdUnit slot="1234567890" format="auto" className="mb-6" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Cash Drawer Register
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Tally currency, record mid-shift cash drops, and print shift audit receipts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* P2P Network Sync Button */}
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 border rounded-lg text-xs font-semibold transition shadow-xs ${
                syncState.status === 'connected'
                  ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                  : syncState.status === 'scanning'
                    ? 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Wifi size={15} className={syncState.status === 'connected' ? 'text-green-600 animate-pulse' : ''} />
              {syncState.status === 'connected' ? (
                syncState.role === 'hub' ? (
                  syncState.connectedCount === 0
                    ? 'Auto-Sync: Main Register'
                    : `Auto-Sync: Hub (${syncState.connectedCount} peer${syncState.connectedCount > 1 ? 's' : ''})`
                ) : (
                  'Auto-Sync: Connected to Main Till'
                )
              ) : syncState.status === 'scanning' ? (
                'Auto-Sync: Scanning...'
              ) : (
                'Sync Nearby Registers'
              )}
            </button>

            {/* Shift History Toggle Button */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-300 text-gray-700 font-semibold text-xs rounded-lg hover:bg-gray-50 hover:text-blue-600 transition shadow-xs"
            >
              <History size={16} />
              {showHistory ? 'Hide Shift History' : 'View Shift History'}
            </button>
          </div>
        </div>

        {/* New Drawer Setup Section */}
        <DrawerControls
          drawerNumber={drawerNumber}
          cashierName={cashierName}
          organizationName={organizationName}
          onDrawerNumberChange={setDrawerNumber}
          onCashierNameChange={setCashierName}
          onOrganizationNameChange={setOrganizationName}
          onStartShift={startShift}
        />

        {/* Active Drawers Tab */}
        {activeShifts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2 animate-pulse"></span>
              Active Registered Tills ({activeShifts.length})
            </h2>
            <ActiveDrawers
              shifts={activeShifts}
              onSelectShift={handleSelectShift}
              selectedShiftId={selectedShift?.id || null}
            />
          </div>
        )}

        {/* Active Drawer Working Canvas */}
        {selectedShift && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between bg-blue-50/70 border border-blue-200/80 p-5 rounded-xl mb-6 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-xs">
                  <Clock size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-base">
                      Drawer #{selectedShift.drawerNumber}
                    </h3>
                    <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded">
                      Cashier: {selectedShift.cashierName}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Started: {format(new Date(selectedShift.openTime), 'PPpp')}
                  </div>
                  <div className="text-sm font-semibold text-gray-800 mt-0.5">
                    Opening Float: ${selectedShift.openingBalance.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Quick Actions & Shift Drop */}
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 py-1.5 shadow-xs">
                  <span className="text-xs font-medium text-gray-500 mr-2">Drop: $</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={shiftDrop || ''}
                    onChange={(e) =>
                      setShiftDrop(parseFloat(e.target.value) || 0)
                    }
                    className="w-20 text-sm font-semibold outline-hidden"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => printReceipt({
                    ...selectedShift,
                    closingBalance: currentTotal,
                    shiftDrop,
                    entries,
                  })}
                  title="Print receipt of current count"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 hover:text-blue-600 transition shadow-xs"
                >
                  <Printer size={15} />
                  Print Receipt
                </button>

                <button
                  type="button"
                  onClick={() => generatePDF({
                    ...selectedShift,
                    closingBalance: currentTotal,
                    shiftDrop,
                    entries,
                  })}
                  title="Download current count PDF"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 hover:text-blue-600 transition shadow-xs"
                >
                  <FileText size={15} />
                  PDF Summary
                </button>

                <button
                  onClick={endShift}
                  className="px-4 py-2 bg-red-600 text-white font-semibold text-xs rounded-lg hover:bg-red-700 transition shadow-xs"
                >
                  End Shift & Reconcile
                </button>
              </div>
            </div>

            {/* Currency Breakdown Grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <CashSection
                title="Bills"
                type="bill"
                entries={entries}
                denominations={DENOMINATIONS.bill}
                onUpdate={updateEntry}
              />
              <CashSection
                title="Loose Coins"
                type="coin"
                entries={entries}
                denominations={DENOMINATIONS.coin}
                onUpdate={updateEntry}
              />
              <CashSection
                title="Bank Rolls"
                type="roll"
                entries={entries}
                denominations={DENOMINATIONS.roll}
                onUpdate={updateEntry}
              />
              <ReceiptsSection entries={entries} onUpdate={updateEntry} />
            </div>

            {/* Summary Bar */}
            <div className="mt-8 p-5 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold text-gray-500 block mb-0.5">
                    Live Cash Counted
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-gray-900 font-mono">
                      ${currentTotal.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500">
                      (including float + receipts)
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs uppercase tracking-wider font-bold text-gray-500 block mb-0.5">
                    Variance From Float
                  </span>
                  <span
                    className={`inline-flex items-center text-sm font-bold px-2.5 py-1 rounded-md ${
                      currentDifference === 0
                        ? 'bg-gray-100 text-gray-700'
                        : currentDifference > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {currentDifference >= 0 ? '+' : ''}${currentDifference.toFixed(2)}
                    {currentDifference > 0 && ' (Intake / Over)'}
                    {currentDifference < 0 && ' (Shortage)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Modal / Drawer */}
        {showHistory && (
          <div className="mb-8">
            <ShiftHistory 
              history={shiftHistory} 
              onHistoryCleared={() => {
                p2pSyncManager.broadcastHistoryCleared();
                loadData();
              }} 
            />
          </div>
        )}

        {/* AdSense Bottom Banner */}
        <AdUnit slot="9876543210" format="auto" className="mt-8" />
      </main>

      {/* Peer-to-Peer Network Sync Modal */}
      <NetworkSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncTriggered={loadData}
      />

      <Footer />
    </div>
  );
}
export default CashDrawer;
