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
import { formatDate } from '../utils/helpers';
import { playReloadSound } from '../utils/audioFeedback';
import { exportUserTransactionsToPDF } from '../utils/pdfExport';
import type { Project, EntryType, Transaction } from '../types';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useUserRealtimeSubscriptions } from '../hooks/useRealtimeSubscriptions';
import { supabase } from '../lib/supabase';
import { db } from '../services/database';

type TabType = 'all' | 'open' | 'akra' | 'ring' | 'packet';

const UserDashboard: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [entryTab] = useState<'standard' | 'intelligent'>('standard');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const { showSuccess, showError } = useNotifications();
  const { user } = useAuth();

  const { 
    transactions,
    refresh: refreshTransactions, 
    getStatistics: _getStatistics, 
    addTransaction, 
    deleteTransaction,
    updateTransaction,
  } = useTransactions('user-scope');
  
  const { refresh: refreshBalance } = useUserBalance();
  const { entriesEnabled, refresh: refreshSettings } = useSystemSettings();
  
  // Log entries enabled/disabled state changes
  useEffect(() => {
    console.log('🎛️ Entries enabled state changed to:', entriesEnabled);
    if (!entriesEnabled) {
      console.log('🚫 ENTRIES ARE DISABLED - Entry panel should show warning');
    } else {
      console.log('✅ ENTRIES ARE ENABLED - Entry panel should be active');
    }
  }, [entriesEnabled]);
  
  // Silent refresh without sound for background updates
  const silentRefresh = useCallback(() => {
    console.log('🔄 Silent refresh: transactions and balance...');
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
    console.log('🔄 Refreshing transactions and balance...');
    console.log('📊 Current transactions count:', transactions.length);
    playReloadSound();
    silentRefresh();
  }, [transactions.length, silentRefresh]);

  // Auto-refresh balance and transactions every 5 seconds
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      console.log('⏰ Auto-refresh triggered (5s)');
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
          console.log('🔴 User status update received:', payload);
          
          // Check if user was deactivated
          if (payload.new && payload.new.is_active === false) {
            alert('⚠️ Your account has been deactivated by an administrator. You will be logged out.');
            // Force logout
            window.location.href = '/login';
          }
        }
      )
      .subscribe((status: string) => {
        console.log('📡 User status subscription:', status);
      });

    return () => {
      userStatusSubscription.unsubscribe();
    };
  }, [user?.id]);

  // Auto-check user status and system settings every 2 seconds (fallback for real-time)
  useEffect(() => {
    if (!user?.id) return;

    const checkUserStatus = async () => {
      try {
        console.log('🔍 Checking user status for:', user.id);
        
        // Use database service which has proper admin access
        const { data: userData, error } = await db.getUserBalance(user.id);

        if (error) {
          console.error('❌ Error checking user status:', error);
          return;
        }

        console.log('👤 User data retrieved:', userData);

        // Check if user account is active
        if (userData && 'is_active' in userData && userData.is_active === false) {
          console.log('🚫 User has been deactivated! Logging out...');
          alert('⚠️ Your account has been deactivated by an administrator. You will be logged out.');
          // Clear any stored data
          localStorage.clear();
          sessionStorage.clear();
          // Force logout
          window.location.href = '/login';
          return;
        }

        console.log('✅ User is still active');

        // Also refresh system settings to ensure entries toggle is up-to-date
        console.log('🔄 Refreshing system settings...');
        refreshSettings();
      } catch (err) {
        console.error('❌ Error in status check:', err);
      }
    };

    // Check immediately on mount
    console.log('🚀 Initial user status check...');
    checkUserStatus();

    // Then check every 5 seconds
    const statusCheckInterval = setInterval(() => {
      console.log('⏰ Auto-checking user status and settings (5s interval)');
      checkUserStatus();
    }, 5000); // 5 seconds

    return () => {
      console.log('🛑 Cleaning up status check interval');
      clearInterval(statusCheckInterval);
    };
  }, [user?.id, refreshSettings]);

  // Keyboard shortcuts removed for regular users

  const handleEntryAdded = () => {
    console.log('🔄 Entry added, refreshing...');
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
    if (!deletingTransaction) return;

    try {
      setIsDeleting(true);

      // Delete the transaction (deleteTransaction will handle balance refund automatically)
      await deleteTransaction(deletingTransaction.id);
      
      setDeletingTransaction(null);
      silentRefresh();
      showSuccess('Success', 'Transaction deleted successfully and balance refunded');
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
                onDelete={(transactionId) => {
                  const transaction = transactions.find(t => t.id === transactionId);
                  if (transaction) {
                    setDeletingTransaction(transaction);
                  }
                }}
                onExportPDF={handleExportPDF}
                refreshTrigger={refreshTrigger}
                isPartner={user?.isPartner || false}
              />

              {/* Right Panel - Entry Panel (moved from bottom) */}
              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Add Entry
                    </h3>
                  </div>
                  <div>
                    {!entriesEnabled ? (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-yellow-800 dark:text-yellow-200">
                        <div className="flex items-center justify-between">
                          <span>Entries are temporarily disabled by admin.</span>
                          <button
                            onClick={() => {
                              console.log('🔄 Force refreshing system settings...');
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
                        onSuccess={() => {
                          console.log('✅ StandardEntry onSuccess called');
                          // Parent state is already updated via addTransaction. Keep a light refresh to sync balances.
                          refreshBalance();
                        }}
                      />
                    ) : (
                      <IntelligentEntry
                        projectId={'user-scope'}
                        entryType={project.entryTypes[0] || 'akra'}
                        onSuccess={() => {
                          console.log('✅ IntelligentEntry onSuccess called');
                          refresh();
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
          isLoading={isDeleting}
        />
      )}

    </>
  );
};

export default UserDashboard;
