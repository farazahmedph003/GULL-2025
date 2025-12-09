import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import LoadingButton from '../../components/LoadingButton';
import { db } from '../../services/database';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAdminRefresh } from '../../contexts/AdminRefreshContext';
import { ConfirmationContext } from '../../App';
import EditTransactionModal from '../../components/EditTransactionModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import { getCachedData, setCachedData, CACHE_KEYS } from '../../utils/cache';

interface Entry {
  id: string;
  number: string;
  first_amount: number;
  second_amount: number;
  created_at: string;
  user_id: string;
  app_users: {
    username: string;
    full_name: string;
  };
}

interface DeductionRecord {
  id: string;
  deducted_first: number;
  deducted_second: number;
  deduction_type: string;
  created_at: string;
  metadata: any;
  transactions: {
    id: string;
    number: string;
    app_users: {
      username: string;
      full_name: string;
    };
  };
  admin: {
    username: string;
  };
}

const AdminPacketPage: React.FC = () => {
  // INSTANT: Load cache synchronously BEFORE first render
  const packetCacheConfig = {
    key: CACHE_KEYS.ADMIN_PACKET_ENTRIES,
    validator: (data: any): data is Entry[] => Array.isArray(data),
  };
  const packetDeductionsCacheConfig = {
    key: CACHE_KEYS.ADMIN_DEDUCTIONS_PACKET,
    validator: (data: any): data is DeductionRecord[] => Array.isArray(data),
  };
  
  const initialCachedEntries = typeof window !== 'undefined' 
    ? getCachedData<Entry[]>(packetCacheConfig) 
    : { data: null };
  const initialCachedDeductions = typeof window !== 'undefined'
    ? getCachedData<DeductionRecord[]>(packetDeductionsCacheConfig)
    : { data: null };
  
  const [entries, setEntries] = useState<Entry[]>(initialCachedEntries.data || []);
  const [deductions, setDeductions] = useState<DeductionRecord[]>(initialCachedDeductions.data || []);
  
  // Calculate initial stats from cached data
  const initialStats = initialCachedEntries.data ? {
    totalEntries: initialCachedEntries.data.length,
    firstPkr: initialCachedEntries.data.reduce((sum, e) => sum + (e.first_amount || 0), 0),
    secondPkr: initialCachedEntries.data.reduce((sum, e) => sum + (e.second_amount || 0), 0),
    totalPkr: initialCachedEntries.data.reduce((sum, e) => sum + (e.first_amount || e.second_amount || 0), 0),
    uniqueNumbers: new Set(initialCachedEntries.data.map(e => e.number)).size,
  } : {
    totalEntries: 0,
    firstPkr: 0,
    secondPkr: 0,
    totalPkr: 0,
    uniqueNumbers: 0,
  };
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);
  const [deletingDeductionIds, setDeletingDeductionIds] = useState<Set<string>>(new Set()); // Track deletions in progress
  const [viewMode, setViewMode] = useState<'aggregated' | 'history'>('aggregated');
  const [searchNumber, setSearchNumber] = useState('');
  const [showNumbersModal, setShowNumbersModal] = useState<{ numbers: string[]; title: string } | null>(null);
  const [stats, setStats] = useState(initialStats);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);

  const { showSuccess, showError } = useNotifications();
  const { setRefreshCallback } = useAdminRefresh();
  const confirm = useContext(ConfirmationContext);

  // Track if any modal is open to pause auto-refresh
  const isAnyModalOpenRef = React.useRef(false);
  
  React.useEffect(() => {
    isAnyModalOpenRef.current = !!(editingEntry || deletingEntry || showNumbersModal);
  }, [editingEntry, deletingEntry, showNumbersModal]);

  const loadEntries = useCallback(async (force = false, showLoader = true) => {
    // Skip refresh if modal is open (unless forced)
    if (!force && isAnyModalOpenRef.current) {
      console.log('⏸️ Skipping Packet refresh - modal is open');
      return;
    }

    // Cache already loaded in initial state - just fetch fresh data
    const cacheConfig = {
      key: CACHE_KEYS.ADMIN_PACKET_ENTRIES,
      validator: (data: any): data is Entry[] => Array.isArray(data),
    };
    const deductionsCacheConfig = {
      key: CACHE_KEYS.ADMIN_DEDUCTIONS_PACKET,
      validator: (data: any): data is DeductionRecord[] => Array.isArray(data),
    };

    // Show loader only if no data exists and loader requested
    if (showLoader && entries.length === 0) {
      setLoadingEntries(true);
    }

    // 2. Always fetch fresh data in background
    try {
      const [freshEntries, freshDeductions] = await Promise.all([
        db.getAllEntriesByType('packet', true),
        db.getAdminDeductionsByType('packet'),
      ]);

      setCachedData(cacheConfig, freshEntries);
      setCachedData(deductionsCacheConfig, freshDeductions);
      setEntries(freshEntries);
      setDeductions(freshDeductions);

      const firstPkr = freshEntries.reduce((sum, e) => sum + (e.first_amount || 0), 0);
      const secondPkr = freshEntries.reduce((sum, e) => sum + (e.second_amount || 0), 0);
      const uniqueNumbers = new Set(freshEntries.map(e => e.number)).size;

      setStats({
        totalEntries: freshEntries.length,
        firstPkr,
        secondPkr,
        totalPkr: firstPkr + secondPkr,
        uniqueNumbers,
      });
    } catch (error) {
      console.error('Error loading entries:', error);
      // If we have no data, show error
      if (entries.length === 0) {
        showError('Error', 'Failed to load entries');
      }
    } finally {
      if (showLoader) {
        setLoadingEntries(false);
      }
    }
  }, [showError, entries.length]);

  // Optimized search with debouncing for fast performance even on slow connections
  const debouncedSearchNumber = useDebounce(searchNumber, 200);
  const filteredEntries = useMemo(() => {
    if (!debouncedSearchNumber.trim()) return entries;
    const search = debouncedSearchNumber.trim().toLowerCase();
    return entries.filter(entry => entry.number.toLowerCase().includes(search));
  }, [entries, debouncedSearchNumber]);

  useEffect(() => {
    // Register refresh callback for the refresh button
    setRefreshCallback(() => loadEntries(true, true));
    
    // Initial load (cache already loaded in initial state, this updates it in background)
    loadEntries(true, !initialCachedEntries.data); // Only show loader if no cache

    // Set up real-time subscription for auto-updates (primary live source)
    if (supabase) {
      const subscription = supabase
        .channel('packet-entries-realtime')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'transactions', 
            filter: `entry_type=eq.packet` 
          },
          (payload: any) => {
            console.log('🔴 Real-time update received for Packet:', payload);
            loadEntries(false);
          }
        )
        .subscribe((status: string) => {
          console.log('📡 Packet subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Packet real-time subscription active');
          }
        });

      return () => {
        console.log('🔌 Unsubscribing from Packet real-time updates');
        subscription.unsubscribe();
      };
    }

    return () => {
      console.log('🔌 Cleaning up Packet effect (no auto-refresh interval to clear)');
    };
  }, [loadEntries, setRefreshCallback]);

  const handleDelete = async () => {
    if (!deletingEntry) return;

    // INSTANT: Optimistically update UI and cache immediately
    const entryToDelete = deletingEntry;
    setEntries(prev => prev.filter(e => e.id !== entryToDelete.id));
    
    // Update stats immediately
    setStats(prev => ({
      totalEntries: prev.totalEntries - 1,
      firstPkr: prev.firstPkr - (entryToDelete.first_amount || 0),
      secondPkr: prev.secondPkr - (entryToDelete.second_amount || 0),
      totalPkr: prev.totalPkr - ((entryToDelete.first_amount || 0) + (entryToDelete.second_amount || 0)),
      uniqueNumbers: new Set(entries.filter(e => e.id !== entryToDelete.id).map(e => e.number)).size,
    }));
    
    // Update cache immediately
    const updatedEntries = entries.filter(e => e.id !== entryToDelete.id);
    setCachedData(packetCacheConfig, updatedEntries);
    
    setDeletingEntry(null);

    try {
      // Refund the balance to the user
      const refundAmount = entryToDelete.first_amount + entryToDelete.second_amount;
      const { data: userData } = await db.getUserBalance(entryToDelete.user_id);
      if (!userData) {
        throw new Error('User data not found');
      }
      const newBalance = userData.balance + refundAmount;
      const newTotalSpent = Math.max(0, (userData.total_spent || 0) - refundAmount);
      await db.updateUserBalance(entryToDelete.user_id, newBalance, { totalSpent: newTotalSpent });

      // Delete the transaction
      await db.deleteTransaction(entryToDelete.id);
      await showSuccess('Success', 'Entry deleted successfully and balance refunded');
      
      // Refresh in background to ensure sync
      loadEntries(false, false);
    } catch (error) {
      console.error('Delete error:', error);
      // Rollback on error
      setEntries(prev => [...prev, entryToDelete]);
      setStats(prev => ({
        totalEntries: prev.totalEntries + 1,
        firstPkr: prev.firstPkr + (entryToDelete.first_amount || 0),
        secondPkr: prev.secondPkr + (entryToDelete.second_amount || 0),
        totalPkr: prev.totalPkr + ((entryToDelete.first_amount || 0) + (entryToDelete.second_amount || 0)),
        uniqueNumbers: new Set([...entries, entryToDelete].map(e => e.number)).size,
      }));
      setCachedData(packetCacheConfig, entries);
      showError('Error', 'Failed to delete entry');
    }
  };

  const [resetting, setResetting] = useState(false);

  const handleResetAll = async () => {
    if (!confirm) return;

    const result = await confirm(
      `Are you sure you want to RESET the Admin View for Packet entries?\n\nThis will PERMANENTLY DELETE:\n• All Packet transactions (0000)\n• All admin deductions for Packet entries\n\n⚠️ This will only affect Packet entries on this admin page.\n⚠️ Other entry types (Ring, Open, Akra) will NOT be affected.`,
      { type: 'danger', title: '🔄 Reset Admin View - Packet Entries Only' }
    );

    if (!result) return;

    setResetting(true);
    try {
      const result = await db.deleteAllAdminDeductionsByType('packet');
      await showSuccess('Success', `Reset admin view: Deleted ${result.deletedCount} Packet entries and all associated deductions.`);
      loadEntries(true); // Force reload after reset
    } catch (error) {
      console.error('Reset error:', error);
      showError('Error', 'Failed to reset admin view');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteDeduction = async (deduction: DeductionRecord) => {
    if (!confirm) return;

    // Prevent double deletion
    if (deletingDeductionIds.has(deduction.id)) {
      console.warn('⚠️ Deduction deletion already in progress');
      return;
    }

    const result = await confirm(
      `Are you sure you want to DELETE this deduction?\n\nNumber: ${deduction.transactions.number}\nUser: ${deduction.transactions.app_users.username}\nDeducted: F ${deduction.deducted_first}, S ${deduction.deducted_second}\n\nThis will restore the original amounts.`,
      { type: 'danger', title: '🗑️ Delete Deduction' }
    );

    if (!result) return;

    // Mark as deleting
    setDeletingDeductionIds(prev => new Set(prev).add(deduction.id));

    // INSTANT: Optimistically remove from UI and cache immediately
    setDeductions(prev => {
      const updated = prev.filter(d => d.id !== deduction.id);
      setCachedData(packetDeductionsCacheConfig, updated);
      return updated;
    });

    try {
      await db.deleteAdminDeduction(deduction.id);
      await showSuccess('Success', 'Deduction deleted successfully. Amounts have been restored.');
      // Refresh in background to ensure sync
      loadEntries(false, false);
    } catch (error) {
      console.error('Delete deduction error:', error);
      // Restore deduction on error
      setDeductions(prev => [...prev, deduction]);
      showError('Error', 'Failed to delete deduction');
    } finally {
      // Remove from deleting set
      setDeletingDeductionIds(prev => {
        const next = new Set(prev);
        next.delete(deduction.id);
        return next;
      });
    }
  };

  const handleDeleteDeductionGroup = async (deductions: DeductionRecord[]) => {
    if (!confirm) return;

    if (deductions.length === 1) {
      await handleDeleteDeduction(deductions[0]);
      return;
    }

    const result = await confirm(
      `Are you sure you want to DELETE ${deductions.length} deductions?\n\nThis will restore the original amounts for all affected entries.`,
      { type: 'danger', title: '🗑️ Delete Deductions' }
    );

    if (!result) return;

    const deductionIds = deductions.map(d => d.id);
    
    // Prevent double deletion
    const alreadyDeleting = deductionIds.some(id => deletingDeductionIds.has(id));
    if (alreadyDeleting) {
      console.warn('⚠️ Deduction deletion already in progress');
      showError('Error', 'Deletion already in progress. Please wait.');
      return;
    }

    // Mark all as deleting
    setDeletingDeductionIds(prev => {
      const next = new Set(prev);
      deductionIds.forEach(id => next.add(id));
      return next;
    });

    // INSTANT: Optimistically remove from UI and cache immediately
    const deductionIdSet = new Set(deductionIds);
    setDeductions(prev => {
      const updated = prev.filter(d => !deductionIdSet.has(d.id));
      setCachedData(packetDeductionsCacheConfig, updated);
      return updated;
    });

    try {
      // Delete all deductions in a single batch operation
      const deleteResult = await db.deleteAdminDeductionsBatch(deductionIds);
      
      if (deleteResult.failed > 0) {
        throw new Error(`Failed to delete ${deleteResult.failed} deductions`);
      }

      await showSuccess('Success', `Successfully deleted ${deductions.length} deductions. Amounts have been restored.`);
      // Refresh in background to ensure sync
      loadEntries(false, false);
    } catch (error: any) {
      console.error('Delete deductions error:', error);
      // Restore deductions on error
      setDeductions(prev => [...prev, ...deductions]);
      showError('Error', error?.message || 'Failed to delete deductions');
    } finally {
      // Remove from deleting set
      setDeletingDeductionIds(prev => {
        const next = new Set(prev);
        deductionIds.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const handleEdit = async (updatedTransaction: any) => {
    if (!editingEntry) return;

    // INSTANT: Optimistically update UI and cache immediately
    const oldEntry = editingEntry;
    const updatedEntry: Entry = {
      ...oldEntry,
      number: updatedTransaction.number || oldEntry.number,
      first_amount: updatedTransaction.first,
      second_amount: updatedTransaction.second,
    };
    
    setEntries(prev => prev.map(e => e.id === oldEntry.id ? updatedEntry : e));
    
    // Update stats immediately
    const oldTotal = oldEntry.first_amount + oldEntry.second_amount;
    const newTotal = updatedTransaction.first + updatedTransaction.second;
    const difference = newTotal - oldTotal;
    setStats(prev => ({
      ...prev,
      firstPkr: prev.firstPkr - oldEntry.first_amount + updatedTransaction.first,
      secondPkr: prev.secondPkr - oldEntry.second_amount + updatedTransaction.second,
      totalPkr: prev.totalPkr + difference,
    }));
    
    // Update cache immediately
    const updatedEntries = entries.map(e => e.id === oldEntry.id ? updatedEntry : e);
    setCachedData(packetCacheConfig, updatedEntries);
    
    setEditingEntry(null);

    try {
      // Calculate balance difference
      const difference = newTotal - oldTotal;

      // Get current user balance
      const { data: userData } = await db.getUserBalance(oldEntry.user_id);
      if (!userData) {
        throw new Error('User data not found');
      }
      const newBalance = userData.balance - difference;

      // Update user balance
      const newTotalSpent = Math.max(0, (userData.total_spent || 0) + difference);
      await db.updateUserBalance(oldEntry.user_id, newBalance, { totalSpent: newTotalSpent });

      // Update transaction
      await db.updateTransaction(oldEntry.id, {
        first: updatedTransaction.first,
        second: updatedTransaction.second,
        notes: updatedTransaction.notes,
      });

      await showSuccess('Success', 'Entry updated successfully');
      
      // Refresh in background to ensure sync
      loadEntries(false, false);
    } catch (error) {
      console.error('Edit error:', error);
      // Rollback on error
      setEntries(prev => prev.map(e => e.id === oldEntry.id ? oldEntry : e));
      setStats(prev => ({
        ...prev,
        firstPkr: prev.firstPkr - updatedTransaction.first + oldEntry.first_amount,
        secondPkr: prev.secondPkr - updatedTransaction.second + oldEntry.second_amount,
        totalPkr: prev.totalPkr - difference,
      }));
      setCachedData(packetCacheConfig, entries);
      showError('Error', 'Failed to update entry');
    }
  };

  const getUserColor = (userId: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    ];
    const index = parseInt(userId.slice(-1), 16) % colors.length;
    return colors[index];
  };

  // Group entries by number for aggregated view
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, Entry[]>();
    filteredEntries.forEach(entry => {
      if (!groups.has(entry.number)) {
        groups.set(entry.number, []);
      }
      groups.get(entry.number)!.push(entry);
    });
    return groups;
  }, [filteredEntries]);

  // Group deductions by filter_save_id (for filter saves) or timestamp (within 2 seconds for others)
  const groupedDeductions = useMemo(() => {
    const groups: { deductions: DeductionRecord[], displayData: any }[] = [];
    const processedIds = new Set<string>();
    
    // First, group filter_save deductions by filter_save_id
    const filterSaveGroups = new Map<string, DeductionRecord[]>();
    const nonFilterDeductions: DeductionRecord[] = [];
    
    deductions.forEach(deduction => {
      // Check if this is a filter_save deduction with filter_save_id
      const filterSaveId = deduction.metadata?.filter_save_id;
      if (deduction.deduction_type === 'filter_save' && filterSaveId) {
        if (!filterSaveGroups.has(filterSaveId)) {
          filterSaveGroups.set(filterSaveId, []);
        }
        filterSaveGroups.get(filterSaveId)!.push(deduction);
      } else {
        nonFilterDeductions.push(deduction);
      }
    });
    
    // Process filter_save groups (all deductions with same filter_save_id are one group)
    filterSaveGroups.forEach((filterDeductions) => {
      const totalFirst = filterDeductions.reduce((sum, d) => sum + d.deducted_first, 0);
      const totalSecond = filterDeductions.reduce((sum, d) => sum + d.deducted_second, 0);
      const displayNumbers = filterDeductions.map(d => d.transactions.number).join(', ');
      
      groups.push({
        deductions: filterDeductions,
        displayData: {
          numbers: displayNumbers,
          first: totalFirst,
          second: totalSecond,
          total: totalFirst + totalSecond,
          count: filterDeductions.length,
          timestamp: filterDeductions[0].created_at,
          admin: filterDeductions[0].admin.username,
          isFilterSave: true,
        }
      });
      
      filterDeductions.forEach(d => processedIds.add(d.id));
    });
    
    // Process non-filter deductions by timestamp (within 2 seconds)
    nonFilterDeductions.forEach(deduction => {
      if (processedIds.has(deduction.id)) return;
      
      const createdTime = new Date(deduction.created_at).getTime();
      const similarDeductions = nonFilterDeductions.filter(d => {
        if (processedIds.has(d.id)) return false;
        const dTime = new Date(d.created_at).getTime();
        const timeDiff = Math.abs(createdTime - dTime);
        return timeDiff < 2000; // Within 2 seconds
      });
      
      // Mark all similar deductions as processed
      similarDeductions.forEach(d => processedIds.add(d.id));
      
      if (similarDeductions.length > 1) {
        const totalFirst = similarDeductions.reduce((sum, d) => sum + d.deducted_first, 0);
        const totalSecond = similarDeductions.reduce((sum, d) => sum + d.deducted_second, 0);
        const displayNumbers = similarDeductions.map(d => d.transactions.number).join(', ');
        
        groups.push({
          deductions: similarDeductions,
          displayData: {
            numbers: displayNumbers,
            first: totalFirst,
            second: totalSecond,
            total: totalFirst + totalSecond,
            count: similarDeductions.length,
            timestamp: deduction.created_at,
            admin: deduction.admin.username,
          }
        });
      } else {
        groups.push({
          deductions: similarDeductions,
          displayData: {
            numbers: deduction.transactions.number,
            first: deduction.deducted_first,
            second: deduction.deducted_second,
            total: deduction.deducted_first + deduction.deducted_second,
            count: 1,
            timestamp: deduction.created_at,
            admin: deduction.admin.username,
          }
        });
      }
    });
    
    return groups;
  }, [deductions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📦 Packet Entries (All Users)
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage all packet entries across all users
          </p>
        </div>

        {/* View Mode Toggle & Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 sm:mb-0">View Mode</h2>
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('aggregated')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'aggregated'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Aggregated
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'history'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  History
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔍 Search Number
              </label>
              <input
                type="text"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                placeholder="e.g., 1234, 5678..."
                className="w-full sm:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Reset All Button */}
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-transparent mb-2">.</label>
              <LoadingButton
                onClick={handleResetAll}
                loading={resetting}
                variant="warning"
                className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset Admin View
              </LoadingButton>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Entries</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEntries}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">First PKR</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.firstPkr.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Second PKR</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.secondPkr.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total PKR</p>
            <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
              {stats.totalPkr.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Unique Numbers</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.uniqueNumbers}
            </p>
          </div>
        </div>

        {/* Entries Display */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          {viewMode === 'aggregated' ? (
            /* Aggregated View - Unique Numbers with Combined Totals */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Number
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      First
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Second
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Users
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {Array.from(groupedEntries.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([number, numberEntries]) => {
                      const firstTotal = numberEntries.reduce((sum, e) => sum + (e.first_amount || 0), 0);
                      const secondTotal = numberEntries.reduce((sum, e) => sum + (e.second_amount || 0), 0);
                      const total = firstTotal + secondTotal;
                      const userCount = numberEntries.length;
                      
                      return (
                        <tr key={number} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-bold text-lg text-gray-900 dark:text-white">
                              {number}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {firstTotal.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {secondTotal.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                              {total.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                              {userCount} {userCount === 1 ? 'user' : 'users'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            /* History View */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Number
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      First
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Second
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {(() => {
                  // Combine entries and deductions into a single array
                  const entryItems = filteredEntries.map(entry => ({
                    type: 'entry' as const,
                    id: entry.id,
                    timestamp: new Date(entry.created_at).getTime(),
                    data: entry
                  }));
                  
                  const deductionItems = groupedDeductions
                    .filter(g => !searchNumber.trim() || g.displayData.numbers.toLowerCase().includes(searchNumber.trim().toLowerCase()))
                    .map(group => ({
                      type: 'deduction' as const,
                      id: `deduction-group-${group.deductions[0].id}`,
                      timestamp: new Date(group.displayData.timestamp).getTime(),
                      data: group
                    }));
                  
                  // Combine and sort by timestamp (newest first)
                  const combinedItems = [...entryItems, ...deductionItems]
                    .sort((a, b) => b.timestamp - a.timestamp);
                  
                  return combinedItems.map((item) => {
                    if (item.type === 'entry') {
                      const entry = item.data;
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getUserColor(entry.user_id)}`}>
                                {entry.app_users.username}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {entry.number}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {entry.first_amount.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {entry.second_amount.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                              {(entry.first_amount + entry.second_amount).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {new Date(entry.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setEditingEntry(entry)}
                                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeletingEntry(entry)}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    } else {
                      const group = item.data;
                      return (
                        <tr key={item.id} className="bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors border-l-4 border-orange-500">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                                {group.deductions[0].transactions.app_users.username}
                              </span>
                              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded">
                                DEDUCTION
                              </span>
                              {group.displayData.count > 1 && (
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded font-semibold">
                                  {group.displayData.count} deductions
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {(() => {
                                const allNumbers = group.displayData.numbers.split(', ').map((n: string) => n.trim());
                                const maxDisplay = 10;
                                const displayNumbers = allNumbers.slice(0, maxDisplay);
                                const hasMore = allNumbers.length > maxDisplay;
                                
                                return (
                                  <>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      {displayNumbers.join(', ')}
                                      {hasMore && ` ...`}
                                    </span>
                                    {hasMore && (
                                      <button
                                        onClick={() => setShowNumbersModal({
                                          numbers: allNumbers,
                                          title: `All Numbers (${allNumbers.length} total)`
                                        })}
                                        className="px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                                      >
                                        Show More ({allNumbers.length - maxDisplay} more)
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-red-600 dark:text-red-400 font-semibold">
                              -{group.displayData.first.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-red-600 dark:text-red-400 font-semibold">
                              -{group.displayData.second.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-red-600 dark:text-red-400 font-bold">
                              -{group.displayData.total.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex flex-col">
                              <span>{new Date(group.displayData.timestamp).toLocaleString()}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-500">
                                by {group.displayData.admin}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <LoadingButton
                              onClick={() => handleDeleteDeductionGroup(group.deductions)}
                              loading={group.deductions.some(d => deletingDeductionIds.has(d.id))}
                              disabled={group.deductions.some(d => deletingDeductionIds.has(d.id))}
                              variant="danger"
                              size="sm"
                              className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={`Delete ${group.displayData.count > 1 ? 'All ' + group.displayData.count + ' Deductions' : 'Deduction'}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </LoadingButton>
                          </td>
                        </tr>
                      );
                    }
                  });
                })()}
              </tbody>
            </table>
            </div>
          )}

            {loadingEntries ? (
              <div className="space-y-4">
                {[...Array(10)].map((_, idx) => (
                  <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="bg-gray-200 dark:bg-gray-700 h-4 w-1/4 rounded" />
                        <div className="bg-gray-200 dark:bg-gray-700 h-4 w-1/3 rounded" />
                      </div>
                      <div className="space-y-2">
                        <div className="bg-gray-200 dark:bg-gray-700 h-4 w-20 rounded" />
                        <div className="bg-gray-200 dark:bg-gray-700 h-4 w-16 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  {searchNumber ? 'No entries match your search' : 'No packet entries found'}
                </p>
              </div>
            ) : null}
        </div>
      </div>

      {/* Edit Modal */}
      {editingEntry && (
        <EditTransactionModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          transaction={{
            id: editingEntry.id,
            number: editingEntry.number,
            first: editingEntry.first_amount,
            second: editingEntry.second_amount,
            notes: '',
            entryType: 'packet' as any,
            projectId: 'admin',
            createdAt: editingEntry.created_at,
            updatedAt: editingEntry.created_at,
          }}
          onSave={handleEdit}
          transactions={entries.map(e => ({
            id: e.id,
            number: e.number,
            first: e.first_amount,
            second: e.second_amount,
            notes: '',
            entryType: 'packet' as any,
            projectId: 'admin',
            createdAt: e.created_at,
            updatedAt: e.created_at,
          }))}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingEntry && (
        <DeleteConfirmationModal
          isOpen={!!deletingEntry}
          onClose={() => setDeletingEntry(null)}
          onConfirm={handleDelete}
          title="Delete Packet Entry"
          message="Are you sure you want to delete this packet entry?"
          itemName={`Number: ${deletingEntry.number} (${deletingEntry.app_users.username})`}
        />
      )}

      {/* Numbers Modal */}
      {showNumbersModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNumbersModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {showNumbersModal.title}
              </h3>
              <button
                onClick={() => setShowNumbersModal(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                {showNumbersModal.numbers.map((number, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-center text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    {number}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowNumbersModal(null)}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders on slow connections
export default React.memo(AdminPacketPage);



