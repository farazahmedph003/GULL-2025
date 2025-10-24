import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Transaction } from '../types';

/**
 * Export user transactions to PDF in table format
 */
export const exportUserTransactionsToPDF = async (
  transactions: Transaction[],
  projectName: string = 'User Dashboard'
): Promise<void> => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text(projectName, 14, 20);
  
  // Add export date
  doc.setFontSize(10);
  doc.text(`Export Date: ${new Date().toLocaleDateString()}`, 14, 28);
  
  // Prepare table data
  const tableData = transactions.map(t => [
    t.number,
    t.entryType.toUpperCase(),
    t.first.toLocaleString(),
    t.second.toLocaleString(),
    (t.first + t.second).toLocaleString(),
    new Date(t.createdAt).toLocaleDateString(),
  ]);
  
  // Calculate totals
  const totalFirst = transactions.reduce((sum, t) => sum + t.first, 0);
  const totalSecond = transactions.reduce((sum, t) => sum + t.second, 0);
  const totalAmount = totalFirst + totalSecond;
  
  // Add totals row
  tableData.push([
    'TOTAL',
    '',
    totalFirst.toLocaleString(),
    totalSecond.toLocaleString(),
    totalAmount.toLocaleString(),
    '',
  ]);
  
  // Generate table
  autoTable(doc, {
    startY: 35,
    head: [['Number', 'Type', 'First', 'Second', 'Total', 'Date']],
    body: tableData,
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
    footStyles: {
      fillColor: [220, 220, 220],
      fontStyle: 'bold',
    },
    // Make the last row (totals) bold
    didParseCell: function(data: any) {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [220, 252, 231]; // Light green
      }
    },
  });
  
  // Save the PDF
  const filename = `${projectName}-${new Date().toISOString().split('T')[0]}.pdf`;
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

