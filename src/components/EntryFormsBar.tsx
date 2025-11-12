import React, { useState } from 'react';
import StandardEntry from './StandardEntry';
import IntelligentEntry from './IntelligentEntry';
import type { Transaction, AddedEntrySummary } from '../types';

interface EntryFormsBarProps {
  projectId: string;
  entryType?: 'akra' | 'ring' | 'open' | 'packet';
  onEntryAdded?: (summary?: AddedEntrySummary[]) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>, skipBalanceDeduction?: boolean) => Promise<Transaction | null>;
  transactions: Transaction[];
}

const EntryFormsBar: React.FC<EntryFormsBarProps> = ({
  projectId,
  entryType = 'akra',
  onEntryAdded,
  addTransaction,
  transactions,
}) => {
  const [activeTab, setActiveTab] = useState<'standard' | 'intelligent'>('standard');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-700/50 shadow-2xl z-50 safe-area-inset-bottom">
      {/* Tab Selector */}
      <div className="flex items-center justify-center px-4 py-2 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('standard')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === 'standard'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Standard Entry
          </button>
          <button
            onClick={() => setActiveTab('intelligent')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === 'intelligent'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Intelligent Entry
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
        {activeTab === 'standard' ? (
          <StandardEntry
            projectId={projectId}
            addTransaction={addTransaction}
            transactions={transactions}
            onSuccess={(added) => {
              onEntryAdded?.(added);
            }}
          />
        ) : (
          <IntelligentEntry
            projectId={projectId}
            entryType={entryType}
            addTransaction={addTransaction}
            transactions={transactions}
            onSuccess={(added) => {
              onEntryAdded?.(added);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default EntryFormsBar;
