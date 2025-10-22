import React from 'react';
import type { Transaction } from '../types';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';

interface EntryHistoryPanelProps {
  transactions: Transaction[];
  activeTab: 'all' | 'open' | 'akra' | 'ring' | 'packet';
  projectEntryTypes: string[];
  onEdit?: (t: Transaction) => void;
  onDelete?: (id: string) => void;
}

const EntryHistoryPanel: React.FC<EntryHistoryPanelProps> = ({
  transactions,
  activeTab,
  projectEntryTypes,
  onEdit,
  onDelete,
}) => {
  // Filter transactions based on active tab
  const filteredTransactions = React.useMemo(() => {
    if (activeTab === 'all') {
      return transactions;
    }
    
    if (activeTab === 'open') {
      // Show only Open entry type
      return transactions.filter(t => t.entryType === 'open');
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

  const allNumbers = getAllPossibleNumbers(); // reserved for future navigation; avoid unused warnings by minor reference
  void allNumbers;

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
                  
                  <div className="flex items-center space-x-2 sm:space-x-4 text-sm">
                    {transaction.first > 0 && (
                      <div className="text-emerald-400 font-semibold">
                        F {transaction.first.toLocaleString()}
                      </div>
                    )}
                    {transaction.second > 0 && (
                      <div className="text-amber-400 font-semibold">
                        S {transaction.second.toLocaleString()}
                      </div>
                    )}
                    {transaction.first <= 0 && transaction.second <= 0 && (
                      <div className="text-red-400 font-semibold">
                        Deduction
                      </div>
                    )}

                    {/* Row actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit?.(transaction)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2m-1 0v14m-7 0h14" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete?.(transaction.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
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
