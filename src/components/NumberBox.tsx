import React from 'react';
import type { NumberSummary } from '../types';

interface NumberBoxProps {
  summary: NumberSummary;
  isHighest?: boolean;
  isLowest?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

const NumberBox: React.FC<NumberBoxProps> = ({
  summary,
  isHighest = false,
  isLowest = false,
  onClick,
  isSelected = false,
}) => {
  const total = summary.firstTotal + summary.secondTotal;
  const hasFirst = summary.firstTotal > 0;
  const hasSecond = summary.secondTotal > 0;
  const hasEntries = summary.entryCount > 0;

  // Calculate F and S entry counts from transactions
  const fEntries = summary.transactions.filter(t => t.first !== 0).length;
  const sEntries = summary.transactions.filter(t => t.second !== 0).length;
  const totalEntries = summary.transactions.length;

  // Red border and background for zero entries (matching image)
  const isZero = !hasEntries;

  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-lg p-3 transition-all duration-200
        hover:shadow-md hover:scale-105 active:scale-95
        text-left w-full min-h-[160px] max-w-none
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected ? 'ring-2 ring-secondary ring-offset-2' : ''}
        ${isZero 
          ? 'bg-red-100 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-600' 
          : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
        }
      `}
      disabled={!onClick}
    >
      {/* Number */}
      <div className="mb-4">
        <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
          {summary.number}
        </span>
      </div>

      {/* Financial Details */}
      <div className="space-y-2 text-left">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700 dark:text-gray-300">F:</span>
          <span className="font-bold text-green-600 dark:text-green-400">
            {isZero ? 'PKR 0' : `PKR ${summary.firstTotal.toLocaleString()}`}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700 dark:text-gray-300">S:</span>
          <span className="font-bold text-pink-600 dark:text-pink-400">
            {isZero ? 'PKR 0' : `PKR ${summary.secondTotal.toLocaleString()}`}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Total:</span>
          <span className="font-bold text-white dark:text-gray-100">
            {isZero ? 'PKR 0' : `PKR ${total.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* Entry Counts */}
      <div className="mt-4 space-y-1 text-left">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">F Entries:</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isZero ? '0' : fEntries.toString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">S Entries:</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isZero ? '0' : sEntries.toString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">Total Entries:</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isZero ? '0' : totalEntries.toString()}
          </span>
        </div>
      </div>
    </button>
  );
};

export default NumberBox;

