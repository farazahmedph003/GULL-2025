import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../services/database';
import { useNotifications } from '../../contexts/NotificationContext';
import { groupTransactionsByNumber } from '../../utils/transactionHelpers';
import type { EntryType } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

const AdminAdvancedFilterPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<EntryType>('open');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter states
  const [firstNumbers, setFirstNumbers] = useState('');
  const [secondNumbers, setSecondNumbers] = useState('');

  const { showSuccess, showError } = useNotifications();

  // Load entries when type changes
  useEffect(() => {
    loadEntries();
  }, [selectedType]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await db.getAllEntriesByType(selectedType);
      
      // Convert to transaction format
      const transactions = data.map((e: any) => ({
        id: e.id,
        number: e.number,
        entryType: e.entry_type,
        first: e.first_amount,
        second: e.second_amount,
        userId: e.user_id,
        username: e.app_users?.username || 'Unknown',
      }));
      
      setEntries(transactions);
    } catch (error) {
      console.error('Error loading entries:', error);
      showError('Error', 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  // Group transactions
  const summaries = useMemo(
    () => groupTransactionsByNumber(entries, selectedType),
    [entries, selectedType]
  );

  // Advanced search filter for numbers with wildcard and command support
  const matchesSearch = (number: string, query: string): boolean => {
    if (!query) return false;
    
    const trimmedQuery = query.trim().toLowerCase();
    const lowerNumber = number.toLowerCase();
    
    // Command: starts:
    if (trimmedQuery.startsWith('starts:')) {
      const searchPattern = trimmedQuery.replace('starts:', '');
      return lowerNumber.startsWith(searchPattern);
    }
    
    // Command: ends:
    if (trimmedQuery.startsWith('ends:')) {
      const searchPattern = trimmedQuery.replace('ends:', '');
      return lowerNumber.endsWith(searchPattern);
    }
    
    // Command: middle: (only for Ring - 3 digit numbers)
    if (trimmedQuery.startsWith('middle:')) {
      const searchPattern = trimmedQuery.replace('middle:', '');
      if (lowerNumber.length === 3) {
        return lowerNumber.charAt(1) === searchPattern;
      }
      return false;
    }
    
    // Wildcard: starts with (e.g., "1*")
    if (trimmedQuery.endsWith('*') && !trimmedQuery.startsWith('*')) {
      const searchPattern = trimmedQuery.slice(0, -1);
      return lowerNumber.startsWith(searchPattern);
    }
    
    // Wildcard: ends with (e.g., "*3")
    if (trimmedQuery.startsWith('*') && !trimmedQuery.endsWith('*')) {
      const searchPattern = trimmedQuery.slice(1);
      return lowerNumber.endsWith(searchPattern);
    }
    
    // Wildcard: starts and ends (e.g., "1*3")
    if (trimmedQuery.includes('*')) {
      const parts = trimmedQuery.split('*');
      if (parts.length === 2) {
        const startPart = parts[0];
        const endPart = parts[1];
        return lowerNumber.startsWith(startPart) && lowerNumber.endsWith(endPart);
      }
    }
    
    // Simple contains search
    return lowerNumber.includes(trimmedQuery);
  };

  // Filter results for First
  const firstFilteredResults = useMemo(() => {
    if (!firstNumbers.trim()) return [];
    
    const results: Array<{ number: string; amount: number; users: string[] }> = [];
    summaries.forEach((summary, number) => {
      if (summary.firstTotal > 0 && matchesSearch(number, firstNumbers)) {
        // Get users who contributed to this number
        const usersForNumber = entries
          .filter(e => e.number === number && e.first > 0)
          .map(e => e.username);
        
        results.push({
          number,
          amount: summary.firstTotal,
          users: [...new Set(usersForNumber)], // Remove duplicates
        });
      }
    });

    return results.sort((a, b) => a.number.localeCompare(b.number));
  }, [summaries, firstNumbers, entries]);

  // Filter results for Second
  const secondFilteredResults = useMemo(() => {
    if (!secondNumbers.trim()) return [];
    
    const results: Array<{ number: string; amount: number; users: string[] }> = [];
    summaries.forEach((summary, number) => {
      if (summary.secondTotal > 0 && matchesSearch(number, secondNumbers)) {
        // Get users who contributed to this number
        const usersForNumber = entries
          .filter(e => e.number === number && e.second > 0)
          .map(e => e.username);
        
        results.push({
          number,
          amount: summary.secondTotal,
          users: [...new Set(usersForNumber)], // Remove duplicates
        });
      }
    });

    return results.sort((a, b) => a.number.localeCompare(b.number));
  }, [summaries, secondNumbers, entries]);

  const copyFirstResults = () => {
    if (firstFilteredResults.length === 0) {
      showError('Error', 'No results to copy!');
      return;
    }

    const header = `Number\tFirst\tUsers`;
    const rows = firstFilteredResults.map(r => `${r.number}\t${r.amount}\t${r.users.join(', ')}`);
    const data = [header, ...rows].join('\n');

    navigator.clipboard.writeText(data).then(() => {
      showSuccess('Success', `Copied ${firstFilteredResults.length} First entries to clipboard!`);
    });
  };

  const copySecondResults = () => {
    if (secondFilteredResults.length === 0) {
      showError('Error', 'No results to copy!');
      return;
    }

    const header = `Number\tSecond\tUsers`;
    const rows = secondFilteredResults.map(r => `${r.number}\t${r.amount}\t${r.users.join(', ')}`);
    const data = [header, ...rows].join('\n');

    navigator.clipboard.writeText(data).then(() => {
      showSuccess('Success', `Copied ${secondFilteredResults.length} Second entries to clipboard!`);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🔍 Advanced Filter & Search
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Search and filter numbers with wildcards across all users
          </p>
        </div>

        {/* Entry Type Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Select Data Source</h2>
          <div className="flex flex-wrap gap-3">
            {(['open', 'akra', 'ring', 'packet'] as EntryType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  selectedType === type
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner text={`Loading ${selectedType} entries...`} />
          </div>
        ) : (
          <>
            {/* Two-Panel Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* FIRST Panel */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    FIRST (Result)
                  </div>
                  {firstFilteredResults.length > 0 && (
                    <button
                      onClick={copyFirstResults}
                      className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                      Copy ({firstFilteredResults.length})
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={firstNumbers}
                  onChange={(e) => setFirstNumbers(e.target.value)}
                  placeholder="e.g., 5, 1*, *3, starts:8, ends:0"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 mb-4"
                />

                {/* First Results */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 min-h-[300px] max-h-[500px] overflow-y-auto">
                  {firstFilteredResults.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No matching numbers found.</p>
                  ) : (
                    <div className="space-y-2">
                      {firstFilteredResults.map((result) => (
                        <div
                          key={result.number}
                          className="bg-white dark:bg-gray-800 p-3 rounded-lg"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-gray-900 dark:text-white">{result.number}</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              F {result.amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {result.users.map((username, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full"
                              >
                                {username}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SECOND Panel */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    SECOND (Result)
                  </div>
                  {secondFilteredResults.length > 0 && (
                    <button
                      onClick={copySecondResults}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      Copy ({secondFilteredResults.length})
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={secondNumbers}
                  onChange={(e) => setSecondNumbers(e.target.value)}
                  placeholder="e.g., 5, 1*, *3, starts:8, ends:0"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 mb-4"
                />

                {/* Second Results */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 min-h-[300px] max-h-[500px] overflow-y-auto">
                  {secondFilteredResults.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No matching numbers found.</p>
                  ) : (
                    <div className="space-y-2">
                      {secondFilteredResults.map((result) => (
                        <div
                          key={result.number}
                          className="bg-white dark:bg-gray-800 p-3 rounded-lg"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-gray-900 dark:text-white">{result.number}</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              S {result.amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {result.users.map((username, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded-full"
                              >
                                {username}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Help Section */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How to Use Advanced Search
              </h3>
              <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                <div>
                  <p className="font-semibold mb-2">Search Patterns:</p>
                  <ul className="space-y-1 ml-4">
                    <li><strong>Contains:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">5</code> to find any number containing "5"</li>
                    <li><strong>Starts with:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">1*</code> to find numbers starting with "1"</li>
                    <li><strong>Ends with:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">*3</code> to find numbers ending with "3"</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-2">Commands:</p>
                  <ul className="space-y-1 ml-4">
                    <li><strong>starts:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">starts:8</code> to find numbers starting with "8"</li>
                    <li><strong>ends:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">ends:0</code> to find numbers ending with "0"</li>
                    <li><strong>middle:</strong> (Ring only) Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">middle:4</code> to find 3-digit numbers with "4" in the middle</li>
                  </ul>
                </div>
                <p className="mt-3 p-2 bg-blue-100 dark:bg-blue-900/40 rounded">
                  <strong>Multi-User View:</strong> Results show which users contributed to each number with color-coded badges
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAdvancedFilterPage;



