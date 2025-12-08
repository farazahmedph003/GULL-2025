import React, { useState, useMemo } from 'react';
import { db } from '../../services/database';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminRefresh } from '../../contexts/AdminRefreshContext';
import { groupTransactionsByNumber } from '../../utils/transactionHelpers';
import type { EntryType } from '../../types';
import { exportFilterResultsToPDF } from '../../utils/pdfExport';
import LoadingButton from '../../components/LoadingButton';
import { getCachedData, setCachedData } from '../../utils/cache';

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
  
  // INSTANT: Load cache synchronously BEFORE first render (for initial type)
  const initialCacheKey = `cache-filter-entries-open`;
  const initialCacheConfig = {
    key: initialCacheKey,
    validator: (data: any): data is any[] => Array.isArray(data),
  };
  const initialCached = typeof window !== 'undefined' 
    ? getCachedData<any[]>(initialCacheConfig) 
    : { data: null };
  
  const [entries, setEntries] = useState<any[]>(initialCached.data || []);
  const [processing, setProcessing] = useState(false); // Prevent double actions
  
  // Filter states - Default values set to 1 and disabled (not editable)
  const [firstComparison, setFirstComparison] = useState<ComparisonType>('>=');
  const [firstFilterValue, setFirstFilterValue] = useState('1');
  const [secondComparison, setSecondComparison] = useState<ComparisonType>('>=');
  const [secondFilterValue, setSecondFilterValue] = useState('1');
  
  // Limit states
  const [firstLimit, setFirstLimit] = useState('');
  const [secondLimit, setSecondLimit] = useState('');
  
  // Results
  const [calculatedResults, setCalculatedResults] = useState<CalculationResult[]>([]);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Undo/Redo history
  const [history, setHistory] = useState<Array<{entries: any[], results: CalculationResult[], timestamp: number}>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const { showSuccess, showError} = useNotifications();
  const { user } = useAuth();
  const { setRefreshCallback } = useAdminRefresh();

  // Track if any modal is open or processing to pause auto-refresh
  const isAnyModalOpenRef = React.useRef(false);
  
  React.useEffect(() => {
    isAnyModalOpenRef.current = !!(showSaveModal || processing);
  }, [showSaveModal, processing]);

  // Load entries when type changes
  React.useEffect(() => {
    // Register refresh callback for the refresh button
    setRefreshCallback(loadEntries);
    
    loadEntries(true); // Save initial state to history

    // Auto-refresh every 5 seconds
    const autoRefreshInterval = setInterval(() => {
      if (!isAnyModalOpenRef.current) {
      loadEntries(false);
      } else {
        console.log('⏸️ Skipping Filter refresh - modal or processing');
      }
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
            if (!isAnyModalOpenRef.current) {
            loadEntries(false);
            } else {
              console.log('⏸️ Skipping real-time refresh - modal or processing');
            }
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
    // Stale-While-Revalidate: Load from cache instantly
    const cacheKey = `cache-filter-entries-${selectedType}`;
    const cacheConfig = {
      key: cacheKey,
      validator: (data: any): data is any[] => Array.isArray(data),
    };

    // 1. Instant load from cache
    const cached = getCachedData<any[]>(cacheConfig);
    if (cached.data) {
      setEntries(cached.data);
    }

    // 2. Always fetch fresh data in background
    try {
      // Use adminView=true to see admin-adjusted amounts
      const data = await db.getAllEntriesByType(selectedType, true);
      
      // Convert to transaction format - CRITICAL: Preserve original_transaction_id for split entries
      const transactions = data.map((e: any) => ({
        id: e.id,
        number: e.number,
        entryType: e.entry_type,
        first: e.first_amount,
        second: e.second_amount,
        userId: e.user_id,
        username: e.app_users?.username || 'Unknown',
        // CRITICAL: Preserve original_transaction_id for split entries (especially ring)
        original_transaction_id: e.original_transaction_id || undefined,
        is_split_entry: e.is_split_entry || false,
      }));
      
      // Update cache and state
      setCachedData(cacheConfig, transactions);
      setEntries(transactions);
      
      // Debug: Log split entries for ring type
      if (selectedType === 'ring') {
        const splitEntries = transactions.filter((t: any) => t.is_split_entry);
        if (splitEntries.length > 0) {
          console.log(`🔍 Ring debug - Found ${splitEntries.length} split entries out of ${transactions.length} total entries`);
          console.log(`   Sample split entries:`, splitEntries.slice(0, 3).map((t: any) => ({
            id: t.id,
            original_transaction_id: t.original_transaction_id,
            number: t.number
          })));
        }
      }
      
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

  // Apply filter and calculate (async-style so button spinner is visible)
  const handleApplyFilter = () => {
    setCalculating(true);

    // Defer heavy calculation to next tick so the "loading" state renders first
    setTimeout(() => {
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
      setCalculating(false);
    }, 0);
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

    // Validate required data
    if (!calculatedResults || calculatedResults.length === 0) {
      showError('Error', 'No results to save. Please apply a filter first.');
      return;
    }

    if (!user?.id) {
      showError('Error', 'User not authenticated. Please refresh the page.');
      return;
    }

    setShowSaveModal(false);
    
    // Save current state to history before making changes
    saveToHistory();
    setProcessing(true);
    
    try {
      console.log('🔄 Starting filter save...');
      console.log('📊 Calculated Results:', calculatedResults);
      console.log('👤 User ID:', user.id);
      
      // Generate unique filter_save_id to group all deductions from this filter save
      const filterSaveId = `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`🆔 Generated filter_save_id: ${filterSaveId}`);
      
      // Process each number and deduct BOTH first and second if applicable
      const processedEntries = new Set<string>();
      let errorCount = 0;
      const errors: string[] = [];
      const totalResults = calculatedResults.length;
      let processedResults = 0;
      
      console.log(`📦 Processing ${totalResults} numbers...`);
      
      // Load original transaction amounts (without admin deductions) for accurate calculation
      console.log('🔍 Loading original transaction amounts for deduction calculation...');
      const originalEntriesData = await db.getAllEntriesByType(selectedType, false); // false = no admin view, get original amounts
      const originalEntriesMap = new Map<string, { first: number; second: number }>();
      
      // Build map of original amounts - handle both split and non-split entries
      originalEntriesData.forEach((e: any) => {
        // For split entries (ring entries that were split), use original_transaction_id
        // For non-split entries, use the entry id
        const transactionId = e.original_transaction_id || e.id;
        const existing = originalEntriesMap.get(transactionId) || { first: 0, second: 0 };
        
        // Sum up amounts for split entries that share the same original_transaction_id
        originalEntriesMap.set(transactionId, {
          first: existing.first + (e.first_amount || 0),
          second: existing.second + (e.second_amount || 0),
        });
      });
      
      console.log(`📊 Loaded ${originalEntriesMap.size} original transaction amounts for ${selectedType} (from ${originalEntriesData.length} entries)`);
      if (selectedType === 'ring') {
        console.log('🔍 Ring debug - Sample original entries:', originalEntriesData.slice(0, 5).map((e: any) => ({
          id: e.id,
          original_transaction_id: e.original_transaction_id,
          is_split_entry: e.is_split_entry,
          number: e.number,
          first: e.first_amount,
          second: e.second_amount
        })));
        console.log('🔍 Ring debug - Sample originalEntriesMap:', Array.from(originalEntriesMap.entries()).slice(0, 5).map(([id, amounts]) => ({
          transactionId: id,
          amounts
        })));
      }
      
      // Collect ALL deductions from ALL numbers first (before saving anything)
      const allDeductionsToSave: Array<{
        transactionId: string;
        deductedFirst: number;
        deductedSecond: number;
        entryKey: string;
        username: string;
        number: string; // Store the number for metadata
      }> = [];
      
      for (const result of calculatedResults) {
        try {
          const entriesForNumber = entries.filter(e => e.number === result.number);
          console.log(`📌 Processing number ${result.number}: ${entriesForNumber.length} entries found`);
          console.log(`   First to deduct: ${result.firstResult}, Second to deduct: ${result.secondResult}`);
          
          if (entriesForNumber.length === 0) {
            console.warn(`⚠️ No entries found for number ${result.number} in ${selectedType}`);
            errorCount++;
            errors.push(`No entries found for number ${result.number}`);
            processedResults++;
            continue;
          }
          
          // Debug: Log entry details for ring entries
          if (selectedType === 'ring') {
            console.log(`🔍 Ring debug - Entries for ${result.number}:`, entriesForNumber.map((e: any) => ({
              id: e.id,
              original_transaction_id: (e as any).original_transaction_id,
              is_split_entry: (e as any).is_split_entry,
              number: e.number,
              first: e.first,
              second: e.second,
              username: e.username
            })));
          }
          
          // Group entries by user so we can fully consume one account before touching the next
          const entriesByUser = new Map<string, typeof entries>();
          entriesForNumber.forEach(entry => {
            const userId = entry.userId || 'unknown';
            if (!entriesByUser.has(userId)) {
              entriesByUser.set(userId, []);
            }
            entriesByUser.get(userId)!.push(entry);
          });
          
          console.log(`   👥 Found ${entriesByUser.size} users with this number`);
          
          let remainingFirstToDeduct = Math.floor(result.firstResult);
          let remainingSecondToDeduct = Math.floor(result.secondResult);
          
          // Collect all deductions that need to be saved for this number (will be added to allDeductionsToSave)
          
          // Process entries for each user sequentially (exhaust one account before moving on)
          for (const [userId, userEntries] of entriesByUser.entries()) {
            if (remainingFirstToDeduct <= 0 && remainingSecondToDeduct <= 0) {
              break;
            }
            
            console.log(`   👤 Processing user ${userId}: ${userEntries.length} entries`);
            
            // Calculate user's ORIGINAL totals and CURRENT available totals for this number
            let userFirstTotalOriginal = 0;
            let userSecondTotalOriginal = 0;
            let userFirstCurrentTotal = 0;
            let userSecondCurrentTotal = 0;
            
            userEntries.forEach(entry => {
              const transactionId = (entry as any).original_transaction_id || entry.id;
              const original = originalEntriesMap.get(transactionId);
              if (original) {
                userFirstTotalOriginal += original.first;
                userSecondTotalOriginal += original.second;
              } else {
                console.warn(`⚠️ Original amount not found for transaction ${transactionId}, using current amounts`);
                userFirstTotalOriginal += entry.first || 0;
                userSecondTotalOriginal += entry.second || 0;
              }
              
              userFirstCurrentTotal += entry.first || 0;
              userSecondCurrentTotal += entry.second || 0;
            });
            
            // Determine how much this user can actually cover (bounded by both current + original totals)
            let userRemainingFirst = Math.min(
              remainingFirstToDeduct,
              userFirstTotalOriginal,
              userFirstCurrentTotal
            );
            let userRemainingSecond = Math.min(
              remainingSecondToDeduct,
              userSecondTotalOriginal,
              userSecondCurrentTotal
            );
            
            userRemainingFirst = Math.floor(Math.max(0, userRemainingFirst));
            userRemainingSecond = Math.floor(Math.max(0, userRemainingSecond));
            
            console.log(`   📊 User original totals: F ${userFirstTotalOriginal}, S ${userSecondTotalOriginal}`);
            console.log(`   📊 Sequential user target: F ${userRemainingFirst}, S ${userRemainingSecond}`);
            
            for (const entry of userEntries) {
              // Use original_transaction_id if this is a split entry, otherwise use entry.id
              const transactionId = (entry as any).original_transaction_id || entry.id;
              const entryKey = `${transactionId}-${entry.number}`;
              
              if (processedEntries.has(entryKey)) {
                console.log(`   ⏭️ Skipping already processed entry ${transactionId}`);
                continue;
              }
              
              // Get ORIGINAL amounts for this transaction (before any deductions)
              // For split entries, this will get the aggregated original amount
              const originalAmounts = originalEntriesMap.get(transactionId);
              
              if (!originalAmounts) {
                console.error(`❌ CRITICAL: Original amounts not found for transaction ${transactionId} (number: ${entry.number}, type: ${selectedType})`);
                console.error(`   Entry details:`, {
                  id: entry.id,
                  original_transaction_id: (entry as any).original_transaction_id,
                  is_split_entry: (entry as any).is_split_entry,
                  first: entry.first,
                  second: entry.second,
                  username: entry.username
                });
                console.error(`   Available transaction IDs in map (first 10):`, Array.from(originalEntriesMap.keys()).slice(0, 10));
                // Skip this entry to prevent incorrect deductions
                errorCount++;
                errors.push(`Original amounts not found for transaction ${transactionId} (number: ${entry.number})`);
                continue;
              }
              
              const originalFirst = originalAmounts.first;
              const originalSecond = originalAmounts.second;
              
              // Get current amounts (may have deductions already applied)
              const currentFirst = entry.first || 0;
              const currentSecond = entry.second || 0;
              
              // Available amount to deduct is the current amount (original minus already deducted)
              const availableFirst = currentFirst;
              const availableSecond = currentSecond;
              
              let deductedFirst = 0;
              let deductedSecond = 0;
              
              // Deduct from first if needed (based on original amount)
              if (userRemainingFirst > 0 && availableFirst > 0) {
                // Ensure whole number deduction (no decimals)
                const deductAmount = Math.floor(Math.min(availableFirst, userRemainingFirst));
                if (deductAmount > 0) {
                  deductedFirst = deductAmount;
                  userRemainingFirst -= deductAmount;
                  remainingFirstToDeduct -= deductAmount;
                  console.log(`   💰 Entry ${transactionId} (@${entry.username}) - Deducting F ${deductAmount} from original ${originalFirst} (available: ${availableFirst})`);
                }
              }
              
              // Deduct from second if needed (based on original amount)
              if (userRemainingSecond > 0 && availableSecond > 0) {
                // Ensure whole number deduction (no decimals)
                const deductAmount = Math.floor(Math.min(availableSecond, userRemainingSecond));
                if (deductAmount > 0) {
                  deductedSecond = deductAmount;
                  userRemainingSecond -= deductAmount;
                  remainingSecondToDeduct -= deductAmount;
                  console.log(`   💎 Entry ${transactionId} (@${entry.username}) - Deducting S ${deductAmount} from original ${originalSecond} (available: ${availableSecond})`);
                }
              }
              
              // Collect deduction for batch save (add to global collection)
              // CRITICAL: Only save if we have valid amounts and transaction ID
              if ((deductedFirst > 0 || deductedSecond > 0) && transactionId) {
                // Validate transaction ID is not empty
                if (!transactionId || transactionId.trim() === '') {
                  console.error(`❌ CRITICAL: Empty transaction ID for entry ${entry.id} (number: ${entry.number})`);
                  errorCount++;
                  errors.push(`Empty transaction ID for entry ${entry.id} (number: ${entry.number})`);
                  continue;
                }
                
                allDeductionsToSave.push({
                  transactionId: transactionId.trim(), // Use original transaction ID for split entries, ensure no whitespace
                  deductedFirst: Math.max(0, deductedFirst), // Ensure non-negative
                  deductedSecond: Math.max(0, deductedSecond), // Ensure non-negative
                  entryKey,
                  username: entry.username || 'Unknown',
                  number: result.number, // Store number for metadata
                });
                processedEntries.add(entryKey);
                console.log(`   ✅ Collected deduction for entry ${transactionId}: F ${deductedFirst}, S ${deductedSecond}`);
              } else if (deductedFirst === 0 && deductedSecond === 0) {
                console.log(`   ⏭️ Skipping entry ${transactionId} - no deduction needed (F: ${deductedFirst}, S: ${deductedSecond})`);
              }
              
              // Stop if this user's allocation is fully deducted
              if (userRemainingFirst <= 0 && userRemainingSecond <= 0) {
                break;
              }
            }
          }
          
          if (remainingFirstToDeduct > 0 || remainingSecondToDeduct > 0) {
            const warnMsg = `Unable to fully deduct number ${result.number}. Remaining F ${remainingFirstToDeduct}, S ${remainingSecondToDeduct}`;
            console.warn(`   ⚠️ ${warnMsg}`);
            errors.push(warnMsg);
            errorCount++;
          } else {
            console.log(`   ✔️ Number ${result.number} complete. Remaining: F ${remainingFirstToDeduct}, S ${remainingSecondToDeduct}`);
          }
          processedResults++;
          if (processedResults % 10 === 0 || processedResults === totalResults) {
            console.log(`📊 Progress: ${processedResults}/${totalResults} numbers processed (${Math.round(processedResults / totalResults * 100)}%)`);
          }
        } catch (resultError: any) {
          errorCount++;
          const errorMsg = `Error processing number ${result.number}: ${resultError?.message || 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`   ❌ ${errorMsg}`, resultError);
          processedResults++;
          // Continue with other numbers even if one fails
        }
      }
      
      console.log(`📊 All numbers processed: ${processedResults}/${totalResults}`);
      console.log(`💾 Collected ${allDeductionsToSave.length} total deductions to save in batch...`);
      
      // Save ALL deductions in a single batch operation (INSTANT!)
      if (allDeductionsToSave.length > 0) {
        try {
          // Filter out any deductions with invalid transaction IDs before batch save
          const validDeductions = allDeductionsToSave.filter(d => {
            if (!d.transactionId || d.transactionId.trim() === '') {
              console.error(`❌ Filtering out deduction with invalid transaction ID:`, d);
              return false;
            }
            if (d.deductedFirst < 0 || d.deductedSecond < 0) {
              console.error(`❌ Filtering out deduction with negative amounts:`, d);
              return false;
            }
            return true;
          });
          
          if (validDeductions.length < allDeductionsToSave.length) {
            const filteredCount = allDeductionsToSave.length - validDeductions.length;
            console.warn(`⚠️ Filtered out ${filteredCount} invalid deductions before batch save`);
            errorCount += filteredCount;
            errors.push(`Filtered out ${filteredCount} invalid deductions`);
          }
          
          if (validDeductions.length === 0) {
            console.error(`❌ No valid deductions to save after filtering`);
            throw new Error('No valid deductions to save. All deductions were filtered out due to invalid transaction IDs or amounts.');
          }
          
          console.log(`🚀 Saving ${validDeductions.length} validated deductions in ONE batch operation...`);
          
          const batchDeductions = validDeductions.map(({ transactionId, deductedFirst, deductedSecond, number }) => ({
            transactionId: transactionId.trim(), // Ensure no whitespace
            adminUserId: user.id,
            deductedFirst: Math.floor(Math.max(0, deductedFirst)), // Ensure non-negative whole number
            deductedSecond: Math.floor(Math.max(0, deductedSecond)), // Ensure non-negative whole number
            deductionType: 'filter_save',
            metadata: {
              entryType: selectedType,
              numberFiltered: number,
              firstLimit,
              secondLimit,
              firstFilterValue,
              secondFilterValue,
              firstComparison,
              secondComparison,
              filter_save_id: filterSaveId, // Unique ID to group all deductions from this filter save
            }
          }));
          
          // Add timeout to prevent hanging (60 seconds max - increased for retries)
          const savePromise = db.saveAdminDeductionsBatch(batchDeductions);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Save operation timed out after 60 seconds')), 60000)
          );
          
          const batchResult = await Promise.race([savePromise, timeoutPromise]) as any;
          
          // CRITICAL: If any deductions failed, it means retries also failed - this is a critical error
          if (batchResult.failed > 0) {
            const errorMsg = `CRITICAL: ${batchResult.failed} deductions failed to save after all retries. You may need to save the filter again.`;
            console.error(`❌ ${errorMsg}`);
            errorCount += batchResult.failed;
            errors.push(errorMsg, ...batchResult.errors);
            
            // Show critical error to user
            showError('Critical Error', `${batchResult.failed} deductions failed to save. Please try saving the filter again.`);
          } else {
            console.log(`✅ Batch save complete! ALL ${batchResult.success} deductions saved successfully!`);
          }
        } catch (batchError: any) {
          console.error('❌ Batch save error:', batchError);
          errorCount += allDeductionsToSave.length;
          errors.push(`Batch save failed: ${batchError?.message || 'Unknown error'}`);
        }
      }
      
      // Log admin action for each affected user (completely non-blocking, fire and forget)
      if (user?.id && processedEntries.size > 0) {
        // Run in background without blocking - use setTimeout to ensure it doesn't block
        setTimeout(() => {
          try {
            const affectedUsers = new Set<string>();
            for (const result of calculatedResults) {
              const entriesForNumber = entries.filter(e => e.number === result.number);
              entriesForNumber.forEach(entry => {
                if (entry.userId) affectedUsers.add(entry.userId);
              });
            }

            // Log actions in background (fire and forget - don't wait or track)
            Array.from(affectedUsers).forEach(targetUserId => {
              // Use void to explicitly ignore the promise
              void db.logAdminAction(
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
              ).catch(() => {
                // Silently ignore - logging is optional
              });
            });
          } catch (logError) {
            // Silently ignore - logging is optional
          }
        }, 0); // Run in next event loop tick
      }
      
      console.log(`✅ Filter save complete! Processed ${processedEntries.size} entries, ${errorCount} errors`);
      console.log(`📋 Summary: ${processedEntries.size} deductions saved, ${errorCount} errors, ${totalResults} numbers processed`);
      
      // INSTANT: Update cache immediately after filter save
      if (processedEntries.size > 0) {
        // Reload entries immediately to update cache with fresh data
        loadEntries(false).catch(err => {
          console.warn('⚠️ Reload failed (non-critical):', err);
        });
      }
      
      // Show result message immediately (don't wait for reload)
      if (processedEntries.size > 0) {
        if (errorCount > 0) {
          showError(
            'Partial Success', 
            `Saved ${processedEntries.size} deductions, but ${errorCount} errors occurred. Check console for details.`
          );
        } else {
          showSuccess('Success', `Saved filter! Created ${processedEntries.size} admin deductions (admin-only view).`);
        }
      } else {
        if (errorCount > 0) {
          showError('Error', `Failed to save deductions. ${errorCount} errors occurred. Check console for details.`);
        } else {
          showError('Error', 'No deductions were created. Please check your filter criteria.');
        }
      }
      
      // Clear results immediately
      if (errorCount === 0 && processedEntries.size > 0) {
        setCalculatedResults([]);
      }
    } catch (error: any) {
      console.error('❌ Save filter error:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      showError('Error', `Failed to save filter: ${errorMessage}`);
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
                      disabled
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 w-16 text-center cursor-not-allowed opacity-60"
                      title="Default value: 1 (not editable)"
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
                      disabled
                      placeholder="1 (default)"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60"
                      title="Default value: 1 (not editable)"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                    Default value: 1 (applies to all entry types)
                  </p>
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
                      disabled
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 w-16 text-center cursor-not-allowed opacity-60"
                      title="Default value: 1 (not editable)"
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
                      disabled
                      placeholder="1 (default)"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60"
                      title="Default value: 1 (not editable)"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                    Default value: 1 (applies to all entry types)
                  </p>
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
                <LoadingButton 
                  onClick={handleApplyFilter}
                  loading={processing || calculating}
                  variant="primary"
                >
                  Apply Filter
                </LoadingButton>

                <LoadingButton
                  onClick={handleReset}
                  loading={processing || calculating}
                  variant="secondary"
                >
                  Reset
                </LoadingButton>

                {calculatedResults.length > 0 && (
                  <LoadingButton
                    onClick={handleSaveFilterClick}
                    loading={processing}
                    variant="success"
                  >
                    💾 Save Filter
                  </LoadingButton>
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
              <LoadingButton
                onClick={handleConfirmSaveFilter}
                loading={processing}
                variant="success"
                className="flex-1"
              >
                Yes, Save Filter
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFilterPage;



