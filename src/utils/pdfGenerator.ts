import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ShiftRecord, CashEntry } from '../types';
import { format } from 'date-fns';

type EntrySummary = {
  type: CashEntry['type'];
  denomination: number;
  openingQty: number;
  openingTotal: number;
  closingQty: number;
  closingTotal: number;
};

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

const summarizeEntries = (shift: ShiftRecord): EntrySummary[] => {
  const summary = new Map<string, EntrySummary>();

  // First, process opening entries to establish initial state
  const openingEntries = shift.entries.filter(entry => !entry.isClosing);
  openingEntries.forEach((entry) => {
    const key = `${entry.type}-${entry.denomination}`;
    summary.set(key, {
      type: entry.type,
      denomination: entry.denomination,
      openingQty: entry.quantity,
      openingTotal: entry.total,
      closingQty: entry.quantity, // Default to opening quantity
      closingTotal: entry.total, // Default to opening total
    });
  });

  // Then, if shift is closed, update with closing quantities
  if (shift.status === 'closed') {
    const closingEntries = shift.entries.filter(entry => entry.isClosing);
    closingEntries.forEach((entry) => {
      const key = `${entry.type}-${entry.denomination}`;
      const existing = summary.get(key);
      if (existing) {
        existing.closingQty = entry.quantity;
        existing.closingTotal = entry.total;
      } else {
        summary.set(key, {
          type: entry.type,
          denomination: entry.denomination,
          openingQty: 0,
          openingTotal: 0,
          closingQty: entry.quantity,
          closingTotal: entry.total,
        });
      }
    });

    // Add entries that were in opening but not in closing with 0 quantities
    openingEntries.forEach((entry) => {
      const key = `${entry.type}-${entry.denomination}`;
      const closingEntry = closingEntries.find(
        e => e.type === entry.type && e.denomination === entry.denomination
      );
      if (!closingEntry) {
        const existing = summary.get(key);
        if (existing) {
          existing.closingQty = 0;
          existing.closingTotal = 0;
        }
      }
    });
  }

  return Array.from(summary.values()).sort((a, b) => {
    const typeOrder = { bill: 0, roll: 1, coin: 2, receipt: 3 };
    if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
    return b.denomination - a.denomination;
  });
};

