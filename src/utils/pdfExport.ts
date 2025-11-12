import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EntryType, Transaction } from '../types';

/**
 * Export user transactions to PDF in table format (aggregated by unique numbers)
 */
export const exportUserTransactionsToPDF = async (
  transactions: Transaction[],
  projectName: string = 'User Dashboard'
): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let cursorY = 20;

  const ENTRY_ORDER: EntryType[] = ['open', 'akra', 'ring', 'packet'];
  const ENTRY_LABEL: Record<EntryType, string> = {
    open: 'Open Entries',
    akra: 'Akra Entries',
    ring: 'Ring Entries',
    packet: 'Packet Entries',
  };

  const ensureSpace = (required: number) => {
    if (cursorY + required > pageHeight - 20) {
      doc.addPage();
      cursorY = 20;
    }
  };

  const padNumberForType = (number: string, entryType: EntryType): string => {
    const trimmed = (number ?? '').trim();
    if (entryType === 'open') {
      return trimmed || '0';
    }
    const parsedNumber = parseInt(trimmed, 10);
    const numeric = Number.isNaN(parsedNumber) ? trimmed : parsedNumber.toString();
    const length = entryType === 'akra' ? 2 : entryType === 'ring' ? 3 : 4;
    return numeric.padStart(length, '0');
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(projectName, margin, cursorY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${new Date().toLocaleString()}`,
    pageWidth - margin,
    cursorY,
    { align: 'right' },
  );
  cursorY += 10;

  if (!transactions || transactions.length === 0) {
    doc.setFontSize(12);
    doc.text('No transactions found.', margin, cursorY + 6);
    doc.save(`${projectName}-empty.pdf`);
    return;
  }

  const transactionsByType = new Map<EntryType, Transaction[]>();
  ENTRY_ORDER.forEach(type => transactionsByType.set(type, []));

  transactions.forEach(transaction => {
    const type = transaction.entryType || 'akra';
    if (!transactionsByType.has(type)) {
      transactionsByType.set(type, []);
    }
    transactionsByType.get(type)!.push(transaction);
  });

  const overallSummary = transactions.reduce(
    (acc, txn) => {
      acc.entries += 1;
      acc.first += txn.first || 0;
      acc.second += txn.second || 0;
      acc.unique.add(`${txn.entryType}-${padNumberForType(txn.number, txn.entryType)}`);
      return acc;
    },
    { entries: 0, first: 0, second: 0, unique: new Set<string>() },
  );

  doc.setFontSize(11);
  doc.text(
    `Entries: ${overallSummary.entries.toLocaleString()}  |  First: ${overallSummary.first.toLocaleString()}  |  Second: ${overallSummary.second.toLocaleString()}  |  Total: ${(overallSummary.first + overallSummary.second).toLocaleString()}  |  Unique Numbers: ${overallSummary.unique.size.toLocaleString()}`,
    margin,
    cursorY,
  );
  cursorY += 8;

  const addTypeSection = (entryType: EntryType) => {
    const typeTransactions = transactionsByType.get(entryType) || [];
    if (typeTransactions.length === 0) {
      return;
    }

    const aggregatedMap = new Map<
      string,
      { number: string; first: number; second: number }
    >();

    typeTransactions.forEach(txn => {
      const paddedNumber = padNumberForType(txn.number, entryType);
      const existing = aggregatedMap.get(paddedNumber);
      if (existing) {
        existing.first += txn.first || 0;
        existing.second += txn.second || 0;
      } else {
        aggregatedMap.set(paddedNumber, {
          number: paddedNumber,
          first: txn.first || 0,
          second: txn.second || 0,
        });
      }
    });

    const aggregatedRows = Array.from(aggregatedMap.values()).sort((a, b) =>
      a.number.localeCompare(b.number),
    );

    const typeFirstTotal = aggregatedRows.reduce((sum, row) => sum + row.first, 0);
    const typeSecondTotal = aggregatedRows.reduce((sum, row) => sum + row.second, 0);
    const typeTotal = typeFirstTotal + typeSecondTotal;
    const uniqueNumbers = aggregatedRows.length;

    ensureSpace(24);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(ENTRY_LABEL[entryType], margin, cursorY);
    cursorY += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Entries: ${typeTransactions.length.toLocaleString()} | First: ${typeFirstTotal.toLocaleString()} | Second: ${typeSecondTotal.toLocaleString()} | Total: ${typeTotal.toLocaleString()} | Unique: ${uniqueNumbers.toLocaleString()}`,
      margin + 2,
      cursorY,
    );
    cursorY += 4;

    const formatNumber = (value: number): string =>
      value === 0 ? '\u2014' : value.toLocaleString();

    const tableBody = aggregatedRows.map(row => [
      row.number,
      formatNumber(row.first),
      formatNumber(row.second),
      formatNumber(row.first + row.second),
    ]);

    tableBody.push([
      'TOTAL',
      typeFirstTotal.toLocaleString(),
      typeSecondTotal.toLocaleString(),
      typeTotal.toLocaleString(),
    ]);

    autoTable(doc, {
      startY: cursorY + 2,
      head: [['Number', 'First', 'Second', 'Total']],
      body: tableBody,
      theme: 'striped',
      margin: { left: margin, right: margin },
      styles: {
        font: 'helvetica',
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [47, 128, 237],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [247, 249, 252],
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold', halign: 'left' },
        1: { cellWidth: 32, halign: 'right' },
        2: { cellWidth: 32, halign: 'right' },
        3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      },
    didParseCell: (data: any) => {
      if (data.section === 'head') {
        data.cell.styles.halign = data.column.index === 0 ? 'left' : 'right';
      }
      if (data.row.index === tableBody.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [220, 252, 231];
        data.cell.styles.textColor = [0, 85, 68];
      }
    },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 10;
  };

  ENTRY_ORDER.forEach(addTypeSection);

  const filename = `${projectName}-${new Date()
    .toISOString()
    .split('T')[0]}.pdf`;
  doc.save(filename);
};

/**
 * Export filter results to PDF in table format
 */
export const exportFilterResultsToPDF = async (
  results: Array<{
    number: string;
    firstOriginal: number;
    firstResult: number;
    secondOriginal: number;
    secondResult: number;
  }>,
  entryType: string,
  firstTotal: number,
  secondTotal: number
): Promise<void> => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text(`Filter Results - ${entryType.toUpperCase()}`, 14, 20);
  
  // Add export date
  doc.setFontSize(10);
  doc.text(`Export Date: ${new Date().toLocaleDateString()}`, 14, 28);
  
  // Prepare table data for numbers with first results
  const firstTableData = results
    .filter(r => r.firstResult > 0)
    .map(r => [
      r.number,
      `F ${r.firstResult.toLocaleString()}`
    ]);
  
  // Prepare table data for numbers with second results
  const secondTableData = results
    .filter(r => r.secondResult > 0)
    .map(r => [
      r.number,
      `S ${r.secondResult.toLocaleString()}`
    ]);
  
  let yPos = 35;
  
  // First Results Table
  if (firstTableData.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('💰 FIRST Results', 14, yPos);
    yPos += 5;
    
    firstTableData.push([
      'TOTAL',
      `F ${firstTotal.toLocaleString()}`
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Number', 'Amount']],
      body: firstTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [16, 185, 129], // Green
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      didParseCell: function(data: any) {
        if (data.row.index === firstTableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [220, 252, 231]; // Light green
        }
      },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Second Results Table
  if (secondTableData.length > 0) {
    // Check if we need a new page
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('💎 SECOND Results', 14, yPos);
    yPos += 5;
    
    secondTableData.push([
      'TOTAL',
      `S ${secondTotal.toLocaleString()}`
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Number', 'Amount']],
      body: secondTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246], // Blue
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      didParseCell: function(data: any) {
        if (data.row.index === secondTableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [219, 234, 254]; // Light blue
        }
      },
    });
  }
  
  // Save the PDF
  const filename = `filter-results-${entryType}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

