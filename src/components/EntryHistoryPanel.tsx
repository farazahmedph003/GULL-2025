import React from 'react';
import type { Transaction } from '../types';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';

interface EntryHistoryPanelProps {
  transactions: Transaction[];
  activeTab: 'all' | 'open' | 'akra' | 'ring' | 'packet';
  projectEntryTypes: string[];
}

const EntryHistoryPanel: React.FC<EntryHistoryPanelProps> = ({
  transactions,
  activeTab,
  projectEntryTypes,
}) => {
  // Filter transactions based on active tab
  const filteredTransactions = React.useMemo(() => {
    if (activeTab === 'all') {
      return transactions;
    }
    
    if (activeTab === 'open') {
      // For open, show transactions where both first and second are > 0
      return transactions.filter(t => t.first > 0 && t.second > 0);
    }
    
    if (activeTab === 'akra') {
      return transactions.filter(t => t.entryType === 'akra');
    }
    
    if (activeTab === 'ring') {
      return transactions.filter(t => t.entryType === 'ring');
    }
    
    if (activeTab === 'packet') {
      return transactions.filter(t => t.entryType === 'packet');
    }
    
    return transactions;
  }, [transactions, activeTab]);

  // Sort by creation date (newest first)
  const sortedTransactions = React.useMemo(() => {
    return [...filteredTransactions].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filteredTransactions]);

  // Generate all possible numbers for the active tab
  const getAllPossibleNumbers = (): string[] => {
    if (activeTab === 'open') {
      return Array.from({ length: 10 }, (_, i) => i.toString());
    } else if (activeTab === 'akra') {
      return Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));
    } else if (activeTab === 'ring') {
      return Array.from({ length: 1000 }, (_, i) => i.toString().padStart(3, '0'));
    } else if (activeTab === 'packet') {
      // For packet, only show numbers that have entries to avoid lag (0000-9999 would be 10,000 numbers)
      const summaries = groupTransactionsByNumber(filteredTransactions, 'packet');
      return Array.from(summaries.keys()).sort();
    } else if (activeTab === 'all') {
      // For 'all', show all numbers from all entry types
      const allNumbers = new Set<string>();
      if (projectEntryTypes.includes('open')) {
        Array.from({ length: 10 }, (_, i) => i.toString()).forEach(n => allNumbers.add(n));
      }
      if (projectEntryTypes.includes('akra')) {
        Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0')).forEach(n => allNumbers.add(n));
      }
      if (projectEntryTypes.includes('ring')) {
        Array.from({ length: 1000 }, (_, i) => i.toString().padStart(3, '0')).forEach(n => allNumbers.add(n));
      }
      if (projectEntryTypes.includes('packet')) {
        // For packet in 'all' view, only show numbers that have entries
        const packetSummaries = groupTransactionsByNumber(filteredTransactions.filter(t => t.entryType === 'packet'), 'packet');
        Array.from(packetSummaries.keys()).forEach(n => allNumbers.add(n));
      }
      return Array.from(allNumbers).sort();
    }
    return [];
  };

  const allNumbers = getAllPossibleNumbers();

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-300 mb-2">Entry History</h3>
        <p className="text-sm text-gray-400">
          {sortedTransactions.length} entries • {activeTab === 'all' ? 'All types' : activeTab.toUpperCase()}
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-2 min-h-[400px] max-h-[600px] overflow-y-auto">
        {sortedTransactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-2">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500">No entries found</p>
            <p className="text-gray-600 text-sm mt-1">Add your first entry to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {sortedTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="px-3 py-3 hover:bg-gray-800/60 transition-colors rounded"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-gray-200 font-medium text-lg">
                      {transaction.number}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">
                      {transaction.entryType}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    {transaction.first > 0 && (
                      <div className="text-cyan-300 font-semibold">
                        F {transaction.first.toLocaleString()}
                      </div>
                    )}
                    {transaction.second > 0 && (
                      <div className="text-cyan-300 font-semibold">
                        S {transaction.second.toLocaleString()}
                      </div>
                    )}
                    {transaction.first <= 0 && transaction.second <= 0 && (
                      <div className="text-red-400 font-semibold">
                        Deduction
                      </div>
                    )}
                  </div>
                </div>
                
                {transaction.notes && (
                  <div className="mt-2 text-xs text-gray-500 italic">
                    {transaction.notes}
                  </div>
                )}
                
                <div className="mt-1 text-xs text-gray-600">
                  {new Date(transaction.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EntryHistoryPanel;
