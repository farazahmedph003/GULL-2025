import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../services/database';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { groupTransactionsByNumber } from '../../utils/transactionHelpers';
import type { EntryType } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

const AdminAdvancedFilterPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<EntryType>('open');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false); // Prevent double actions
  
  // Filter states
  const [firstNumbers, setFirstNumbers] = useState('');
  const [secondNumbers, setSecondNumbers] = useState('');

  // Undo/Redo history
  const [history, setHistory] = useState<Array<{entries: any[], timestamp: number}>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const { showSuccess, showError } = useNotifications();
  const { user } = useAuth();

  // Load entries when type changes
  useEffect(() => {
    loadEntries();
  }, [selectedType]);

  const loadEntries = async (saveHistory = false) => {
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
      
      // Save to history after loading if requested
      if (saveHistory) {
        setTimeout(() => {
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push({
            entries: JSON.parse(JSON.stringify(transactions)),
            timestamp: Date.now(),
          });
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
        }, 100);
      }
    } catch (error) {
      console.error('Error loading entries:', error);
      showError('Error', 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  // Save current state to history
  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      entries: JSON.parse(JSON.stringify(entries)),
      timestamp: Date.now(),
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo action
  const handleUndo = async () => {
    if (historyIndex > 0) {
      setProcessing(true);
      try {
        const previousState = history[historyIndex - 1].entries;
        
        // Restore each entry to the database
        for (const entry of previousState) {
          await db.updateTransaction(entry.id, {
            number: entry.number,
            entryType: entry.entryType,
            first: entry.first,
            second: entry.second,
          });
        }
        
        setHistoryIndex(historyIndex - 1);
        setEntries(JSON.parse(JSON.stringify(previousState)));
        showSuccess('Undo', 'Reverted to previous state');
      } catch (error) {
        console.error('Undo error:', error);
        showError('Error', 'Failed to undo changes');
      } finally {
        setProcessing(false);
      }
    } else {
      showError('Undo', 'No more actions to undo');
    }
  };

  // Redo action
  const handleRedo = async () => {
    if (historyIndex < history.length - 1) {
      setProcessing(true);
      try {
        const nextState = history[historyIndex + 1].entries;
        
        // Restore each entry to the database
        for (const entry of nextState) {
          await db.updateTransaction(entry.id, {
            number: entry.number,
            entryType: entry.entryType,
            first: entry.first,
            second: entry.second,
          });
        }
        
        setHistoryIndex(historyIndex + 1);
        setEntries(JSON.parse(JSON.stringify(nextState)));
        showSuccess('Redo', 'Restored to next state');
      } catch (error) {
        console.error('Redo error:', error);
        showError('Error', 'Failed to redo changes');
      } finally {
        setProcessing(false);
      }
    } else {
      showError('Redo', 'No more actions to redo');
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
    
    // Multiple asterisk patterns (e.g., "1**", "*2*", "**1", "1***", "*2**", "**2*", "***1")
    if (trimmedQuery.includes('*')) {
      // Count asterisks and extract digits
      const parts = trimmedQuery.split('');
      const asteriskCount = parts.filter(c => c === '*').length;
      const digits = parts.filter(c => c !== '*');
      
      // Pattern: 1** (first digit)
      if (trimmedQuery.match(/^[^*]\*+$/)) {
        const digit = trimmedQuery[0];
        return lowerNumber[0] === digit;
      }
      
      // Pattern: **1 (last digit)
      if (trimmedQuery.match(/^\*+[^*]$/)) {
        const digit = trimmedQuery[trimmedQuery.length - 1];
        return lowerNumber[lowerNumber.length - 1] === digit;
      }
      
      // Pattern: *2* (middle/second digit)
      if (trimmedQuery.match(/^\*[^*]\*$/)) {
        const digit = trimmedQuery[1];
        return lowerNumber.length >= 2 && lowerNumber[1] === digit;
      }
      
      // Pattern: 1*** (first digit with multiple asterisks)
      if (trimmedQuery.match(/^[^*]\*{2,}$/)) {
        const digit = trimmedQuery[0];
        return lowerNumber[0] === digit;
      }
      
      // Pattern: *2** (second digit)
      if (trimmedQuery.match(/^\*[^*]\*{2,}$/)) {
        const digit = trimmedQuery[1];
        return lowerNumber.length >= 2 && lowerNumber[1] === digit;
      }
      
      // Pattern: **2* (third digit)
      if (trimmedQuery.match(/^\*{2}[^*]\*$/)) {
        const digit = trimmedQuery[2];
        return lowerNumber.length >= 3 && lowerNumber[2] === digit;
      }
      
      // Pattern: ***1 (last digit with multiple asterisks)
      if (trimmedQuery.match(/^\*{2,}[^*]$/)) {
        const digit = trimmedQuery[trimmedQuery.length - 1];
        return lowerNumber[lowerNumber.length - 1] === digit;
      }
      
      // Legacy patterns for backward compatibility
      // Wildcard: starts with (e.g., "1*")
      if (trimmedQuery.endsWith('*') && !trimmedQuery.startsWith('*') && trimmedQuery.indexOf('*') === trimmedQuery.length - 1) {
        const searchPattern = trimmedQuery.slice(0, -1);
        return lowerNumber.startsWith(searchPattern);
      }
      
      // Wildcard: ends with (e.g., "*3")
      if (trimmedQuery.startsWith('*') && !trimmedQuery.endsWith('*') && trimmedQuery.lastIndexOf('*') === 0) {
        const searchPattern = trimmedQuery.slice(1);
        return lowerNumber.endsWith(searchPattern);
      }
      
      // Wildcard: starts and ends (e.g., "1*3")
      const asteriskIndex = trimmedQuery.indexOf('*');
      if (asteriskIndex > 0 && asteriskIndex < trimmedQuery.length - 1 && trimmedQuery.split('*').length === 2) {
        const startPart = trimmedQuery.substring(0, asteriskIndex);
        const endPart = trimmedQuery.substring(asteriskIndex + 1);
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

    const entryTypeUpper = selectedType.toUpperCase();
    const header = `${entryTypeUpper}\tFirst`;
    const rows = firstFilteredResults.map(r => `${r.number}\tF ${r.amount}`);
    const data = `${header}\n${rows.join('\n')}`;

    navigator.clipboard.writeText(data).then(() => {
      showSuccess('Success', `Copied ${firstFilteredResults.length} First entries to clipboard!`);
    });
  };

  const copySecondResults = () => {
    if (secondFilteredResults.length === 0) {
      showError('Error', 'No results to copy!');
      return;
    }

    const entryTypeUpper = selectedType.toUpperCase();
    const header = `${entryTypeUpper}\tSecond`;
    const rows = secondFilteredResults.map(r => `${r.number}\tS ${r.amount}`);
    const data = `${header}\n${rows.join('\n')}`;

    navigator.clipboard.writeText(data).then(() => {
      showSuccess('Success', `Copied ${secondFilteredResults.length} Second entries to clipboard!`);
    });
  };

  const handleDeductFirst = async () => {
    if (processing) {
      showError('Processing', 'An action is already in progress. Please wait.');
      return;
    }

    if (firstFilteredResults.length === 0) {
      showError('Error', 'No results to deduct!');
      return;
    }

    if (!confirm(`Are you sure you want to deduct FIRST amounts from ${firstFilteredResults.length} numbers?`)) {
      return;
    }

    // Save current state to history before making changes
    saveToHistory();
    setProcessing(true);

    try {
      console.log('🔄 Starting FIRST deduction...');
      const processedEntries = new Set<string>();
      
      for (const result of firstFilteredResults) {
        const entriesForNumber = entries.filter(e => e.number === result.number);
        console.log(`📌 Processing number ${result.number}: ${entriesForNumber.length} entries found`);
        
        // Group entries by user
        const entriesByUser = new Map<string, typeof entries>();
        entriesForNumber.forEach(entry => {
          const userId = entry.userId || 'unknown';
          if (!entriesByUser.has(userId)) {
            entriesByUser.set(userId, []);
          }
          entriesByUser.get(userId)!.push(entry);
        });
        
        let remainingToDeduct = result.amount;
        
        for (const [, userEntries] of entriesByUser) {
          const userFirstTotal = userEntries.reduce((sum, e) => sum + (e.first || 0), 0);
          const totalFirst = entriesForNumber.reduce((sum, e) => sum + (e.first || 0), 0);
          const userShare = totalFirst > 0 ? (userFirstTotal / totalFirst) * result.amount : 0;
          let userRemaining = Math.min(userShare, remainingToDeduct, userFirstTotal);
          
          for (const entry of userEntries) {
            const entryKey = `${entry.id}-${entry.number}`;
            if (processedEntries.has(entryKey) || userRemaining <= 0) continue;
            
            const currentFirst = entry.first || 0;
            if (currentFirst > 0) {
              const deductAmount = Math.min(currentFirst, userRemaining);
              const newFirst = currentFirst - deductAmount;
              userRemaining -= deductAmount;
              remainingToDeduct -= deductAmount;
              
              await db.updateTransaction(entry.id, {
                number: entry.number,
                entryType: entry.entryType,
                first: newFirst,
                second: entry.second,
              });
              
              processedEntries.add(entryKey);
            }
          }
        }
      }
      
      // Log admin action for each affected user
      if (user?.id) {
        const affectedUsers = new Set<string>();
        for (const result of firstFilteredResults) {
          const entriesForNumber = entries.filter(e => e.number === result.number);
          entriesForNumber.forEach(entry => {
            if (entry.userId) affectedUsers.add(entry.userId);
          });
        }

        for (const targetUserId of affectedUsers) {
          await db.logAdminAction(
            user.id,
            targetUserId,
            'deduct_first',
            `Advanced Filter: Deducted FIRST amounts from ${firstFilteredResults.length} numbers (${selectedType})`,
            {
              entryType: selectedType,
              numbersCount: firstFilteredResults.length,
              entriesUpdated: processedEntries.size,
              searchQuery: firstNumbers,
            }
          );
        }
      }

      showSuccess('Success', `Deducted FIRST amounts! Updated ${processedEntries.size} entries.`);
      await loadEntries(true); // Save to history after reload
      setFirstNumbers('');
    } catch (error) {
      console.error('❌ Deduct FIRST error:', error);
      showError('Error', 'Failed to deduct FIRST amounts');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeductSecond = async () => {
    if (processing) {
      showError('Processing', 'An action is already in progress. Please wait.');
      return;
    }

    if (secondFilteredResults.length === 0) {
      showError('Error', 'No results to deduct!');
      return;
    }

    if (!confirm(`Are you sure you want to deduct SECOND amounts from ${secondFilteredResults.length} numbers?`)) {
      return;
    }

    // Save current state to history before making changes
    saveToHistory();
    setProcessing(true);

    try {
      console.log('🔄 Starting SECOND deduction...');
      const processedEntries = new Set<string>();
      
      for (const result of secondFilteredResults) {
        const entriesForNumber = entries.filter(e => e.number === result.number);
        console.log(`📌 Processing number ${result.number}: ${entriesForNumber.length} entries found`);
        
        // Group entries by user
        const entriesByUser = new Map<string, typeof entries>();
        entriesForNumber.forEach(entry => {
          const userId = entry.userId || 'unknown';
          if (!entriesByUser.has(userId)) {
            entriesByUser.set(userId, []);
          }
          entriesByUser.get(userId)!.push(entry);
        });
        
        let remainingToDeduct = result.amount;
        
        for (const [, userEntries] of entriesByUser) {
          const userSecondTotal = userEntries.reduce((sum, e) => sum + (e.second || 0), 0);
          const totalSecond = entriesForNumber.reduce((sum, e) => sum + (e.second || 0), 0);
          const userShare = totalSecond > 0 ? (userSecondTotal / totalSecond) * result.amount : 0;
          let userRemaining = Math.min(userShare, remainingToDeduct, userSecondTotal);
          
          for (const entry of userEntries) {
            const entryKey = `${entry.id}-${entry.number}`;
            if (processedEntries.has(entryKey) || userRemaining <= 0) continue;
            
            const currentSecond = entry.second || 0;
            if (currentSecond > 0) {
              const deductAmount = Math.min(currentSecond, userRemaining);
              const newSecond = currentSecond - deductAmount;
              userRemaining -= deductAmount;
              remainingToDeduct -= deductAmount;
              
              await db.updateTransaction(entry.id, {
                number: entry.number,
                entryType: entry.entryType,
                first: entry.first,
                second: newSecond,
              });
              
              processedEntries.add(entryKey);
            }
          }
        }
      }
      
      // Log admin action for each affected user
      if (user?.id) {
        const affectedUsers = new Set<string>();
        for (const result of secondFilteredResults) {
          const entriesForNumber = entries.filter(e => e.number === result.number);
          entriesForNumber.forEach(entry => {
            if (entry.userId) affectedUsers.add(entry.userId);
          });
        }

        for (const targetUserId of affectedUsers) {
          await db.logAdminAction(
            user.id,
            targetUserId,
            'deduct_second',
            `Advanced Filter: Deducted SECOND amounts from ${secondFilteredResults.length} numbers (${selectedType})`,
            {
              entryType: selectedType,
              numbersCount: secondFilteredResults.length,
              entriesUpdated: processedEntries.size,
              searchQuery: secondNumbers,
            }
          );
        }
      }

      showSuccess('Success', `Deducted SECOND amounts! Updated ${processedEntries.size} entries.`);
      await loadEntries(true); // Save to history after reload
      setSecondNumbers('');
    } catch (error) {
      console.error('❌ Deduct SECOND error:', error);
      showError('Error', 'Failed to deduct SECOND amounts');
    } finally {
      setProcessing(false);
    }
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Select Data Source</h2>
            
            {/* Undo/Redo Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                title="Undo (Ctrl+Z)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                title="Redo (Ctrl+Y)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                </svg>
                Redo
              </button>
            </div>
          </div>
          
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
                    <div className="flex gap-2">
                      <button
                        onClick={copyFirstResults}
                        className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        📋 Copy ({firstFilteredResults.length})
                      </button>
                      <button
                        onClick={handleDeductFirst}
                        disabled={processing}
                        className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg text-xs font-semibold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ➖ {processing ? 'Processing...' : 'Deduct'}
                      </button>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={firstNumbers}
                  onChange={(e) => setFirstNumbers(e.target.value)}
                  placeholder="e.g., 1**, *2*, **1, 1***, *2**, **2*, ***1"
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
                    <div className="flex gap-2">
                      <button
                        onClick={copySecondResults}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        📋 Copy ({secondFilteredResults.length})
                      </button>
                      <button
                        onClick={handleDeductSecond}
                        disabled={processing}
                        className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg text-xs font-semibold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ➖ {processing ? 'Processing...' : 'Deduct'}
                      </button>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={secondNumbers}
                  onChange={(e) => setSecondNumbers(e.target.value)}
                  placeholder="e.g., 1**, *2*, **1, 1***, *2**, **2*, ***1"
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
                  <p className="font-semibold mb-2">Basic Wildcards:</p>
                  <ul className="space-y-1 ml-4">
                    <li><strong>Contains:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">5</code> to find any number containing "5"</li>
                    <li><strong>Starts with:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">1*</code> to find numbers starting with "1"</li>
                    <li><strong>Ends with:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">*3</code> to find numbers ending with "3"</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-2">Position Wildcards:</p>
                  <ul className="space-y-1 ml-4">
                    <li><strong>First digit:</strong> <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">1**</code> or <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">1***</code> = numbers starting with "1"</li>
                    <li><strong>Second digit:</strong> <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">*2*</code> or <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">*2**</code> = 2nd digit is "2"</li>
                    <li><strong>Third digit:</strong> <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">**2*</code> = 3rd digit is "2"</li>
                    <li><strong>Last digit:</strong> <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">**1</code> or <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">***1</code> = ending with "1"</li>
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
                  <strong>Multi-User Aggregation:</strong> Amounts are totaled from all users. Results show which users contributed to each number with color-coded badges.
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



