import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { db } from '../../services/database';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAdminRefresh } from '../../contexts/AdminRefreshContext';
import { ConfirmationContext } from '../../App';
import EditTransactionModal from '../../components/EditTransactionModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';

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

const AdminOpenPage: React.FC = () => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [deductions, setDeductions] = useState<DeductionRecord[]>([]);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);
  const [viewMode, setViewMode] = useState<'aggregated' | 'history'>('aggregated');
  const [searchNumber, setSearchNumber] = useState('');
  const [stats, setStats] = useState({
    totalEntries: 0,
    firstPkr: 0,
    secondPkr: 0,
    totalPkr: 0,
    uniqueNumbers: 0,
  });

  const { showSuccess, showError } = useNotifications();
  const { setRefreshCallback } = useAdminRefresh();
  const confirm = useContext(ConfirmationContext);

  // Track if any modal is open to pause auto-refresh
  const isAnyModalOpenRef = React.useRef(false);
  
  React.useEffect(() => {
    isAnyModalOpenRef.current = !!(editingEntry || deletingEntry);
  }, [editingEntry, deletingEntry]);

  const loadEntries = useCallback(async (force = false) => {
    // Skip refresh if modal is open (unless forced)
    if (!force && isAnyModalOpenRef.current) {
      console.log('⏸️ Skipping Open refresh - modal is open');
      return;
    }

    try {
      // Use adminView=true to apply admin deductions
      const data = await db.getAllEntriesByType('open', true);
      setEntries(data);

      // Load deduction records
      const deductionData = await db.getAdminDeductionsByType('open');
      setDeductions(deductionData);

      // Calculate stats
      const firstPkr = data.reduce((sum, e) => sum + (e.first_amount || 0), 0);
      const secondPkr = data.reduce((sum, e) => sum + (e.second_amount || 0), 0);
      const uniqueNumbers = new Set(data.map(e => e.number)).size;

      setStats({
        totalEntries: data.length,
        firstPkr,
        secondPkr,
        totalPkr: firstPkr + secondPkr,
        uniqueNumbers,
      });
    } catch (error) {
      console.error('Error loading entries:', error);
      showError('Error', 'Failed to load entries');
    }
  }, [showError]); // Remove modal states from dependencies, use ref instead

  // Filter entries by search
  const filteredEntries = useMemo(() => {
    if (!searchNumber.trim()) return entries;
    const search = searchNumber.trim().toLowerCase();
    return entries.filter(entry => entry.number.toLowerCase().includes(search));
  }, [entries, searchNumber]);

  useEffect(() => {
    // Register refresh callback for the refresh button
    setRefreshCallback(loadEntries);
    
    // Initial load
    loadEntries();

    // Auto-refresh every 5 seconds
    const autoRefreshInterval = setInterval(() => {
      loadEntries();
    }, 5000);

    // Set up real-time subscription for auto-updates
    if (supabase) {
      const subscription = supabase
        .channel('open-entries-realtime')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'transactions', 
            filter: `entry_type=eq.open` 
          },
          (payload: any) => {
            console.log('🔴 Real-time update received for Open:', payload);
            loadEntries();
          }
        )
        .subscribe((status: string) => {
          console.log('📡 Open subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Open real-time subscription active');
          }
        });

      return () => {
        console.log('🔌 Unsubscribing from Open real-time updates');
        clearInterval(autoRefreshInterval);
        subscription.unsubscribe();
      };
    }

    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, [loadEntries, setRefreshCallback]);

  const handleDelete = async () => {
    if (!deletingEntry) return;

    try {

      // Refund the balance to the user
      const refundAmount = deletingEntry.first_amount + deletingEntry.second_amount;
      const { data: userData } = await db.getUserBalance(deletingEntry.user_id);
      if (!userData) {
        throw new Error('User data not found');
      }
      const newBalance = userData.balance + refundAmount;
      const newTotalSpent = Math.max(0, (userData.total_spent || 0) - refundAmount);
      await db.updateUserBalance(deletingEntry.user_id, newBalance, { totalSpent: newTotalSpent });

      // Delete the transaction
      await db.deleteTransaction(deletingEntry.id);
      await showSuccess('Success', 'Entry deleted successfully and balance refunded');
      
      setDeletingEntry(null);
      loadEntries(true); // Force reload after delete
    } catch (error) {
      console.error('Delete error:', error);
      showError('Error', 'Failed to delete entry');
    } finally {
    }
  };

  const handleResetAll = async () => {
    if (!confirm) return;

    const result = await confirm(
      `Are you sure you want to DELETE ALL OPEN ENTRIES?\n\nThis will permanently delete ${stats.totalEntries} entries across all users.\n\nThis action CANNOT be undone!`,
      { type: 'danger', title: '🚨 Reset All Open Entries' }
    );

    if (!result) return;

    try {
      await db.deleteAllEntriesByType('open');
      await showSuccess('Success', `All ${stats.totalEntries} Open entries have been deleted`);
      loadEntries(true); // Force reload after reset
    } catch (error) {
      console.error('Reset error:', error);
      showError('Error', 'Failed to reset Open entries');
    }
  };

  const handleDeleteDeduction = async (deduction: DeductionRecord) => {
    if (!confirm) return;

    const result = await confirm(
      `Are you sure you want to DELETE this deduction?\n\nNumber: ${deduction.transactions.number}\nUser: ${deduction.transactions.app_users.username}\nDeducted: F ${deduction.deducted_first}, S ${deduction.deducted_second}\n\nThis will restore the original amounts.`,
      { type: 'danger', title: '🗑️ Delete Deduction' }
    );

    if (!result) return;

    try {
      await db.deleteAdminDeduction(deduction.id);
      await showSuccess('Success', 'Deduction deleted successfully. Amounts have been restored.');
      loadEntries(true); // Force reload after delete
    } catch (error) {
      console.error('Delete deduction error:', error);
      showError('Error', 'Failed to delete deduction');
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

    try {
      for (const deduction of deductions) {
        await db.deleteAdminDeduction(deduction.id);
      }
      await showSuccess('Success', `Successfully deleted ${deductions.length} deductions. Amounts have been restored.`);
      loadEntries(true); // Force reload after delete
    } catch (error) {
      console.error('Delete deductions error:', error);
      showError('Error', 'Failed to delete deductions');
    }
  };

  const handleEdit = async (updatedTransaction: any) => {
    if (!editingEntry) return;

    try {
      // Calculate balance difference
      const oldTotal = editingEntry.first_amount + editingEntry.second_amount;
      const newTotal = updatedTransaction.first + updatedTransaction.second;
      const difference = newTotal - oldTotal;

      // Get current user balance
      const { data: userData } = await db.getUserBalance(editingEntry.user_id);
      if (!userData) {
        throw new Error('User data not found');
      }
      const newBalance = userData.balance - difference;
      const newTotalSpent = Math.max(0, (userData.total_spent || 0) + difference);

      // Update user balance
      await db.updateUserBalance(editingEntry.user_id, newBalance, { totalSpent: newTotalSpent });

      // Update transaction
      await db.updateTransaction(editingEntry.id, {
        number: updatedTransaction.number || editingEntry.number,
        entryType: updatedTransaction.entryType || 'open',
        first: updatedTransaction.first,
        second: updatedTransaction.second,
        notes: updatedTransaction.notes,
      });

      await showSuccess('Success', 'Entry updated successfully');
      setEditingEntry(null);
      loadEntries(true); // Force reload after edit
    } catch (error) {
      console.error('Edit error:', error);
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

  // Group deductions by timestamp (within 2 seconds)
  const groupedDeductions = useMemo(() => {
    const groups: { deductions: DeductionRecord[], displayData: any }[] = [];
    const processedIds = new Set<string>();
    
    deductions.forEach(deduction => {
      if (processedIds.has(deduction.id)) return;
      
      const createdTime = new Date(deduction.created_at).getTime();
      const similarDeductions = deductions.filter(d => {
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
            📄 Open Entries (All Users)
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage all open entries across all users
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
                placeholder="e.g., 1, 2, 3..."
                className="w-full sm:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Reset All Button */}
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-transparent mb-2">.</label>
              <button
                onClick={handleResetAll}
                className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Reset All
              </button>
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
                {filteredEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((entry) => (
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
                ))}
                
                {/* Deduction Records - Show at TOP (most recent first) */}
                {groupedDeductions
                  .filter(g => !searchNumber.trim() || g.displayData.numbers.toLowerCase().includes(searchNumber.trim().toLowerCase()))
                  .sort((a, b) => new Date(b.displayData.timestamp).getTime() - new Date(a.displayData.timestamp).getTime())
                  .map((group, groupIndex) => (
                  <tr key={`deduction-group-${groupIndex}`} className="bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors border-l-4 border-orange-500">
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {group.displayData.numbers}
                      </span>
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
                      <button
                        onClick={() => handleDeleteDeductionGroup(group.deductions)}
                        className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1"
                        title={`Delete ${group.displayData.count > 1 ? 'All ' + group.displayData.count + ' Deductions' : 'Deduction'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

            {filteredEntries.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  {searchNumber ? 'No entries match your search' : 'No open entries found'}
                </p>
              </div>
            )}
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
            entryType: 'open' as any,
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
            entryType: 'open' as any,
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
          title="Delete Open Entry"
          message="Are you sure you want to delete this open entry?"
          itemName={`Number: ${deletingEntry.number} (${deletingEntry.app_users.username})`}
        />
      )}
    </div>
  );
};

export default AdminOpenPage;



