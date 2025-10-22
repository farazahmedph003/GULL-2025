import React, { useState, useMemo } from 'react';
import type { Transaction } from '../types';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';

interface AggregatedNumbersPanelProps {
  transactions: Transaction[];
  activeTab: 'all' | 'open' | 'akra' | 'ring' | 'packet';
  projectEntryTypes: string[];
  onExportJSON?: () => void;
  onExportCSV?: () => void;
  onImport?: () => void;
}

const AggregatedNumbersPanel: React.FC<AggregatedNumbersPanelProps> = ({
  transactions,
  activeTab,
  projectEntryTypes,
  onExportJSON,
  onExportCSV,
  onImport,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);

  // Filter transactions based on active tab
  const filteredTransactions = useMemo(() => {
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

  // Group transactions by number and calculate totals
  const aggregatedNumbers = useMemo(() => {
    // For specific tabs, group by their entry type
    if (activeTab === 'open' || activeTab === 'akra' || activeTab === 'ring' || activeTab === 'packet') {
      const summaries = groupTransactionsByNumber(filteredTransactions, activeTab);
      return allNumbers.map(number => {
        const summary = summaries.get(number);
        return {
          number,
          firstTotal: summary?.firstTotal || 0,
          secondTotal: summary?.secondTotal || 0,
          entryCount: summary?.entryCount || 0,
        };
      });
    }

    // For 'all', aggregate across all entry types
    const map = new Map<string, { firstTotal: number; secondTotal: number; entryCount: number }>();
    filteredTransactions.forEach(t => {
      const key = t.number;
      const prev = map.get(key) || { firstTotal: 0, secondTotal: 0, entryCount: 0 };
      map.set(key, {
        firstTotal: prev.firstTotal + t.first,
        secondTotal: prev.secondTotal + t.second,
        entryCount: prev.entryCount + 1,
      });
    });

    return allNumbers.map(number => {
      const summary = map.get(number);
      return {
        number,
        firstTotal: summary?.firstTotal || 0,
        secondTotal: summary?.secondTotal || 0,
        entryCount: summary?.entryCount || 0,
      };
    });
  }, [filteredTransactions, activeTab, allNumbers]);

  // Get transactions for selected number
  const selectedNumberTransactions = useMemo(() => {
    if (!selectedNumber) return [];
    return filteredTransactions.filter(t => t.number === selectedNumber);
  }, [filteredTransactions, selectedNumber]);

  const copyResults = () => {
    if (aggregatedNumbers.length === 0) {
      alert('No results to copy!');
      return;
    }

    const header = activeTab === 'akra' ? 'Akra\tFirst\tSecond' : 
                   activeTab === 'ring' ? 'Ring\tFirst\tSecond' :
                   `${activeTab.toUpperCase()}\tFirst\tSecond`;
    
    const rows = aggregatedNumbers.map(item => 
      `${item.number}\t${item.firstTotal}\t${item.secondTotal}`
    );
    
    const data = [header, ...rows].join('\n');

    navigator.clipboard.writeText(data).then(() => {
      alert(`✓ Copied ${aggregatedNumbers.length} aggregated numbers to clipboard!`);
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  if (!isVisible) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-300">Aggregated Numbers</h3>
          <button
            onClick={() => setIsVisible(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Show Panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-300">Aggregated Numbers</h3>
          <div className="flex items-center gap-2">
            {onImport && (
              <button
                onClick={onImport}
                className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 rounded-lg"
                title="Import"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
            )}
            {onExportJSON && (
              <button
                onClick={onExportJSON}
                className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-200 rounded-lg"
                title="Export JSON"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}
            {onExportCSV && (
              <button
                onClick={onExportCSV}
                className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 rounded-lg"
                title="Export CSV"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            )}
            {aggregatedNumbers.length > 0 && (
              <button
                onClick={copyResults}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Copy Results"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setIsVisible(false)}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Hide Panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-400">
          {aggregatedNumbers.length} numbers • {activeTab === 'all' ? 'All types' : activeTab.toUpperCase()}
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-2 min-h-[400px] max-h-[600px] overflow-y-auto">
        <div className="divide-y divide-gray-800">
          {aggregatedNumbers.map((item) => (
            <div
              key={item.number}
              className="px-3 py-3 hover:bg-gray-800/60 transition-colors rounded cursor-pointer"
              onClick={() => setSelectedNumber(selectedNumber === item.number ? null : item.number)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
                <div className="text-gray-200 font-medium text-lg">
                  {item.number}
                </div>
                
                <div className="text-right">
                  {item.firstTotal > 0 ? (
                    <div className="text-cyan-300 font-semibold">
                      F {item.firstTotal.toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-gray-600">F 0</div>
                  )}
                </div>
                
                <div className="text-right">
                  {item.secondTotal > 0 ? (
                    <div className="text-cyan-300 font-semibold">
                      S {item.secondTotal.toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-gray-600">S 0</div>
                  )}
                </div>
              </div>
              
              <div className="mt-1 text-xs text-gray-600">
                {item.entryCount} entries
              </div>
              
              {/* Expanded details for selected number */}
              {selectedNumber === item.number && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-500 mb-2">Entry History:</div>
                  <div className="space-y-1">
                    {selectedNumberTransactions.length === 0 ? (
                      <div className="text-xs text-gray-500 italic">No entries yet</div>
                    ) : (
                      selectedNumberTransactions.map((transaction) => (
                        <div key={transaction.id} className="flex justify-between text-xs">
                          <span className="text-gray-400">
                            {transaction.first > 0 && `F ${transaction.first}`}
                            {transaction.first > 0 && transaction.second > 0 && ' + '}
                            {transaction.second > 0 && `S ${transaction.second}`}
                            {transaction.first <= 0 && transaction.second <= 0 && 'Deduction'}
                          </span>
                          <span className="text-gray-600">
                            {new Date(transaction.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AggregatedNumbersPanel;
