import React, { useState, useMemo } from 'react';
import { db } from '../../services/database';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminRefresh } from '../../contexts/AdminRefreshContext';
import { groupTransactionsByNumber } from '../../utils/transactionHelpers';
import type { EntryType } from '../../types';
import { exportFilterResultsToPDF } from '../../utils/pdfExport';

type ComparisonType = '>=' | '>' | '<=' | '<' | '==';

interface CalculationResult {
  number: string;
  firstOriginal: number;
  firstResult: number;
  secondOriginal: number;
  secondResult: number;
}

const AdminFilterPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<EntryType>('open');
  const [entries, setEntries] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false); // Prevent double actions
  
  // Filter states
  const [firstComparison, setFirstComparison] = useState<ComparisonType>('>=');
  const [firstFilterValue, setFirstFilterValue] = useState('');
  const [secondComparison, setSecondComparison] = useState<ComparisonType>('>=');
  const [secondFilterValue, setSecondFilterValue] = useState('');
  
  // Limit states
  const [firstLimit, setFirstLimit] = useState('');
  const [secondLimit, setSecondLimit] = useState('');
  
  // Results
  const [calculatedResults, setCalculatedResults] = useState<CalculationResult[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Undo/Redo history
  const [history, setHistory] = useState<Array<{entries: any[], results: CalculationResult[], timestamp: number}>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const { showSuccess, showError} = useNotifications();
  const { user } = useAuth();
  const { setRefreshCallback } = useAdminRefresh();

  // Load entries when type changes
  React.useEffect(() => {
    // Register refresh callback for the refresh button
    setRefreshCallback(loadEntries);
    
    loadEntries(true); // Save initial state to history

    // Auto-refresh every 5 seconds
    const autoRefreshInterval = setInterval(() => {
      loadEntries(false);
    }, 5000);

    // Set up real-time subscription for auto-updates
    if (supabase) {
      const subscription = supabase
        .channel(`filter-${selectedType}-realtime`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'transactions', 
            filter: `entry_type=eq.${selectedType}` 
          },
          (payload: any) => {
            console.log(`🔴 Real-time update received for ${selectedType} (filter):`, payload);
            loadEntries(false);
          }
        )
        .subscribe((status: string) => {
          console.log(`📡 ${selectedType} filter subscription status:`, status);
          if (status === 'SUBSCRIBED') {
            console.log(`✅ ${selectedType} filter real-time subscription active`);
          }
        });

      return () => {
        console.log(`🔌 Unsubscribing from ${selectedType} filter real-time updates`);
        clearInterval(autoRefreshInterval);
        subscription.unsubscribe();
      };
    }

    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, [selectedType]); // Only re-run when selectedType changes

  const loadEntries = async (saveHistory = false) => {
    try {
      // Use adminView=true to see admin-adjusted amounts
      const data = await db.getAllEntriesByType(selectedType, true);
      
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
        requestAnimationFrame(() => {
          setHistoryIndex(prevIndex => {
            setHistory(prevHistory => {
              const newHistory = [...prevHistory.slice(0, prevIndex + 1), {
                entries: JSON.parse(JSON.stringify(transactions)),
                results: JSON.parse(JSON.stringify(calculatedResults)),
                timestamp: Date.now(),
              }];
              return newHistory;
            });
            return prevIndex + 1;
          });
        });
      }
    } catch (error) {
      console.error('Error loading entries:', error);
      showError('Error', 'Failed to load entries');
    }
  };

  // Save current state to history
  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      entries: JSON.parse(JSON.stringify(entries)),
      results: JSON.parse(JSON.stringify(calculatedResults)),
      timestamp: Date.now(),
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo/Redo functions removed as buttons were removed from UI

  // Group transactions
  const summaries = useMemo(
    () => groupTransactionsByNumber(entries, selectedType),
    [entries, selectedType]
  );

  // Comparison function
  const compare = (value: number, comparison: ComparisonType, threshold: number): boolean => {
    switch (comparison) {
      case '>=': return value >= threshold;
      case '>': return value > threshold;
      case '<=': return value <= threshold;
      case '<': return value < threshold;
      case '==': return value === threshold;
      default: return false;
    }
  };

  // Apply filter and calculate
  const handleApplyFilter = () => {
    const results: CalculationResult[] = [];
    const firstThreshold = parseFloat(firstFilterValue) || 0;
    const secondThreshold = parseFloat(secondFilterValue) || 0;
    const firstLimitValue = parseFloat(firstLimit) || 0;
    const secondLimitValue = parseFloat(secondLimit) || 0;

    summaries.forEach((summary, number) => {
      const passesFirstFilter = firstFilterValue ? compare(summary.firstTotal, firstComparison, firstThreshold) : true;
      const passesSecondFilter = secondFilterValue ? compare(summary.secondTotal, secondComparison, secondThreshold) : true;

      if (passesFirstFilter || passesSecondFilter) {
        const firstResult = summary.firstTotal > firstLimitValue ? summary.firstTotal - firstLimitValue : 0;
        const secondResult = summary.secondTotal > secondLimitValue ? summary.secondTotal - secondLimitValue : 0;

        if (firstResult > 0 || secondResult > 0) {
          results.push({
            number,
            firstOriginal: summary.firstTotal,
            firstResult,
            secondOriginal: summary.secondTotal,
            secondResult,
          });
        }
      }
    });

    results.sort((a, b) => a.number.localeCompare(b.number));
    setCalculatedResults(results);
  };

  const handleReset = () => {
    setFirstFilterValue('');
    setSecondFilterValue('');
    setFirstLimit('');
    setSecondLimit('');
    setCalculatedResults([]);
  };

  const copyFirstResults = () => {
    const entryTypeUpper = selectedType.toUpperCase();
    const header = `${entryTypeUpper}\tFirst`;
    const rows = calculatedResults
      .filter(r => r.firstResult > 0)
      .map(r => `${r.number}\tF ${r.firstResult}`)
      .join('\n');
    
    const data = `${header}\n${rows}`;
    
    navigator.clipboard.writeText(data).then(() => {
      showSuccess('Success', `Copied ${calculatedResults.filter(r => r.firstResult > 0).length} First results!`);
    });
  };

  const copySecondResults = () => {
    const entryTypeUpper = selectedType.toUpperCase();
    const header = `${entryTypeUpper}\tSecond`;
    const rows = calculatedResults
      .filter(r => r.secondResult > 0)
      .map(r => `${r.number}\tS ${r.secondResult}`)
      .join('\n');
    
    const data = `${header}\n${rows}`;
    
    navigator.clipboard.writeText(data).then(() => {
      showSuccess('Success', `Copied ${calculatedResults.filter(r => r.secondResult > 0).length} Second results!`);
    });
  };

  const handleExportPDF = async () => {
    try {
      await exportFilterResultsToPDF(calculatedResults, selectedType, firstTotal, secondTotal);
      showSuccess('Success', 'Filter results exported to PDF');
    } catch (error) {
      console.error('PDF export error:', error);
      showError('Error', 'Failed to export to PDF');
    }
  };

  const handleSaveFilterClick = () => {
    setShowSaveModal(true);
  };

  const handleConfirmSaveFilter = async () => {
    if (processing) {
      showError('Processing', 'An action is already in progress. Please wait.');
      return;
    }

    setShowSaveModal(false);
    
    // Save current state to history before making changes
    saveToHistory();
    setProcessing(true);
    
    try {
      console.log('🔄 Starting filter save...');
      console.log('📊 Calculated Results:', calculatedResults);
      
      // Process each number and deduct BOTH first and second if applicable
      const processedEntries = new Set<string>();
      
      for (const result of calculatedResults) {
        const entriesForNumber = entries.filter(e => e.number === result.number);
        console.log(`📌 Processing number ${result.number}: ${entriesForNumber.length} entries found`);
        console.log(`   First to deduct: ${result.firstResult}, Second to deduct: ${result.secondResult}`);
        
        // Group entries by user to deduct proportionally from each user
        const entriesByUser = new Map<string, typeof entries>();
        entriesForNumber.forEach(entry => {
          const userId = entry.userId || 'unknown';
          if (!entriesByUser.has(userId)) {
            entriesByUser.set(userId, []);
          }
          entriesByUser.get(userId)!.push(entry);
        });
        
        console.log(`   👥 Found ${entriesByUser.size} users with this number`);
        
        let remainingFirstToDeduct = result.firstResult;
        let remainingSecondToDeduct = result.secondResult;
        
        // Process entries for each user proportionally
        for (const [userId, userEntries] of entriesByUser) {
          console.log(`   👤 Processing user ${userId}: ${userEntries.length} entries`);
          
          // Calculate user's total for this number
          const userFirstTotal = userEntries.reduce((sum, e) => sum + (e.first || 0), 0);
          const userSecondTotal = userEntries.reduce((sum, e) => sum + (e.second || 0), 0);
          
          // Calculate how much to deduct from this user (proportional to their share)
          const totalFirst = entriesForNumber.reduce((sum, e) => sum + (e.first || 0), 0);
          const totalSecond = entriesForNumber.reduce((sum, e) => sum + (e.second || 0), 0);
          
          const userFirstShare = totalFirst > 0 ? (userFirstTotal / totalFirst) * result.firstResult : 0;
          const userSecondShare = totalSecond > 0 ? (userSecondTotal / totalSecond) * result.secondResult : 0;
          
          let userRemainingFirst = Math.min(userFirstShare, remainingFirstToDeduct, userFirstTotal);
          let userRemainingSecond = Math.min(userSecondShare, remainingSecondToDeduct, userSecondTotal);
          
          console.log(`   📊 User share: F ${userRemainingFirst.toFixed(0)}, S ${userRemainingSecond.toFixed(0)}`);
          
          for (const entry of userEntries) {
            const entryKey = `${entry.id}-${entry.number}`;
            if (processedEntries.has(entryKey)) {
              console.log(`   ⏭️ Skipping already processed entry ${entry.id}`);
              continue;
            }
            
            const currentFirst = entry.first || 0;
            const currentSecond = entry.second || 0;
            
            let newFirst = currentFirst;
            let newSecond = currentSecond;
            let needsUpdate = false;
            
            // Deduct from first if needed
            if (userRemainingFirst > 0 && currentFirst > 0) {
              const deductAmount = Math.min(currentFirst, userRemainingFirst);
              newFirst = currentFirst - deductAmount;
              userRemainingFirst -= deductAmount;
              remainingFirstToDeduct -= deductAmount;
              needsUpdate = true;
              console.log(`   💰 Entry ${entry.id} (@${entry.username}) - Deducting F ${deductAmount}: ${currentFirst} → ${newFirst}`);
            }
            
            // Deduct from second if needed
            if (userRemainingSecond > 0 && currentSecond > 0) {
              const deductAmount = Math.min(currentSecond, userRemainingSecond);
              newSecond = currentSecond - deductAmount;
              userRemainingSecond -= deductAmount;
              remainingSecondToDeduct -= deductAmount;
              needsUpdate = true;
              console.log(`   💎 Entry ${entry.id} (@${entry.username}) - Deducting S ${deductAmount}: ${currentSecond} → ${newSecond}`);
            }
            
            // Save admin deduction (admin-only, doesn't modify user data)
            if (needsUpdate) {
              const deductedFirst = currentFirst - newFirst;
              const deductedSecond = currentSecond - newSecond;
              
              console.log(`   ✅ Saving admin deduction for entry ${entry.id}: F ${deductedFirst}, S ${deductedSecond}`);
              
        await db.saveAdminDeduction(
          entry.id,
          user?.id || 'unknown',
          deductedFirst,
          deductedSecond,
          'filter_save',
                {
                  entryType: selectedType,
                  numberFiltered: result.number,
                  firstLimit,
                  secondLimit,
                  firstFilterValue,
                  secondFilterValue,
                  firstComparison,
                  secondComparison,
                }
              );
              
              processedEntries.add(entryKey);
            }
            
            // Stop if user's share is fully deducted
            if (userRemainingFirst <= 0 && userRemainingSecond <= 0) {
              break;
            }
          }
        }
        
        console.log(`   ✔️ Number ${result.number} complete. Remaining: F ${remainingFirstToDeduct.toFixed(0)}, S ${remainingSecondToDeduct.toFixed(0)}`);
      }
      
      // Log admin action for each affected user
      if (user?.id) {
        const affectedUsers = new Set<string>();
        for (const result of calculatedResults) {
          const entriesForNumber = entries.filter(e => e.number === result.number);
          entriesForNumber.forEach(entry => {
            if (entry.userId) affectedUsers.add(entry.userId);
          });
        }

        for (const targetUserId of affectedUsers) {
          await db.logAdminAction(
            user.id,
            targetUserId,
            'filter_save',
            `Filter & Calculate: Deducted amounts from ${calculatedResults.length} numbers (${selectedType})`,
            {
              entryType: selectedType,
              numbersCount: calculatedResults.length,
              entriesUpdated: processedEntries.size,
              firstLimit,
              secondLimit,
              firstFilterValue,
              secondFilterValue,
              firstComparison,
              secondComparison,
            }
          );
        }
      }
      
      showSuccess('Success', `Saved filter! Created ${processedEntries.size} admin deductions (admin-only view).`);
      
      // Reload entries to show updated values and save to history
      await loadEntries(true);
      
      // Clear results
      setCalculatedResults([]);
    } catch (error) {
      console.error('❌ Save filter error:', error);
      showError('Error', 'Failed to save filter');
    } finally {
      setProcessing(false);
    }
  };

  const firstTotal = calculatedResults.reduce((sum, r) => sum + r.firstResult, 0);
  const secondTotal = calculatedResults.reduce((sum, r) => sum + r.secondResult, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🧮 Filter & Calculate
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Filter and calculate deductions across all users
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
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <>
            {/* Filter Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                🔍 Step 1: Apply Filters
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* First Filter */}
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    💰 FIRST Filter
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={firstComparison}
                      onChange={(e) => setFirstComparison(e.target.value as ComparisonType)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-16 text-center"
                    >
                      <option value=">=">≥</option>
                      <option value=">">{'>'}</option>
                      <option value="<=">≤</option>
                      <option value="<">{'<'}</option>
                      <option value="==">{'='}</option>
                    </select>
                    <input
                      type="number"
                      value={firstFilterValue}
                      onChange={(e) => setFirstFilterValue(e.target.value)}
                      placeholder="Enter value"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Second Filter */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    💎 SECOND Filter
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={secondComparison}
                      onChange={(e) => setSecondComparison(e.target.value as ComparisonType)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-16 text-center"
                    >
                      <option value=">=">≥</option>
                      <option value=">">{'>'}</option>
                      <option value="<=">≤</option>
                      <option value="<">{'<'}</option>
                      <option value="==">{'='}</option>
                    </select>
                    <input
                      type="number"
                      value={secondFilterValue}
                      onChange={(e) => setSecondFilterValue(e.target.value)}
                      placeholder="Enter value"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Limit Section */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-xl border border-yellow-200 dark:border-yellow-800 mb-4">
                <h4 className="text-md font-bold text-gray-900 dark:text-white mb-4">
                  ⚡ Step 2: Set Limits (Result = Original - Limit)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      💰 FIRST Limit
                    </label>
                    <input
                      type="number"
                      value={firstLimit}
                      onChange={(e) => setFirstLimit(e.target.value)}
                      placeholder="e.g., 100"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      💎 SECOND Limit
                    </label>
                    <input
                      type="number"
                      value={secondLimit}
                      onChange={(e) => setSecondLimit(e.target.value)}
                      placeholder="e.g., 100"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleApplyFilter}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg transition-all"
                >
                  Apply Filter
                </button>

                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  Reset
                </button>

                {calculatedResults.length > 0 && (
                  <button
                    onClick={handleSaveFilterClick}
                    disabled={processing}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    💾 Save Filter
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            {calculatedResults.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    📊 Filtered & Calculated Results
                  </h3>
                  <div className="flex gap-2">
                    <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <span className="text-xs text-gray-600 dark:text-gray-400">First Total:</span>
                      <span className="ml-2 font-bold text-green-700 dark:text-green-300">{firstTotal}</span>
                    </div>
                    <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Second Total:</span>
                      <span className="ml-2 font-bold text-blue-700 dark:text-blue-300">{secondTotal}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* First Results */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-900 dark:text-white">💰 FIRST Results</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={copyFirstResults}
                          className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        >
                          📋 Copy
                        </button>
                        <button
                          onClick={handleExportPDF}
                          className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                          📄 PDF
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 max-h-96 overflow-y-auto space-y-2">
                      {calculatedResults.filter(r => r.firstResult > 0).map((result) => (
                        <div
                          key={`first-${result.number}`}
                          className="bg-white dark:bg-gray-800 p-3 rounded-lg flex justify-between items-center"
                        >
                          <span className="font-bold text-gray-900 dark:text-white">{result.number}</span>
                          <div className="text-right">
                            <div className="text-sm text-gray-500 dark:text-gray-400 line-through">
                              F {result.firstOriginal}
                            </div>
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                              F {result.firstResult}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Second Results */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-900 dark:text-white">💎 SECOND Results</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={copySecondResults}
                          className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          📋 Copy
                        </button>
                        <button
                          onClick={handleExportPDF}
                          className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                          📄 PDF
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 max-h-96 overflow-y-auto space-y-2">
                      {calculatedResults.filter(r => r.secondResult > 0).map((result) => (
                        <div
                          key={`second-${result.number}`}
                          className="bg-white dark:bg-gray-800 p-3 rounded-lg flex justify-between items-center"
                        >
                          <span className="font-bold text-gray-900 dark:text-white">{result.number}</span>
                          <div className="text-right">
                            <div className="text-sm text-gray-500 dark:text-gray-400 line-through">
                              S {result.secondOriginal}
                            </div>
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              S {result.secondResult}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
      </div>

      {/* Confirmation Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Confirm Save Filter
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Are you sure you want to save this filter? This will deduct the filtered amounts from both First and Second entries in the database.
              </p>
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm space-y-1">
                  <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    First Total: {firstTotal.toLocaleString()}
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 font-semibold">
                    Second Total: {secondTotal.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSaveFilter}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold shadow-lg transition-all"
              >
                Yes, Save Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFilterPage;



