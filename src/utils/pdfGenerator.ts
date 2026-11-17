import { jsPDF } from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import { ShiftRecord, ShiftLogEntry } from '../types';
import { format } from 'date-fns';

/**
 * Downloads a formatted executive PDF shift reconciliation and audit report
 */
export const generatePDF = (shift: ShiftRecord) => {
  const doc = new jsPDF();
  const orgName = shift.organizationName || 'Cash Drawer Management';
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Header Banner Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Title with Organization Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName.toUpperCase(), pageWidth / 2, 11, { align: 'center' });

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('EXECUTIVE CASH DRAWER AUDIT & RECONCILIATION REPORT', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Official Audit Generated: ${format(new Date(), 'PPpp')}`, pageWidth / 2, 24, { align: 'center' });

  // Reset text color
  doc.setTextColor(15, 23, 42);

  // Shift Metadata Card
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 32, pageWidth - 28, 22, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Shift ID:', 18, 38);
  doc.text('Drawer / Till #:', 18, 44);
  doc.text('Cashier on Duty:', 18, 50);

  doc.setFont('helvetica', 'normal');
  doc.text(shift.id, 45, 38);
  doc.text(`Drawer ${shift.drawerNumber}`, 45, 44);
  doc.text(`${shift.cashierName} ${shift.cashierId ? `(ID: ${shift.cashierId})` : ''}`, 45, 50);

  doc.setFont('helvetica', 'bold');
  doc.text('Open Time:', pageWidth / 2 + 5, 38);
  doc.text('Close Time:', pageWidth / 2 + 5, 44);
  doc.text('Shift Status:', pageWidth / 2 + 5, 50);

  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(shift.openTime), 'PPpp'), pageWidth / 2 + 30, 38);
  doc.text(shift.closeTime ? format(new Date(shift.closeTime), 'PPpp') : 'Still Open / Active', pageWidth / 2 + 30, 44);
  
  if (shift.status === 'closed') {
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.setFont('helvetica', 'bold');
    doc.text('CLOSED & RECONCILED', pageWidth / 2 + 30, 50);
  } else {
    doc.setTextColor(37, 99, 235); // blue-600
    doc.setFont('helvetica', 'bold');
    doc.text('OPEN / IN PROGRESS', pageWidth / 2 + 30, 50);
  }
  doc.setTextColor(15, 23, 42);

  // Financial Reconciliation Summary
  const yFin = 58;
  const colWidth = (pageWidth - 28 - 9) / 4;

  const openingFloat = shift.openingBalance;
  const shiftDrop = shift.shiftDrop || 0;
  const closingBalance = shift.closingBalance !== undefined ? shift.closingBalance : shift.openingBalance;
  const variance = closingBalance - openingFloat;

  // Box 1: Opening Float
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, yFin, colWidth, 16, 1.5, 1.5, 'F');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('OPENING FLOAT', 14 + colWidth / 2, yFin + 5, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`$${openingFloat.toFixed(2)}`, 14 + colWidth / 2, yFin + 12, { align: 'center' });

  // Box 2: Total Drops
  const xBox2 = 14 + colWidth + 3;
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(xBox2, yFin, colWidth, 16, 1.5, 1.5, 'F');
  doc.setFontSize(7);
  doc.setTextColor(185, 28, 28);
  doc.text('SAFE DEPOSIT DROPS', xBox2 + colWidth / 2, yFin + 5, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text(`$${shiftDrop.toFixed(2)}`, xBox2 + colWidth / 2, yFin + 12, { align: 'center' });

  // Box 3: Counted Till Balance
  const xBox3 = xBox2 + colWidth + 3;
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(xBox3, yFin, colWidth, 16, 1.5, 1.5, 'F');
  doc.setFontSize(7);
  doc.setTextColor(29, 78, 216);
  doc.text('COUNTED TILL CASH', xBox3 + colWidth / 2, yFin + 5, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216);
  doc.text(`$${closingBalance.toFixed(2)}`, xBox3 + colWidth / 2, yFin + 12, { align: 'center' });

  // Box 4: Shift Variance (Over / Short / Balanced)
  const xBox4 = xBox3 + colWidth + 3;
  const isBalanced = Math.abs(variance) < 0.01;
  const isShort = variance < -0.01;
  doc.setFillColor(isBalanced ? 236 : isShort ? 254 : 254, isBalanced ? 253 : isShort ? 242 : 243, isBalanced ? 245 : isShort ? 242 : 199);
  doc.roundedRect(xBox4, yFin, colWidth, 16, 1.5, 1.5, 'F');
  doc.setFontSize(7);
  doc.setTextColor(isBalanced ? 4 : isShort ? 185 : 180, isBalanced ? 120 : isShort ? 28 : 83, isBalanced ? 87 : isShort ? 28 : 9);
  doc.text(isBalanced ? 'BALANCE STATUS' : isShort ? 'VARIANCE (SHORT)' : 'VARIANCE (OVER)', xBox4 + colWidth / 2, yFin + 5, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isBalanced ? '$0.00 (Balanced)' : `${variance > 0 ? '+' : ''}$${variance.toFixed(2)}`,
    xBox4 + colWidth / 2,
    yFin + 12,
    { align: 'center' }
  );

  // Till Breakdown Table
  const tableData: RowInput[] = [];
  let calculatedTillTotal = 0;

  shift.entries.forEach((entry) => {
    tableData.push([
      entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
      `$${entry.denomination.toFixed(2)}`,
      entry.quantity.toString(),
      `$${entry.total.toFixed(2)}`,
    ]);
    calculatedTillTotal += entry.total;
  });

  tableData.push([
    {
      content: 'TOTAL COUNTED TILL CASH',
      colSpan: 3,
      styles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', halign: 'left' },
    },
    {
      content: `$${calculatedTillTotal.toFixed(2)}`,
      styles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', halign: 'right' },
    },
  ]);

  autoTable(doc, {
    startY: yFin + 20,
    head: [['Denomination Category', 'Unit Value', 'Count / Quantity', 'Total Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      lineWidth: 0.1,
      lineColor: [226, 232, 240],
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 'auto', halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // End of table position
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 160;

  // Shift Handover Notes & Shift Logs Box
  const notesY = Math.min(finalY + 6, pageHeight - 65);
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, notesY, pageWidth - 28, 22, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('SHIFT HANDOVER NOTES & OPERATIONAL LOGS:', 18, notesY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  const notesText = shift.closingNotes || shift.handoverNotes || 'No specific handover notes recorded for this shift.';
  const splitNotes = doc.splitTextToSize(notesText, pageWidth - 36);
  doc.text(splitNotes.slice(0, 3), 18, notesY + 10);

  // Dual Formal Verification & Signatures Section
  const sigY = notesY + 28;
  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.4);

  // Cashier Signature Line
  doc.line(18, sigY + 12, 90, sigY + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CASHIER SIGNATURE', 18, sigY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(`Printed: ${shift.cashierName}`, 18, sigY + 20);
  doc.text(`Date: ${shift.closeTime ? format(new Date(shift.closeTime), 'PP') : format(new Date(), 'PP')}`, 18, sigY + 24);

  // Manager Signature Line
  const mgrLineX = pageWidth / 2 + 10;
  doc.line(mgrLineX, sigY + 12, mgrLineX + 72, sigY + 12);
  doc.setFont('helvetica', 'bold');
  doc.text('MANAGER / SUPERVISOR SIGNATURE', mgrLineX, sigY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text('Printed: _________________________________', mgrLineX, sigY + 20);
  doc.text(`Date: ${shift.closeTime ? format(new Date(shift.closeTime), 'PP') : format(new Date(), 'PP')}`, mgrLineX, sigY + 24);

  // Footer Audit Trail
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Official Property Audit Record • FrontDesk Pro Cash Drawer Management System • Shift ID: ${shift.id}`,
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  );

  // Safe file download
  const filename = `shift-reconciliation-drawer-${shift.drawerNumber}-${format(new Date(shift.openTime), 'yyyyMMdd-HHmm')}.pdf`;
  doc.save(filename);
};

