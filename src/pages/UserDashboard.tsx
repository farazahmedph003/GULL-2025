import React, { useState, useEffect, useCallback } from 'react';
import ProjectHeader from '../components/ProjectHeader';
import StandardEntry from '../components/StandardEntry';
import IntelligentEntry from '../components/IntelligentEntry';
import UserHistoryPanel from '../components/UserHistoryPanel';
import EntryFormsBar from '../components/EntryFormsBar';
import EditTransactionModal from '../components/EditTransactionModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { useTransactions } from '../hooks/useTransactions';
import { useUserBalance } from '../hooks/useUserBalance';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
// formatDate import removed - not needed
import { playReloadSound } from '../utils/audioFeedback';
import { formatCurrency } from '../utils/helpers';
import { exportUserTransactionsToPDF } from '../utils/pdfExport';
import type { Project, EntryType, Transaction, AddedEntrySummary } from '../types';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useUserRealtimeSubscriptions } from '../hooks/useRealtimeSubscriptions';
import { supabase } from '../lib/supabase';
import { db } from '../services/database';

type TabType = 'all' | 'open' | 'akra' | 'ring' | 'packet';
type RecentHighlight = AddedEntrySummary;

const UserDashboard: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [entryTab, setEntryTab] = useState<'standard' | 'intelligent'>('standard');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [recentHighlights, setRecentHighlights] = useState<RecentHighlight[]>([]);
  const { showSuccess, showError } = useNotifications();
  const { user } = useAuth();

  const { 
    transactions,
    refresh: refreshTransactions, 
    getStatistics: _getStatistics, 
    addTransaction, 
    deleteTransaction,
    bulkDeleteTransactions,
    updateTransaction,
  } = useTransactions('user-scope');
  
  const { refresh: refreshBalance } = useUserBalance();
  const { entriesEnabled, refresh: refreshSettings } = useSystemSettings();
  
  // Log entries enabled/disabled state changes
  useEffect(() => {
    // Entries state tracking removed for production
  }, [entriesEnabled]);
  
  // Silent refresh without sound for background updates
  const silentRefresh = useCallback(() => {
    refreshTransactions();
    refreshBalance();
    
    // Trigger UserHistoryPanel refresh
    setRefreshTrigger(Date.now());
    
    // Dispatch global event to refresh all balance displays
    window.dispatchEvent(new CustomEvent('user-balance-updated', { 
      detail: { userId: user?.id } 
    }));
  }, [refreshTransactions, refreshBalance, user?.id]);

  // Comprehensive refresh function
  const refresh = useCallback(() => {
    playReloadSound();
    silentRefresh();
  }, [transactions.length, silentRefresh]);

  // Auto-refresh balance and transactions every 5 seconds
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      silentRefresh();
    }, 5000); // 5 seconds for regular updates

    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, [silentRefresh]);

  // const statistics = getStatistics();

  // Filter tab entry type state removed; not used in this view
  // Removed unused filter summaries to satisfy strict unused checks

  // Compute per-type stats for header boxes
  const computeTypeStats = (type: EntryType) => {
    const filtered = transactions.filter(t => t.entryType === type);
    const firstTotal = filtered.reduce((sum, t) => sum + (t.first || 0), 0);
    const secondTotal = filtered.reduce((sum, t) => sum + (t.second || 0), 0);
    // Unique numbers leveraging grouping (handles bulk entries correctly)
    const summaries = groupTransactionsByNumber(transactions, type);
    const uniqueNumbers = summaries.size;
    return {
      firstTotal,
      secondTotal,
      totalPkr: firstTotal + secondTotal,
      uniqueNumbers,
    };
  };

  // Removed unused handleFilterSaveForType to satisfy strict unused checks

  // Projectless: set a virtual project for UI titles only
  useEffect(() => {
    // Format today's date as "MMM DD, YYYY" (e.g., "Oct 27, 2025")
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    setProject({ id: 'virtual', name: formattedDate, date: new Date().toISOString(), entryTypes: ['open','akra','ring','packet'], createdAt: '', updatedAt: '' });
  }, []);

  // Real-time subscriptions for instant updates
  useUserRealtimeSubscriptions(user?.id, silentRefresh);

  // Subscribe to user account status changes (deactivation)
  useEffect(() => {
    if (!user?.id || !supabase) return;

    const userStatusSubscription = supabase
      .channel('user-status-changes')
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_users',
          filter: `id=eq.${user.id}`
        },
        (payload: any) => {
          // Check if user was deactivated
          if (payload.new && payload.new.is_active === false) {
            alert('⚠️ Your account has been deactivated by an administrator. You will be logged out.');
            // Force logout
            window.location.href = '/login';
          }
        }
      )
      .subscribe();

    return () => {
      userStatusSubscription.unsubscribe();
    };
  }, [user?.id]);

  // Auto-check user status and system settings every 2 seconds (fallback for real-time)
  useEffect(() => {
    if (!user?.id) return;

    const checkUserStatus = async () => {
      try {
        // Use database service which has proper admin access
        const { data: userData, error } = await db.getUserBalance(user.id);

        if (error) {
          console.error('❌ Error checking user status:', error);
          return;
        }

        // Check if user account is active
        if (userData && 'is_active' in userData && userData.is_active === false) {
          alert('⚠️ Your account has been deactivated by an administrator. You will be logged out.');
          // Clear any stored data
          localStorage.clear();
          sessionStorage.clear();
          // Force logout
          window.location.href = '/login';
          return;
        }

        // Also refresh system settings to ensure entries toggle is up-to-date
        refreshSettings();
      } catch (err) {
        console.error('❌ Error in status check:', err);
      }
    };

    // Check immediately on mount
    checkUserStatus();

    // Then check every 5 seconds
    const statusCheckInterval = setInterval(() => {
      checkUserStatus();
    }, 5000); // 5 seconds

    return () => {
      clearInterval(statusCheckInterval);
    };
  }, [user?.id, refreshSettings]);

  // Keyboard shortcuts removed for regular users

  const registerHighlights = useCallback((summary?: AddedEntrySummary[]) => {
    if (!summary || summary.length === 0) {
      return;
    }
    setRecentHighlights(summary);
  }, []);

  const handleEntryAdded = (summary?: AddedEntrySummary[]) => {
    registerHighlights(summary);
    refresh();
  };

  const handleEditSave = async (updatedTransaction: Transaction) => {
    if (!editingTransaction) return;

    try {
      // Update transaction (updateTransaction will handle balance adjustments automatically)
      await updateTransaction(editingTransaction.id, updatedTransaction);
      
      setEditingTransaction(null);
      silentRefresh();
      showSuccess('Success', 'Transaction updated successfully');
    } catch (error) {
      console.error('Edit error:', error);
      showError('Error', 'Failed to update transaction');
    }
  };

  const handleDelete = async () => {
    if (!deletingTransaction || isDeleting) return;

    setIsDeleting(true);
    try {

      // Check if this is a batch delete (groupedIds array passed as metadata)
      const groupedIds = (deletingTransaction as any).groupedIds;
      
      if (groupedIds && Array.isArray(groupedIds) && groupedIds.length > 1) {
        // Batch delete - use bulkDeleteTransactions to refund total amount correctly
        console.log(`🗑️ Batch deleting ${groupedIds.length} entries...`);
        
        const success = await bulkDeleteTransactions(groupedIds);
        
        if (success) {
          setDeletingTransaction(null);
          silentRefresh();
          
          // Calculate total refund for user feedback
          const deletedTransactions = transactions.filter(t => groupedIds.includes(t.id));
          const totalRefund = deletedTransactions.reduce((sum, t) => sum + (t.first || 0) + (t.second || 0), 0);
          
          showSuccess('Batch Delete Success', `Deleted ${groupedIds.length} entries and refunded ${formatCurrency(totalRefund)}`);
        } else {
          throw new Error('Failed to delete transactions');
        }
      } else {
        // Single delete
        await deleteTransaction(deletingTransaction.id);
        
        setDeletingTransaction(null);
        silentRefresh();
        showSuccess('Success', 'Transaction deleted successfully and balance refunded');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showError('Error', 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export handlers
  const handleExportPDF = async () => {
    if (!project) return;
    try {
      await exportUserTransactionsToPDF(transactions, project.name);
      showSuccess('Export Successful', `Exported ${transactions.length} transactions to PDF`);
    } catch (error) {
      console.error('PDF export error:', error);
      showError('Export Failed', 'Failed to export transactions to PDF');
    }
  };


  const tabs = [
    { id: 'all' as TabType, label: 'ALL', description: 'All entries' },
    { id: 'open' as TabType, label: '0', description: 'Open entries' },
    { id: 'akra' as TabType, label: '00', description: '2-digit entries' },
    { id: 'ring' as TabType, label: '000', description: '3-digit entries' },
    { id: 'packet' as TabType, label: '0000', description: 'Packet entries' },
  ];

  if (!project) {
    return null; // Will initialize instantly
  }

  return (
    <>
      <ProjectHeader
        projectName={project.name}
        showTabs={true}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as TabType)}
        showBackButton={false}
        variant="user"
        onRefresh={silentRefresh}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20 sm:pb-0">
        <div className="w-full px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
          
          {/* Page Header */}
          <div className="mb-6 sm:mb-8">
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Track your entries with real-time calculations</p>
          </div>


          {/* Statistics Summary - only for entry-specific tabs (open/akra/ring/packet). None on ALL or FILTER */}
          {(['open','akra','ring','packet'] as EntryType[]).includes(activeTab as EntryType) && (
            (() => {
              const s = computeTypeStats(activeTab as EntryType);
              return (
                <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-700 dark:text-gray-100">FIRST PKR TOTAL</h3>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-300">PKR {s.firstTotal.toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-700 dark:text-gray-100">SECOND PKR TOTAL</h3>
                    <p className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-300">PKR {s.secondTotal.toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-700 dark:text-gray-100">TOTAL PKR</h3>
                    <p className="text-lg sm:text-2xl font-bold text-cyan-600 dark:text-cyan-300">PKR {(s.totalPkr).toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-700 dark:text-gray-100">UNIQUE NUMBER</h3>
                    <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-300">{s.uniqueNumbers}</p>
                  </div>
                </div>
              );
            })()
          )}

          {/* Content Panels */}
          {
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Left Panel - History (moved from right) */}
              <UserHistoryPanel 
                transactions={transactions}
                activeTab={activeTab}
                onEdit={(t) => setEditingTransaction(t)}
                onDelete={(transactionId, groupedIds) => {
                  const transaction = transactions.find(t => t.id === transactionId);
                  if (transaction) {
                    // If groupedIds are provided, attach them to the transaction for batch delete
                    if (groupedIds && groupedIds.length > 0) {
                      setDeletingTransaction({ ...transaction, groupedIds } as any);
                    } else {
                    setDeletingTransaction(transaction);
                    }
                  }
                }}
                onExportPDF={handleExportPDF}
                refreshTrigger={refreshTrigger}
                isPartner={user?.isPartner || false}
                isDeleting={isDeleting}
                recentHighlights={recentHighlights}
              />

              {/* Right Panel - Entry Panel (moved from bottom) */}
              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Add Entry
                    </h3>
                    
                    {/* Entry Mode Toggle */}
                    {entriesEnabled && (
                      <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button
                          onClick={() => setEntryTab('standard')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            entryTab === 'standard'
                              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          Standard
                        </button>
                        <button
                          onClick={() => setEntryTab('intelligent')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            entryTab === 'intelligent'
                              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          Intelligent
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    {!entriesEnabled ? (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-yellow-800 dark:text-yellow-200">
                        <div className="flex items-center justify-between">
                          <span>Entries are temporarily disabled by admin.</span>
                          <button
                            onClick={() => {
                              refreshSettings();
                            }}
                            className="ml-4 px-3 py-1 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded text-sm hover:bg-yellow-300 dark:hover:bg-yellow-700"
                          >
                            Refresh
                          </button>
                        </div>
                      </div>
                    ) : entryTab === 'standard' ? (
                      <StandardEntry
                        projectId={'user-scope'}
                        addTransaction={addTransaction}
                        transactions={transactions}
                        onSuccess={(summary) => {
                          registerHighlights(summary);
                          // Parent state is already updated via addTransaction. Keep a light refresh to sync balances.
                          // Small delay to let database trigger complete, then reconcile spent
                          setTimeout(() => {
                            refreshBalance();
                          }, 500);
                        }}
                      />
                    ) : (
                      <IntelligentEntry
                        projectId={'user-scope'}
                        entryType={project.entryTypes[0] || 'akra'}
                        addTransaction={addTransaction}
                        transactions={transactions}
                        onSuccess={(summary) => {
                          registerHighlights(summary);
                          // Refresh balance immediately, but delay transaction refresh to allow database commit
                          refreshBalance();
                          // Delay transaction refresh to ensure database has committed the new transaction
                          setTimeout(() => {
                            refreshTransactions();
                            setRefreshTrigger(Date.now());
                          }, 1000); // 1 second delay to allow database commit
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      {/* Entry Forms Bar - Mobile Only */}
      <div className="sm:hidden">
        <EntryFormsBar
          projectId={'user-scope'}
          entryType={project?.entryTypes?.[0] || 'akra'}
          addTransaction={addTransaction}
          transactions={transactions}
          onEntryAdded={handleEntryAdded}
        />
      </div>

      {/* Edit Modal */}
      {editingTransaction && (
        <EditTransactionModal
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          transaction={editingTransaction}
          onSave={handleEditSave}
          transactions={transactions}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTransaction && (
        <DeleteConfirmationModal
          isOpen={!!deletingTransaction}
          onClose={() => setDeletingTransaction(null)}
          onConfirm={handleDelete}
          title="Delete Transaction"
          message="Are you sure you want to delete this transaction?"
          itemName={`Number: ${deletingTransaction.number} (${deletingTransaction.entryType})`}
          isDeleting={isDeleting}
        />
      )}

    </>
  );
};

export default UserDashboard;
