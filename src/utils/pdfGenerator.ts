import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Transaction } from '../types';

interface UserReportData {
  user: {
    fullName: string;
    username: string;
    email: string;
    balance: number;
  };
  entries: {
    open: Transaction[];
    akra: Transaction[];
    ring: Transaction[];
    packet: Transaction[];
  };
  topupHistory: Array<{
    id: string;
    amount: number;
    created_at: string;
  }>;
  dateRange?: {
    start: string;
    end: string;
  };
}

interface EntrySummary {
  totalEntries: number;
  firstTotal: number;
  secondTotal: number;
  totalPKR: number;
  uniqueNumbers: number;
}

export const generateUserReport = (data: UserReportData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Helper function to check if we need a new page
  const checkNewPage = (requiredSpace: number) => {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header - User Information
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('User Activity Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Date and User Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(`Generated: ${reportDate}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Calculate total deposited from top-up history
  const totalDeposited = data.topupHistory && data.topupHistory.length > 0
    ? data.topupHistory.reduce((sum, topup) => sum + topup.amount, 0)
    : 0;

  // User Information Table
  const userInfoData = [
    ['Full Name', data.user.fullName],
    ['Username', data.user.username],
    ['Email', data.user.email],
    ['Current Balance', `PKR ${data.user.balance.toLocaleString()}`],
    ['Total Balance Deposited', `PKR ${totalDeposited.toLocaleString()}`],
  ];

  if (data.dateRange) {
    userInfoData.push(['Report Period', `${data.dateRange.start} to ${data.dateRange.end}`]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [['User Information', '']],
    body: userInfoData,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 12,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: [243, 244, 246] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Calculate summaries for each entry type
  const calculateSummary = (entries: Transaction[]): EntrySummary => {
    const uniqueNums = new Set(entries.map(e => e.number));
    return {
      totalEntries: entries.length,
      firstTotal: entries.reduce((sum, e) => sum + (e.first || 0), 0),
      secondTotal: entries.reduce((sum, e) => sum + (e.second || 0), 0),
      totalPKR: entries.reduce((sum, e) => sum + ((e.first || 0) + (e.second || 0)), 0),
      uniqueNumbers: uniqueNums.size
    };
  };

  const openSummary = calculateSummary(data.entries.open);
  const akraSummary = calculateSummary(data.entries.akra);
  const ringSummary = calculateSummary(data.entries.ring);
  const packetSummary = calculateSummary(data.entries.packet);

  const totalBalanceSpent = openSummary.totalPKR + akraSummary.totalPKR + 
                             ringSummary.totalPKR + packetSummary.totalPKR;

  // Overall Summary Table
  checkNewPage(30);
  
  const totalEntries = openSummary.totalEntries + akraSummary.totalEntries + 
                      ringSummary.totalEntries + packetSummary.totalEntries;
  
  const summaryData = [
    ['Total Entries', totalEntries.toString()],
    ['Total Balance Spent', `PKR ${totalBalanceSpent.toLocaleString()}`],
    ['Current Balance', `PKR ${data.user.balance.toLocaleString()}`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Overall Summary', '']],
    body: summaryData,
    theme: 'grid',
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 12,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: [243, 244, 246] },
      1: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Function to add entry type table
  const addEntryTable = (title: string, entries: Transaction[], summary: EntrySummary) => {
    checkNewPage(50);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPos);
    yPos += 8;

    if (entries.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('No entries found', margin + 5, yPos);
      yPos += 10;
      return;
    }

    // Summary for this type
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Entries: ${summary.totalEntries} | First: ${summary.firstTotal} | Second: ${summary.secondTotal} | Total: ${summary.totalPKR} | Unique: ${summary.uniqueNumbers}`, margin + 5, yPos);
    yPos += 6;

    // Table
    const tableData = entries.map(entry => [
      new Date(entry.createdAt || '').toLocaleDateString(),
      entry.number,
      entry.first || 0,
      entry.second || 0,
      (entry.first || 0) + (entry.second || 0)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Number', 'First', 'Second', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [66, 135, 245],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 40, fontStyle: 'bold' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        // Update yPos after table
        yPos = (data as any).cursor.y + 10;
      }
    });

    // Get the final Y position after the table
    yPos = (doc as any).lastAutoTable.finalY + 10;
  };

  // Add tables for each entry type
  addEntryTable('Open Entries', data.entries.open, openSummary);
  addEntryTable('Akra Entries', data.entries.akra, akraSummary);
  addEntryTable('Ring Entries', data.entries.ring, ringSummary);
  addEntryTable('Packet Entries', data.entries.packet, packetSummary);

  // Balance Deposit History
  if (data.topupHistory && data.topupHistory.length > 0) {
    checkNewPage(60);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Balance Deposit History', margin, yPos);
    yPos += 6;

    // Add summary
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Deposits: PKR ${totalDeposited.toLocaleString()} | Number of Deposits: ${data.topupHistory.length}`, margin + 5, yPos);
    yPos += 8;

    const topupTableData = data.topupHistory.map((topup, index) => [
      (index + 1).toString(),
      new Date(topup.created_at).toLocaleDateString(),
      new Date(topup.created_at).toLocaleTimeString(),
      `PKR ${topup.amount.toLocaleString()}`,
      (topup as any).admin_user?.username || 'Admin'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Date', 'Time', 'Amount', 'By']],
      body: topupTableData,
      theme: 'striped',
      headStyles: {
        fillColor: [76, 175, 80],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 30 }
      },
      margin: { left: margin, right: margin },
      foot: [[
        { content: 'TOTAL DEPOSITED:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 245, 230] } },
        { content: `PKR ${totalDeposited.toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10, fillColor: [230, 245, 230] } },
        ''
      ]],
      footStyles: {
        fillColor: [230, 245, 230],
        textColor: [0, 100, 0],
        fontStyle: 'bold'
      }
    });
  }

  // Footer on last page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const filename = `${data.user.username}_report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

// Simplified version for quick export
export const generateQuickUserReport = (
  username: string,
  fullName: string,
  entries: Transaction[]
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('User Entry Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(10);
  doc.text(`User: ${fullName} (${username})`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  const tableData = entries.map(entry => [
    entry.entryType.toUpperCase(),
    entry.number,
    entry.first || 0,
    entry.second || 0,
    (entry.first || 0) + (entry.second || 0),
    new Date(entry.createdAt || '').toLocaleDateString()
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Type', 'Number', 'First', 'Second', 'Total', 'Date']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [66, 135, 245],
      textColor: 255,
      fontStyle: 'bold'
    }
  });

  doc.save(`${username}_entries_${new Date().toISOString().split('T')[0]}.pdf`);
};