/**
 * Downloads a combined PDF history report for multiple shifts
 */
export const generateHistoryPDF = (shifts: ShiftRecord[]) => {
  if (!shifts || shifts.length === 0) {
    alert('No shift history available to export.');
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Complete Shift History Report', pageWidth / 2, 15, { align: 'center' });

  let yPosition = 30;

  shifts.forEach((shift, index) => {
    // Add page break if needed
    if (yPosition > doc.internal.pageSize.height - 70) {
      doc.addPage();
      yPosition = 20;
    }

    // Shift header
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Shift #${index + 1} - ${shift.organizationName || 'N/A'} (Drawer: ${shift.drawerNumber})`,
      20,
      yPosition
    );

    // Shift details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    yPosition += 7;
    doc.text(
      `Cashier: ${shift.cashierName} | Opened: ${format(new Date(shift.openTime), 'PPpp')}`,
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

    yPosition += 7;

    // Financial summary table
    const tableData: RowInput[] = shift.entries.map((entry) => [
      entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
      `$${entry.denomination.toFixed(2)}`,
      entry.quantity.toString(),
      `$${entry.total.toFixed(2)}`,
    ]);

    // Add totals
    tableData.push([
      {
        content: 'Opening Balance',
        colSpan: 3,
        styles: { fontStyle: 'bold', fillColor: [243, 244, 246] },
      },
      {
        content: `$${shift.openingBalance.toFixed(2)}`,
        styles: { fontStyle: 'bold', fillColor: [243, 244, 246] },
      },
    ]);

    if (shift.closingBalance !== undefined) {
      tableData.push([
        {
          content: 'Closing Balance',
          colSpan: 3,
          styles: { fontStyle: 'bold', fillColor: [243, 244, 246] },
        },
        {
          content: `$${shift.closingBalance.toFixed(2)}`,
          styles: { fontStyle: 'bold', fillColor: [243, 244, 246] },
        },
      ]);

      const difference = shift.closingBalance - shift.openingBalance;
      tableData.push([
        {
          content: 'Difference (Over / Short)',
          colSpan: 3,
          styles: {
            fontStyle: 'bold',
            fillColor: difference === 0 ? [243, 244, 246] : difference > 0 ? [220, 252, 231] : [254, 226, 226],
          },
        },
        {
          content: `${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}`,
          styles: {
            fontStyle: 'bold',
            fillColor: difference === 0 ? [243, 244, 246] : difference > 0 ? [220, 252, 231] : [254, 226, 226],
          },
        },
      ]);
    }

    if (shift.shiftDrop !== undefined && shift.shiftDrop > 0) {
      tableData.push([
        {
          content: 'Shift Drop',
          colSpan: 3,
          styles: { fontStyle: 'bold', fillColor: [243, 244, 246] },
        },
        {
          content: `$${shift.shiftDrop.toFixed(2)}`,
          styles: { fontStyle: 'bold', fillColor: [243, 244, 246] },
        },
      ]);
    }

    // Generate table
    autoTable(doc, {
      startY: yPosition,
      head: [['Type', 'Denomination', 'Quantity', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 1.5,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 40, halign: 'right' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' },
      },
      margin: { left: 20 },
    });

    // @ts-expect-error autoTable plugin attaches finalY
    yPosition = doc.lastAutoTable.finalY + 15;
  });

  const filename = `all-shifts-history-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`;
  doc.save(filename);
};

/**
 * Directly prints a receipt formatted for thermal printers or standard 8.5x11 paper
 */
export const printReceipt = (shift: ShiftRecord) => {
  const printIframe = document.createElement('iframe');
  printIframe.style.position = 'fixed';
  printIframe.style.right = '0';
  printIframe.style.bottom = '0';
  printIframe.style.width = '0';
  printIframe.style.height = '0';
  printIframe.style.border = '0';

  document.body.appendChild(printIframe);

  const doc = printIframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const difference = (shift.closingBalance ?? 0) - shift.openingBalance;
  const grandTotal = shift.entries.reduce((sum, e) => sum + e.total, 0);

  const receiptContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Shift Receipt - Drawer #${shift.drawerNumber}</title>
        <style>
          @page {
            size: auto;
            margin: 8mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
            line-height: 1.4;
            color: #111;
            margin: 0;
            padding: 10px;
            max-width: 380px;
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .header { border-bottom: 2px dashed #333; padding-bottom: 10px; margin-bottom: 12px; }
          .org-title { font-size: 18px; font-weight: bold; margin: 0 0 4px 0; }
          .subtitle { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
          .info-table { width: 100%; margin-bottom: 12px; font-size: 12px; }
          .info-table td { padding: 2px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .items-table th { border-bottom: 1px solid #333; text-align: left; padding: 4px 0; font-size: 11px; text-transform: uppercase; }
          .items-table td { padding: 4px 0; border-bottom: 1px dotted #ccc; font-size: 12px; }
          .summary-table { width: 100%; margin-top: 10px; border-top: 2px dashed #333; padding-top: 8px; }
          .summary-table td { padding: 3px 0; }
          .diff-row { font-size: 14px; font-weight: bold; }
          .footer { margin-top: 18px; border-top: 1px dashed #777; padding-top: 8px; font-size: 11px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header text-center">
          <div class="org-title">${shift.organizationName || 'Cash Drawer System'}</div>
          <div class="subtitle">Shift Balance Receipt</div>
        </div>

        <table class="info-table">
          <tr>
            <td><strong>Drawer #:</strong> ${shift.drawerNumber}</td>
            <td class="text-right"><strong>Cashier:</strong> ${shift.cashierName}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Opened:</strong> ${format(new Date(shift.openTime), 'PPpp')}</td>
          </tr>
          ${shift.closeTime ? `<tr><td colspan="2"><strong>Closed:</strong> ${format(new Date(shift.closeTime), 'PPpp')}</td></tr>` : ''}
        </table>

        <table class="items-table">
          <thead>
            <tr>
              <th>Denom</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${shift.entries
              .filter(e => e.quantity > 0)
              .map(entry => `
                <tr>
                  <td>${entry.type.toUpperCase()} $${entry.denomination.toFixed(2)}</td>
                  <td class="text-right">${entry.quantity}</td>
                  <td class="text-right">$${entry.total.toFixed(2)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>

        <table class="summary-table">
          <tr>
            <td>Opening Float:</td>
            <td class="text-right font-bold">$${shift.openingBalance.toFixed(2)}</td>
          </tr>
          ${shift.closingBalance !== undefined ? `
            <tr>
              <td>Counted Total:</td>
              <td class="text-right font-bold">$${shift.closingBalance.toFixed(2)}</td>
            </tr>
            <tr class="diff-row">
              <td>Net Discrepancy:</td>
              <td class="text-right">${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}</td>
            </tr>
          ` : `
            <tr>
              <td>Current Drawer Total:</td>
              <td class="text-right font-bold">$${grandTotal.toFixed(2)}</td>
            </tr>
          `}
          ${shift.shiftDrop !== undefined && shift.shiftDrop > 0 ? `
            <tr>
              <td>Shift Drop Deposited:</td>
              <td class="text-right font-bold">-$${shift.shiftDrop.toFixed(2)}</td>
            </tr>
          ` : ''}
        </table>

        <div class="footer">
          Printed: ${format(new Date(), 'PPpp')}<br />
          Cash Drawer Management System
        </div>
      </body>
    </html>
  `;

  doc.open();
  doc.write(receiptContent);
  doc.close();

  setTimeout(() => {
    printIframe.contentWindow?.focus();
    printIframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(printIframe);
    }, 2000);
  }, 300);
};

/**
 * Downloads a comprehensive PDF audit report of Shift Logs and all staff actions/responses
 * for a specific date range.
 */
export const generateShiftLogAuditPDF = (
  logs: ShiftLogEntry[],
  startDate: string,
  endDate: string,
  orgName: string = 'FrontDesk Pro'
) => {
  if (!logs || logs.length === 0) {
    alert('No shift logs found for the selected date range.');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(orgName, pageWidth / 2, 14, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235); // blue-600
  doc.text('Front Desk Shift Logs & Staff Actions Audit Report', pageWidth / 2, 21, { align: 'center' });

  // Filter & Generation Metadata
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  const dateRangeText = `Report Period: ${startDate ? format(new Date(startDate), 'PP') : 'Beginning'} - ${endDate ? format(new Date(endDate), 'PP') : 'Present'}  |  Generated: ${format(new Date(), 'PPpp')}`;
  doc.text(dateRangeText, pageWidth / 2, 27, { align: 'center' });

  // Summary Metrics calculations
  const totalLogs = logs.length;
  const salesCount = logs.filter(l => l.category === 'Sales').length;
  const complaintCount = logs.filter(l => l.category === 'Complaint').length;
  const miscCount = logs.filter(l => l.category === 'Miscellaneous').length;
  const totalResponses = logs.reduce((acc, l) => acc + (l.responses?.length || 0), 0);
  const potentialRevenue = logs
    .filter(l => l.category === 'Sales')
    .reduce((acc, l) => acc + (l.roughRevenueEstimate || 0), 0);

  // Executive KPI Summary Banner
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(14, 31, pageWidth - 28, 14, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);

  const kpiText = `Total Entries: ${totalLogs}   |   Sales Leads: ${salesCount} ($${potentialRevenue.toLocaleString()} est.)   |   Complaints: ${complaintCount}   |   Misc Notes: ${miscCount}   |   Staff Actions / Responses Logged: ${totalResponses}`;
  doc.text(kpiText, pageWidth / 2, 40, { align: 'center' });

  // Prepare autoTable rows
  const tableData: RowInput[] = logs.map((log) => {
    // 1. Timestamp & Clerk
    let timeFormatted = log.createdAt;
    try {
      timeFormatted = format(new Date(log.createdAt), 'MMM d, yyyy\nh:mm a');
    } catch {
      timeFormatted = log.createdAt;
    }
    const clerkInfo = `${timeFormatted}\nby ${log.clerkName}\n(${log.clerkRole})`;

    // 2. Category & Subcategory
    const catDisplay = `${log.category}${log.subCategory ? `\n• ${log.subCategory}` : ''}`;

    // 3. Guest / Subject / Details
    let details = '';
    if (log.category === 'Sales') {
      details = `Contact: ${log.name || 'N/A'}\nPhone: ${log.phoneNumber || 'N/A'}\nEmail: ${log.email || 'N/A'}\nReq: ${log.roomRequirement || 'N/A'} (${log.totalNights || 1} nights)\nDates: ${log.datesRequired || 'N/A'}\nEst. Rev: $${log.roughRevenueEstimate?.toLocaleString() || '0'}`;
    } else if (log.category === 'Complaint') {
      details = `Guest: ${log.name || 'N/A'}\nPhone: ${log.phoneNumber || 'N/A'}\nRoom: ${log.roomNumber || 'N/A'}${log.reservationNumber ? `\nRes #: ${log.reservationNumber}` : ''}`;
    } else {
      details = `Topic: ${log.topic || 'N/A'}${log.roomNumber ? `\nRoom: ${log.roomNumber}` : ''}`;
    }
    if (log.clerkNotes) {
      details += `\n\nNotes: "${log.clerkNotes}"`;
    }

    // 4. Status
    let statusText = 'Logged';
    if (log.category === 'Sales') {
      statusText = log.salesStatus || 'New Lead';
    } else if (log.category === 'Complaint') {
      statusText = log.complaintStatus || 'Open';
    }

    // 5. Actions & Staff Responses
    let actionHistory = 'No staff responses yet';
    if (log.responses && log.responses.length > 0) {
      actionHistory = log.responses
        .map((r, idx) => {
          let rTime = r.createdAt;
          try {
            rTime = format(new Date(r.createdAt), 'MMM d h:mm a');
          } catch {
            rTime = r.createdAt;
          }
          return `${idx + 1}. [${rTime}] ${r.authorName} (${r.authorRole}):\n   "${r.message}"`;
        })
        .join('\n\n');
    }

    return [
      clerkInfo,
      catDisplay,
      details,
      statusText,
      actionHistory,
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [['Logged At & Clerk', 'Category', 'Guest / Topic / Details', 'Status', 'Staff Actions & Threaded Responses']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineWidth: 0.1,
      lineColor: [226, 232, 240],
      overflow: 'linebreak',
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 28 },
      2: { cellWidth: 70 },
      3: { cellWidth: 26 },
      4: { cellWidth: 'auto' }, // actions fill remaining space
    },
    didDrawPage: (data) => {
      // Page numbering footer
      const str = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}  •  FrontDesk Pro Operations Platform (Client-Side Local Storage)`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(str, pageWidth / 2, pageHeight - 6, { align: 'center' });
    },
    margin: { left: 14, right: 14, bottom: 12 },
  });

  const fileStart = startDate ? format(new Date(startDate), 'yyyyMMdd') : 'all';
  const fileEnd = endDate ? format(new Date(endDate), 'yyyyMMdd') : format(new Date(), 'yyyyMMdd');
  doc.save(`shift-logs-audit-report-${fileStart}-to-${fileEnd}.pdf`);
};

/**
 * Exports Shift Logs and full action history to CSV spreadsheet for Excel / Sheets
 */
export const exportShiftLogsToCSV = (
  logs: ShiftLogEntry[],
  startDate: string,
  endDate: string
) => {
  if (!logs || logs.length === 0) {
    alert('No logs available to export for this date range.');
    return;
  }

  const headers = [
    'Log ID',
    'Created At',
    'Category',
    'SubCategory',
    'Guest / Contact Name',
    'Phone Number',
    'Email',
    'Room Number',
    'Reservation Number',
    'Dates Required',
    'Room Requirement',
    'Potential Nights',
    'Estimated Revenue ($)',
    'Status',
    'Clerk Name',
    'Clerk Role',
    'Clerk Initial Notes',
    'Actions Count',
    'Full Action & Response History',
  ];

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = logs.map((log) => {
    const actionHistory = (log.responses || [])
      .map((r, i) => {
        let rTime = r.createdAt;
        try {
          rTime = format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm');
        } catch {
          rTime = r.createdAt;
        }
        return `[${i + 1}] (${rTime}) ${r.authorName} (${r.authorRole}): ${r.message}`;
      })
      .join(' | ');

    return [
      escapeCSV(log.id),
      escapeCSV(log.createdAt),
      escapeCSV(log.category),
      escapeCSV(log.subCategory),
      escapeCSV(log.name || log.topic),
      escapeCSV(log.phoneNumber),
      escapeCSV(log.email),
      escapeCSV(log.roomNumber),
      escapeCSV(log.reservationNumber),
      escapeCSV(log.datesRequired),
      escapeCSV(log.roomRequirement),
      escapeCSV(log.totalNights),
      escapeCSV(log.roughRevenueEstimate),
      escapeCSV(log.salesStatus || log.complaintStatus || 'Logged'),
      escapeCSV(log.clerkName),
      escapeCSV(log.clerkRole),
      escapeCSV(log.clerkNotes),
      escapeCSV(log.responses?.length || 0),
      escapeCSV(actionHistory),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const fileStart = startDate ? format(new Date(startDate), 'yyyyMMdd') : 'all';
  const fileEnd = endDate ? format(new Date(endDate), 'yyyyMMdd') : format(new Date(), 'yyyyMMdd');
  link.setAttribute('download', `shift-logs-audit-${fileStart}-to-${fileEnd}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
