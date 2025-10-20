import type { EntryType } from '../types';

// Generate unique ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Format date
export const formatDate = (date: string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Format timestamp
export const formatTimestamp = (timestamp: string): string => {
  const d = new Date(timestamp);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Validate number format
export const isValidNumber = (value: string, entryType: EntryType): boolean => {
  switch (entryType) {
    case 'open':
      return /^\d{1}$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 9;
    case 'akra':
      return /^\d{2}$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 99;
    case 'ring':
      return /^\d{3}$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 999;
    case 'packet':
      return /^\d{4}$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 9999;
    default:
      return false;
  }
};

// Format number with leading zeros
export const formatNumber = (value: number, entryType: EntryType): string => {
  let length: number;
  switch (entryType) {
    case 'open':
      length = 1;
      break;
    case 'akra':
      length = 2;
      break;
    case 'ring':
      length = 3;
      break;
    case 'packet':
      length = 4;
      break;
    default:
      length = 2;
  }
  return value.toString().padStart(length, '0');
};

// Calculate percentage
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

// Format currency/amount
export const formatAmount = (amount: number): string => {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

// Format currency (alias for formatAmount)
export const formatCurrency = (amount: number): string => {
  return `PKR ${formatAmount(amount)}`;
};

// Format time only
export const formatTime = (timestamp: string): string => {
  const d = new Date(timestamp);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Truncate text
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

