import * as XLSX from 'xlsx';
import type { Transaction, NumberSummary } from '../types';

// ============================================
// EXCEL EXPORT
// ============================================

export interface ExportOptions {
  filename?: string;
  includeTimestamps?: boolean;
  includeNotes?: boolean;
}

/**
 * Export transactions to Excel file
 */
export const exportTransactionsToExcel = (
  transactions: Transaction[],
  projectName: string,
  options: ExportOptions = {}
): void => {
  const {
    filename = `${projectName}-transactions-${new Date().toISOString().split('T')[0]}.xlsx`,
    includeTimestamps = true,
    includeNotes = true,
  } = options;

  // Prepare data for export
  const exportData = transactions.map((t) => {
    const row: Record<string, string | number> = {
      Number: t.number,
      Type: t.entryType.toUpperCase(),
      'FIRST Amount': t.first,
      'SECOND Amount': t.second,
      Total: t.first + t.second,
    };

    if (includeNotes && t.notes) {
      row.Notes = t.notes;
    }

    if (includeTimestamps) {
      row.Timestamp = new Date(t.createdAt).toLocaleString();
    }

    return row;
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);

  // Set column widths
  ws['!cols'] = [
    { wch: 10 }, // Number
    { wch: 8 },  // Type
    { wch: 15 }, // FIRST Amount
    { wch: 15 }, // SECOND Amount
    { wch: 15 }, // Total
    ...(includeNotes ? [{ wch: 30 }] : []), // Notes
    ...(includeTimestamps ? [{ wch: 20 }] : []), // Timestamp
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.writeFile(wb, filename);
};

/**
 * Export number summaries to Excel
 */
export const exportSummariesToExcel = (
  summaries: Map<string, NumberSummary>,
  projectName: string,
  entryType: 'akra' | 'ring',
  options: ExportOptions = {}
): void => {
  const {
    filename = `${projectName}-${entryType}-summary-${new Date().toISOString().split('T')[0]}.xlsx`,
  } = options;

  // Prepare summary data
  const summaryData = Array.from(summaries.values()).map((s) => ({
    Number: s.number,
    'Entry Count': s.entryCount,
    'FIRST Total': s.firstTotal,
    'SECOND Total': s.secondTotal,
    'Grand Total': s.firstTotal + s.secondTotal,
    'Average FIRST': s.entryCount > 0 ? (s.firstTotal / s.entryCount).toFixed(2) : 0,
    'Average SECOND': s.entryCount > 0 ? (s.secondTotal / s.entryCount).toFixed(2) : 0,
  }));

  // Prepare detailed transactions
  const detailData: Array<Record<string, string | number>> = [];
  summaries.forEach((summary) => {
    summary.transactions.forEach((t) => {
      detailData.push({
        Number: t.number,
        'FIRST Amount': t.first,
        'SECOND Amount': t.second,
        Total: t.first + t.second,
        Notes: t.notes || '',
        Timestamp: new Date(t.createdAt).toLocaleString(),
      });
    });
  });

  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [
    { wch: 10 }, // Number
    { wch: 12 }, // Entry Count
    { wch: 15 }, // FIRST Total
    { wch: 15 }, // SECOND Total
    { wch: 15 }, // Grand Total
    { wch: 15 }, // Average FIRST
    { wch: 15 }, // Average SECOND
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Detail sheet
  if (detailData.length > 0) {
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    wsDetail['!cols'] = [
      { wch: 10 }, // Number
      { wch: 15 }, // FIRST Amount
      { wch: 15 }, // SECOND Amount
      { wch: 15 }, // Total
      { wch: 30 }, // Notes
      { wch: 20 }, // Timestamp
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detailed Transactions');
  }

  XLSX.writeFile(wb, filename);
};

// ============================================
// EXCEL IMPORT
// ============================================

export interface ImportResult {
  success: boolean;
  transactions: Omit<Transaction, 'id' | 'timestamp'>[];
  errors: string[];
  warnings: string[];
}

/**
 * Import transactions from Excel file
 */
export const importTransactionsFromExcel = (
  file: File,
  projectId: string,
  entryType: 'open' | 'akra' | 'ring' | 'packet'
): Promise<ImportResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, unknown>>;

        const transactions: Omit<Transaction, 'id' | 'timestamp'>[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        // Process each row
        jsonData.forEach((row, index) => {
          const rowNum = index + 2; // Excel row number (1-indexed + header)

          try {
            // Extract data (flexible column names)
            const number = String(
              row.Number || row.number || row.NUM || row.num || ''
            ).trim();
            const first = Number(
              row['FIRST Amount'] ||
                row['First Amount'] ||
                row.FIRST ||
                row.first ||
                row.First ||
                0
            );
            const second = Number(
              row['SECOND Amount'] ||
                row['Second Amount'] ||
                row.SECOND ||
                row.second ||
                row.Second ||
                0
            );
            const notes = String(row.Notes || row.notes || '').trim();

            // Validate
            if (!number) {
              errors.push(`Row ${rowNum}: Missing number`);
              return;
            }

            // Validate number format
            let expectedLength: number;
            switch (entryType) {
              case 'open':
                expectedLength = 1;
                break;
              case 'akra':
                expectedLength = 2;
                break;
              case 'ring':
                expectedLength = 3;
                break;
              case 'packet':
                expectedLength = 4;
                break;
              default:
                expectedLength = 2;
            }
            
            if (number.length !== expectedLength) {
              errors.push(
                `Row ${rowNum}: Invalid number format. Expected ${expectedLength} digits, got "${number}"`
              );
              return;
            }

            // Validate number is numeric
            if (!/^\d+$/.test(number)) {
              errors.push(`Row ${rowNum}: Number must contain only digits, got "${number}"`);
              return;
            }

            // Validate amounts
            if (isNaN(first) || isNaN(second)) {
              errors.push(`Row ${rowNum}: Invalid amounts`);
              return;
            }

            if (first < 0 || second < 0) {
              warnings.push(`Row ${rowNum}: Negative amounts will be converted to 0`);
            }

            // Add transaction (will be completed with timestamps when created)
            transactions.push({
              projectId,
              number,
              entryType,
              first: Math.max(0, first),
              second: Math.max(0, second),
              notes: notes || undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as Omit<Transaction, 'id'>);
          } catch (err) {
            errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        });

        resolve({
          success: errors.length === 0,
          transactions,
          errors,
          warnings,
        });
      } catch (err) {
        resolve({
          success: false,
          transactions: [],
          errors: [err instanceof Error ? err.message : 'Failed to parse Excel file'],
          warnings: [],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        transactions: [],
        errors: ['Failed to read file'],
        warnings: [],
      });
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Create Excel template for import
 */
export const downloadImportTemplate = (entryType: 'akra' | 'ring'): void => {
  const templateData = [
    {
      Number: entryType === 'akra' ? '01' : '001',
      'FIRST Amount': 100,
      'SECOND Amount': 200,
      Notes: 'Example entry',
    },
    {
      Number: entryType === 'akra' ? '02' : '002',
      'FIRST Amount': 150,
      'SECOND Amount': 250,
      Notes: 'Another example',
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(templateData);

  ws['!cols'] = [
    { wch: 10 }, // Number
    { wch: 15 }, // FIRST Amount
    { wch: 15 }, // SECOND Amount
    { wch: 30 }, // Notes
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Template');

  const filename = `GULL-Import-Template-${entryType.toUpperCase()}.xlsx`;
  XLSX.writeFile(wb, filename);
};

// ============================================
// CSV EXPORT (Alternative)
// ============================================

/**
 * Export data to CSV format
 */
export const exportToCSV = (
  data: Array<Record<string, string | number>>,
  filename: string
): void => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');

  // Convert data to CSV rows
  const csvRows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',');
  });

  // Combine headers and rows
  const csv = [csvHeaders, ...csvRows].join('\n');

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

