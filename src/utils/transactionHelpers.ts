import type { Transaction, NumberSummary, EntryType } from '../types';

// Group transactions by number
export const groupTransactionsByNumber = (
  transactions: Transaction[],
  entryType: EntryType
): Map<string, NumberSummary> => {
  const grouped = new Map<string, NumberSummary>();

  // Filter by entry type
  const filtered = transactions.filter(t => t.entryType === entryType);

  // Group by number
  filtered.forEach(transaction => {
    const existing = grouped.get(transaction.number);
    
    if (existing) {
      existing.firstTotal += transaction.first;
      existing.secondTotal += transaction.second;
      existing.entryCount += 1;
      existing.transactions.push(transaction);
    } else {
      grouped.set(transaction.number, {
        number: transaction.number,
        firstTotal: transaction.first,
        secondTotal: transaction.second,
        entryCount: 1,
        transactions: [transaction],
      });
    }
  });

  return grouped;
};

// Get all possible numbers for entry type
export const getAllPossibleNumbers = (entryType: EntryType): string[] => {
  const numbers: string[] = [];
  let max: number;
  let length: number;

  switch (entryType) {
    case 'open':
      max = 10;
      length = 1;
      break;
    case 'akra':
      max = 100;
      length = 2;
      break;
    case 'ring':
      max = 1000;
      length = 3;
      break;
    case 'packet':
      max = 10000;
      length = 4;
      break;
    default:
      return [];
  }

  for (let i = 0; i < max; i++) {
    numbers.push(i.toString().padStart(length, '0'));
  }

  return numbers;
};

// Get summary for a specific number
export const getNumberSummary = (
  transactions: Transaction[],
  number: string,
  entryType: EntryType
): NumberSummary => {
  const filtered = transactions.filter(
    t => t.number === number && t.entryType === entryType
  );

  const firstTotal = filtered.reduce((sum, t) => sum + t.first, 0);
  const secondTotal = filtered.reduce((sum, t) => sum + t.second, 0);

  return {
    number,
    firstTotal,
    secondTotal,
    entryCount: filtered.length,
    transactions: filtered,
  };
};

// Find highest and lowest numbers by total
export const getHighestLowestNumbers = (
  summaries: Map<string, NumberSummary>
): { highest: string | null; lowest: string | null } => {
  if (summaries.size === 0) {
    return { highest: null, lowest: null };
  }

  let highest: string | null = null;
  let lowest: string | null = null;
  let highestTotal = -Infinity;
  let lowestTotal = Infinity;

  summaries.forEach((summary) => {
    const total = summary.firstTotal + summary.secondTotal;
    
    if (total > 0) {
      if (total > highestTotal) {
        highestTotal = total;
        highest = summary.number;
      }
      
      if (total < lowestTotal) {
        lowestTotal = total;
        lowest = summary.number;
      }
    }
  });

  return { highest, lowest };
};

// Calculate totals for filtered numbers
export const calculateFilteredTotals = (
  summaries: NumberSummary[]
): { firstTotal: number; secondTotal: number } => {
  const firstTotal = summaries.reduce((sum, s) => sum + s.firstTotal, 0);
  const secondTotal = summaries.reduce((sum, s) => sum + s.secondTotal, 0);
  
  return { firstTotal, secondTotal };
};

// Sort transactions by various criteria
export const sortTransactions = (
  transactions: Transaction[],
  sortBy: 'date' | 'number' | 'first' | 'second',
  order: 'asc' | 'desc' = 'desc'
): Transaction[] => {
  const sorted = [...transactions];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'number':
        comparison = a.number.localeCompare(b.number);
        break;
      case 'first':
        comparison = a.first - b.first;
        break;
      case 'second':
        comparison = a.second - b.second;
        break;
    }
    
    return order === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
};