export const generatePDF = (shift: ShiftRecord) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Title with Organization Name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const title = shift.organizationName
    ? shift.organizationName
    : 'Cash Drawer Report';
  doc.text(title, pageWidth / 2, 15, { align: 'center' });

  // Shift Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const details = [
    `Drawer: #${shift.drawerNumber}`,
    `Cashier: ${shift.cashierName}`,
    `Opened: ${format(new Date(shift.openTime), 'PPpp')}`,
  ];
  if (shift.closeTime) {
    details.push(`Closed: ${format(new Date(shift.closeTime), 'PPpp')}`);
  }

  let yPos = 25;
  details.forEach((detail) => {
    doc.text(detail, 20, yPos);
    yPos += 5;
  });

  // Financial Summary
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Opening Balance: ${formatCurrency(shift.openingBalance)}`,
    20,
    yPos
  );

  if (shift.closingBalance !== undefined) {
    yPos += 5;
    doc.text(
      `Closing Balance: ${formatCurrency(shift.closingBalance)}`,
      20,
      yPos
    );

    const difference = shift.closingBalance - shift.openingBalance;
    yPos += 5;
    doc.setTextColor(
      difference === 0 ? 0 : difference > 0 ? 0 : 255,
      difference === 0 ? 0 : difference > 0 ? 128 : 0,
      0
    );
    doc.text(
      `Difference: ${difference >= 0 ? '+' : ''}${formatCurrency(difference)}`,
      20,
      yPos
    );
    doc.setTextColor(0, 0, 0);
  }

  if (shift.shiftDrop !== undefined && shift.shiftDrop > 0) {
    yPos += 5;
    doc.text(`Shift Drop: ${formatCurrency(shift.shiftDrop)}`, 20, yPos);
  }

  // Generate detailed table
  const summaryData = summarizeEntries(shift);
  const tableData = summaryData.map((entry) => [
    entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
    formatCurrency(entry.denomination),
    entry.openingQty.toString(),
    formatCurrency(entry.openingTotal),
    entry.closingQty.toString(),
    formatCurrency(entry.closingTotal),
  ]);

  // Calculate totals
  const totals = summaryData.reduce(
    (acc, entry) => ({
      openingTotal: acc.openingTotal + entry.openingTotal,
      closingTotal: acc.closingTotal + entry.closingTotal,
    }),
    { openingTotal: 0, closingTotal: 0 }
  );

  // Add totals row
  tableData.push([
    {
      content: 'Totals',
      colSpan: 2,
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
    },
    { content: '', styles: { fillColor: [240, 240, 240] } },
    {
      content: formatCurrency(totals.openingTotal),
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
    },
    { content: '', styles: { fillColor: [240, 240, 240] } },
    {
      content: formatCurrency(totals.closingTotal),
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
    },
  ]);

  autoTable(doc, {
    startY: yPos + 10,
    head: [
      ['Type', 'Denom', 'Open Qty', 'Open Total', 'Close Qty', 'Close Total'],
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: 20 },
  });

  // Generate PDF data URL and open in new tab
  const pdfDataUri = doc.output('datauristring');
  window.open(pdfDataUri, '_blank');
};

export const generateHistoryPDF = (shifts: ShiftRecord[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Cash Drawer History Report', pageWidth / 2, 15, {
    align: 'center',
  });

  let yPosition = 25;

  shifts.forEach((shift, index) => {
    // Add page break if needed
    if (yPosition > doc.internal.pageSize.height - 60) {
      doc.addPage();
      yPosition = 20;
    }

    // Shift header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Shift #${index + 1} - ${
        shift.organizationName || 'Drawer ' + shift.drawerNumber
      }`,
      20,
      yPosition
    );

    // Shift details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    yPosition += 6;
    doc.text(
      `Drawer: #${shift.drawerNumber} | Cashier: ${shift.cashierName}`,
      20,
      yPosition
    );
    yPosition += 5;
    doc.text(
      `Opened: ${format(new Date(shift.openTime), 'PPpp')}`,
      20,
      yPosition
    );

    if (shift.closeTime) {
      yPosition += 5;
      doc.text(
        `Closed: ${format(new Date(shift.closeTime), 'PPpp')}`,
        20,
        yPosition
      );
    }

    yPosition += 8;

    // Generate detailed table for this shift
    const summaryData = summarizeEntries(shift);
    const tableData = summaryData.map((entry) => [
      entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
      formatCurrency(entry.denomination),
      entry.openingQty.toString(),
      formatCurrency(entry.openingTotal),
      entry.closingQty.toString(),
      formatCurrency(entry.closingTotal),
    ]);

    // Add summary rows
    tableData.push([
      {
        content: 'Opening Balance:',
        colSpan: 3,
        styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
      },
      {
        content: formatCurrency(shift.openingBalance),
        colSpan: 3,
        styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
      },
    ]);

    if (shift.closingBalance !== undefined) {
      tableData.push([
        {
          content: 'Closing Balance:',
          colSpan: 3,
          styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
        },
        {
          content: formatCurrency(shift.closingBalance),
          colSpan: 3,
          styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
        },
      ]);

      const difference = shift.closingBalance - shift.openingBalance;
      const diffColor =
        difference === 0
          ? [240, 240, 240]
          : difference > 0
          ? [200, 255, 200]
          : [255, 200, 200];
      tableData.push([
        {
          content: 'Difference:',
          colSpan: 3,
          styles: { fontStyle: 'bold', fillColor: diffColor },
        },
        {
          content: `${difference >= 0 ? '+' : ''}${formatCurrency(difference)}`,
          colSpan: 3,
          styles: { fontStyle: 'bold', fillColor: diffColor },
        },
      ]);
    }

    if (shift.shiftDrop !== undefined && shift.shiftDrop > 0) {
      tableData.push([
        {
          content: 'Shift Drop:',
          colSpan: 3,
          styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
        },
        {
          content: formatCurrency(shift.shiftDrop),
          colSpan: 3,
          styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
        },
      ]);
    }

    autoTable(doc, {
      startY: yPosition,
      head: [
        ['Type', 'Denom', 'Open Qty', 'Open Total', 'Close Qty', 'Close Total'],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
      },
      margin: { left: 20 },
    });

    // @ts-ignore
    yPosition = doc.lastAutoTable.finalY + 15;
  });

  // Generate PDF data URL and open in new tab
  const pdfDataUri = doc.output('datauristring');
  window.open(pdfDataUri, '_blank');
};