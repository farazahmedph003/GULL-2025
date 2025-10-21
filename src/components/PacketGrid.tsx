import React, { useMemo } from 'react';
import type { NumberSummary } from '../types';
import { getAllPossibleNumbers, getHighestLowestNumbers } from '../utils/transactionHelpers';

interface PacketGridProps {
  summaries: Map<string, NumberSummary>;
  onNumberClick?: (number: string) => void;
  searchQuery?: string;
  selectedNumbers?: Set<string>;
  onSelectionChange?: (numbers: Set<string>) => void;
  selectionMode?: boolean;
}

const PacketNumberBox: React.FC<{
  summary: NumberSummary;
  isHighest?: boolean;
  isLowest?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}> = ({ summary, isHighest = false, isLowest = false, onClick, isSelected = false }) => {
  const total = summary.firstTotal + summary.secondTotal;
  const hasEntries = summary.entryCount > 0;

  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-lg p-3 transition-all duration-200
        hover:shadow-md hover:scale-105 active:scale-95
        text-left w-full min-h-[160px] max-w-none
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected ? 'ring-2 ring-secondary ring-offset-2' : ''}
        bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
      `}
      disabled={!onClick}
    >
      {/* Number */}
      <div className="mb-4">
        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {summary.number}
        </span>
      </div>

      {/* Financial Details - Show actual values since we only display numbers with entries */}
      <div className="space-y-2 text-left">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700 dark:text-gray-300">F:</span>
          <span className="font-bold text-green-600 dark:text-green-400">
            PKR {summary.firstTotal.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700 dark:text-gray-300">S:</span>
          <span className="font-bold text-pink-600 dark:text-pink-400">
            PKR {summary.secondTotal.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Total:</span>
          <span className="font-bold text-white dark:text-gray-100">
            PKR {total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Entry Counts */}
      <div className="mt-4 space-y-1 text-left">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">F Entries:</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {summary.transactions.filter(t => t.first !== 0).length.toString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">S Entries:</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {summary.transactions.filter(t => t.second !== 0).length.toString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">Total Entries:</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {summary.entryCount.toString()}
          </span>
        </div>
      </div>

      {/* Special indicators */}
      {isHighest && hasEntries && (
        <div className="absolute top-1 right-1">
          <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded">
            HIGH
          </span>
        </div>
      )}
      {isLowest && hasEntries && (
        <div className="absolute top-1 left-1">
          <span className="text-xs bg-gray-400 text-white px-1.5 py-0.5 rounded">
            LOW
          </span>
        </div>
      )}
    </button>
  );
};

const PacketGrid: React.FC<PacketGridProps> = ({
  summaries,
  onNumberClick,
  searchQuery = '',
  selectedNumbers = new Set(),
  onSelectionChange,
  selectionMode = false,
}) => {
  const allNumbers = useMemo(() => getAllPossibleNumbers('packet'), []);
  const { highest, lowest } = useMemo(() => getHighestLowestNumbers(summaries), [summaries]);

  // Filter numbers to only show those with actual entries, then apply search query
  const filteredNumbers = useMemo(() => {
    // First, get only numbers that have entries (entryCount > 0)
    const numbersWithEntries = allNumbers.filter(num => {
      const summary = summaries.get(num);
      return summary && summary.entryCount > 0;
    });
    
    // If no search query, return all numbers with entries
    if (!searchQuery.trim()) return numbersWithEntries;
    
    // If there's a search query, filter numbers with entries
    const query = searchQuery.toLowerCase().trim();
    return numbersWithEntries.filter(num => {
      // Direct match
      if (num.includes(query)) return true;
      
      // Wildcard pattern matching
      if (query.includes('*')) {
        const regex = new RegExp('^' + query.replace(/\*/g, '.*') + '$');
        return regex.test(num);
      }
      
      return false;
    });
  }, [allNumbers, searchQuery, summaries]);

  // Get summary - since we only show numbers with entries, this should always exist
  const getSummary = (number: string): NumberSummary => {
    const summary = summaries.get(number);
    if (!summary) {
      // This shouldn't happen since we filter for numbers with entries, but fallback just in case
      return {
        number,
        firstTotal: 0,
        secondTotal: 0,
        entryCount: 0,
        transactions: [],
      };
    }
    return summary;
  };

  const handleNumberClick = (number: string) => {
    if (selectionMode) {
      const newSelection = new Set(selectedNumbers);
      if (newSelection.has(number)) {
        newSelection.delete(number);
      } else {
        newSelection.add(number);
      }
      onSelectionChange?.(newSelection);
    } else {
      onNumberClick?.(number);
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Packet Grid - Full Width with 5 columns */}
      <div className="grid grid-cols-5 gap-3 w-full">
        {filteredNumbers.map(number => {
          const summary = getSummary(number);
          return (
            <PacketNumberBox
              key={number}
              summary={summary}
              isHighest={number === highest}
              isLowest={number === lowest}
              onClick={() => handleNumberClick(number)}
              isSelected={selectedNumbers.has(number)}
            />
          );
        })}
      </div>

      {/* Empty State */}
      {filteredNumbers.length === 0 && (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {searchQuery.trim() ? 'No entries found matching your search' : 'No packet entries yet'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery.trim() 
              ? 'Try adjusting your search query or add entries to see packet numbers here'
              : 'Add your first packet entry to see numbers displayed here'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default PacketGrid;
