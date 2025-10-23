import type { Transaction, Project, ExportData } from '../types';

/**
 * Export transactions to JSON file
 */
export const exportToJSON = (
  projectInfo: Project,
  transactions: Transaction[],
  filename?: string
): void => {
  const exportData: ExportData = {
    projectInfo,
    transactions,
    exportDate: new Date().toISOString(),
    version: '1.0.0',
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${projectInfo.name}-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export transactions to CSV file
 */
export const exportToCSV = (
  projectInfo: Project,
  transactions: Transaction[],
  filename?: string
): void => {
  // CSV headers
  const headers = ['Number', 'Entry Type', 'First Amount', 'Second Amount', 'Notes', 'Created At'];
  
  // Convert transactions to CSV rows
  const rows = transactions.map(t => [
    t.number,
    t.entryType,
    t.first.toString(),
    t.second.toString(),
    t.notes || '',
    new Date(t.createdAt).toLocaleString(),
  ]);
  
  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${projectInfo.name}-export-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Import transactions from JSON file
 */
export const importFromJSON = (
  file: File
): Promise<ExportData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data: ExportData = JSON.parse(content);
        
        // Validate the imported data
        if (!data.projectInfo || !data.transactions || !Array.isArray(data.transactions)) {
          throw new Error('Invalid export file format');
        }
        
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * Import transactions from CSV file
 */
export const importFromCSV = (
  file: File,
  projectId: string
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim());
        
        // Skip header row
        const dataLines = lines.slice(1);
        
        const transactions: Transaction[] = dataLines.map((line, index) => {
          // Parse CSV line (handle quoted values)
          const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
          if (!matches || matches.length < 5) {
            throw new Error(`Invalid CSV format at line ${index + 2}`);
          }
          
          const [number, entryType, first, second, notes] = matches.map(
            m => m.replace(/^"(.*)"$/, '$1').trim()
          );
          
          return {
            id: `imported-${Date.now()}-${index}`,
            projectId,
            number,
            entryType: entryType as 'open' | 'akra' | 'ring' | 'packet',
            first: parseFloat(first) || 0,
            second: parseFloat(second) || 0,
            notes: notes || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });
        
        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
};



