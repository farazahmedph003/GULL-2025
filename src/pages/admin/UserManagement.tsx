import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { db } from '../../services/database';
import { supabase } from '../../lib/supabase';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAdminRefresh } from '../../contexts/AdminRefreshContext';
import { ConfirmationContext } from '../../App';
import CreateUserModal from '../../components/CreateUserModal';
import TopUpModal from '../../components/TopUpModal';
import EditUserModal from '../../components/EditUserModal';
import EditTransactionModal from '../../components/EditTransactionModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import { generateUserReport } from '../../utils/pdfGenerator';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getCachedData, setCachedData, CACHE_KEYS } from '../../utils/cache';

interface UserData {
  id: string;
  username: string;
  full_name: string;
  email: string;
  balance: number;
  total_spent: number;
  entryCount: number;
  is_active: boolean;
  is_partner?: boolean;
  role?: string;
}

const UserManagement: React.FC = () => {
  // INSTANT: Load cache synchronously BEFORE first render
  const usersCacheConfig = {
    key: CACHE_KEYS.ADMIN_DATA_USERS,
    validator: (data: any): data is UserData[] => Array.isArray(data),
  };
  
  const initialCachedUsers = typeof window !== 'undefined' 
    ? getCachedData<UserData[]>(usersCacheConfig) 
    : { data: null };
  
  const [users, setUsers] = useState<UserData[]>(initialCachedUsers.data || []);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyTab, setHistoryTab] = useState<'entries' | 'balance'>('entries');
  const [balanceHistory, setBalanceHistory] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(!initialCachedUsers.data);

  // Modals
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  // Transaction editing states
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<any | null>(null);

  const { showSuccess, showError, showInfo } = useNotifications();
  const { entriesEnabled, toggleEntriesEnabled } = useSystemSettings();
  const { setRefreshCallback } = useAdminRefresh();
  const confirm = useContext(ConfirmationContext);

  // Ref to track if any modal is open (for real-time callbacks)
  const isAnyModalOpenRef = useRef(false);

  // Update ref whenever modal states change
  useEffect(() => {
    isAnyModalOpenRef.current = !!(editingTransaction || deletingTransaction || createUserModalOpen || 
                                    topUpModalOpen || editUserModalOpen);
    console.log('📝 Modal state changed, any modal open:', isAnyModalOpenRef.current);
  }, [editingTransaction, deletingTransaction, createUserModalOpen, topUpModalOpen, editUserModalOpen]);

  const loadUsers = useCallback(async (force = false, showLoader = true) => {
    // Skip refresh if ANY modal is open (unless forced)
    if (!force && isAnyModalOpenRef.current) {
      console.log('⏸️ Skipping refresh - modal is open');
      return;
    }

    // Only show loader if no cache exists (cache already loaded in initial state)
    if (showLoader && users.length === 0) {
      setUsersLoading(true);
    }
    
    try {
      const data = await db.getAllUsersWithStats();
      setUsers(data);
      
      // Cache for instant next load
      setCachedData(usersCacheConfig, data);
    } catch (error) {
      console.error('Error loading users:', error);
      // If we have cached data, keep showing it
      if (users.length === 0) {
        showError('Error', 'Failed to load users');
      }
    } finally {
      if (showLoader) {
        setUsersLoading(false);
      }
    }
  }, [showError, users.length, usersCacheConfig]);

  useEffect(() => {
    // Register refresh callback for the refresh button
    setRefreshCallback(() => loadUsers(true, true));
    
    // Initial load (cache already loaded in initial state, this updates it in background)
    loadUsers(true, users.length === 0); // Only show loader if no cache

    // Auto-refresh every 2 seconds
    console.log('⏰ Setting up auto-refresh every 2 seconds for User Management...');
    const autoRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing User Management data...');
      loadUsers(false, false); // Silent background refresh
    }, 2000);

    // Set up real-time subscription for auto-updates
    if (supabase) {
      const subscription = supabase
        .channel('users-changes-realtime')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'app_users' },
          (payload: any) => {
            console.log('🔴 Real-time update received for users:', payload);
            loadUsers(false, false); // Silent background refresh
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'transactions' },
          (payload: any) => {
            console.log('🔴 Real-time update received for transactions (user stats):', payload);
            loadUsers(false, false); // Silent background refresh
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'balance_history' },
          (payload: any) => {
            console.log('🔴 Real-time update received for balance_history:', payload);
            loadUsers(false, false); // Silent background refresh
            // Refresh balance history if a user's history is currently expanded (but not if any modal is open)
            const currentExpandedUserId = expandedUserId;
            if (currentExpandedUserId && !isAnyModalOpenRef.current) {
              reloadBalanceHistory(currentExpandedUserId, false).catch(err => 
                console.error('Error reloading balance history:', err)
              );
            }
          }
        )
        .subscribe((status: string) => {
          console.log('📡 User management subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ User management real-time subscription active');
          }
        });

      return () => {
        console.log('🔌 Unsubscribing from user management real-time updates');
        clearInterval(autoRefreshInterval);
        subscription.unsubscribe();
      };
    }

    return () => {
      console.log('🔌 Cleaning up user management auto-refresh...');
      clearInterval(autoRefreshInterval);
    };
  }, []); // Empty dependency - only run once on mount

  const handleCreateUser = async (userData: {
    username: string;
    password: string;
    fullName: string;
    email: string;
    balance?: number;
    isPartner?: boolean;
  }) => {
    try {
      // Check if username already exists
      const existingUsername = users.find(u => u.username.toLowerCase() === userData.username.toLowerCase());
      if (existingUsername) {
        throw new Error(`Username "${userData.username}" is already taken. Please choose a different username.`);
      }
      
      // Check if full name already exists
      const existingFullName = users.find(u => u.full_name.toLowerCase() === userData.fullName.toLowerCase());
      if (existingFullName) {
        throw new Error(`Full name "${userData.fullName}" is already taken. Please choose a different name.`);
      }
      
      const newUser = await db.createUser(userData);
      await showSuccess('Success', `User ${userData.username} created successfully${userData.isPartner ? ' as Partner' : ''}`);
      // INSTANT: Add new user to cache immediately
      const newUserData: UserData = {
        id: newUser.id,
        username: newUser.username,
        full_name: newUser.full_name || newUser.username,
        email: newUser.email || '',
        balance: newUser.balance || 0,
        total_spent: 0,
        entryCount: 0,
        is_active: true,
        is_partner: newUser.is_partner || false,
        role: newUser.role || 'user',
      };
      const updatedUsers = [...users, newUserData];
      setUsers(updatedUsers);
      setCachedData(usersCacheConfig, updatedUsers);
      
      // Refresh in background to ensure sync
      loadUsers(false, false);
    } catch (error) {
      throw error;
    }
  };

  const handleTopUp = async (amount: number, isWithdraw?: boolean) => {
    if (!selectedUser) return;
    
    try {
      if (isWithdraw) {
        await db.withdrawUserBalance(selectedUser.id, amount);
        await showSuccess('Success', `Withdrew PKR ${amount.toLocaleString()} from ${selectedUser.username}'s balance`);
      } else {
        await db.topUpUserBalance(selectedUser.id, amount);
        await showSuccess('Success', `Added PKR ${amount.toLocaleString()} to ${selectedUser.username}'s balance`);
      }
      // INSTANT: Update cache immediately
      const updatedUsers = users.map(u => 
        u.id === selectedUser.id 
          ? { ...u, balance: isWithdraw ? u.balance - amount : u.balance + amount }
          : u
      );
      setUsers(updatedUsers);
      setCachedData(usersCacheConfig, updatedUsers);
      
      // Refresh in background to ensure sync
      loadUsers(false, false);
      
      // Refresh balance history if this user's history is currently expanded
      if (expandedUserId === selectedUser.id) {
        await reloadBalanceHistory(selectedUser.id, true);
      }
    } catch (error) {
      throw error;
    }
  };

  // Helper function to reload balance history for a specific user
  const reloadBalanceHistory = useCallback(async (userId: string, force = false) => {
    // Skip refresh if ANY modal is open (unless forced)
    if (!force && isAnyModalOpenRef.current) {
      console.log('⏸️ Skipping balance history refresh - modal is open');
      return;
    }
    
    try {
      const history = await db.getUserHistory(userId);
      const balanceHist = history.filter((item: any) => item.isTopUp === true);
      setBalanceHistory(balanceHist);
    } catch (error) {
      console.error('Error reloading balance history:', error);
    }
  }, []);

  // Handle tab switching with refresh
  const handleTabSwitch = async (tab: 'entries' | 'balance') => {
    setHistoryTab(tab);
    
    // Refresh balance history when switching to balance tab
    if (tab === 'balance' && expandedUserId) {
      await reloadBalanceHistory(expandedUserId, true);
    } else if (tab === 'entries' && expandedUserId) {
      await loadHistoryData(expandedUserId, true);
    }
  };

  const handleEditUser = async (updates: {
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
    isPartner?: boolean;
  }) => {
    if (!selectedUser) return;

    try {
      await db.updateUser(selectedUser.id, updates);
      const partnerMessage = updates.isPartner !== undefined 
        ? (updates.isPartner ? ' (now a Partner)' : ' (Partner status removed)')
        : '';
      await showSuccess('Success', `User updated successfully${partnerMessage}`);
      loadUsers(true); // Force reload after edit
    } catch (error) {
      throw error;
    }
  };

  const handleToggleEntriesEnabled = async () => {
    try {
      await toggleEntriesEnabled();
      await showSuccess('Success', `Entries are now ${!entriesEnabled ? 'enabled' : 'disabled'} system-wide`);
    } catch (error) {
      showError('Error', 'Failed to update system settings');
    }
  };

  const loadHistoryData = useCallback(async (userId: string, force = false) => {
    // Skip refresh if ANY modal is open (unless forced)
    if (!force && isAnyModalOpenRef.current) {
      console.log('⏸️ Skipping history refresh - modal is open');
      return;
    }
    
    try {
      const history = await db.getUserHistory(userId);
      // Separate entries from balance history and admin actions
      // Only count actual transaction entries (not admin actions or top-ups)
      const entries = history.filter((item: any) => item.isEntry === true);
      const balanceHist = history.filter((item: any) => item.isTopUp === true);
      
      setHistoryData(entries);
      setBalanceHistory(balanceHist);
      
      // Log for debugging - compare with card count
      console.log(`📊 History loaded: ${entries.length} entries (Card shows: ${users.find(u => u.id === userId)?.entryCount || 'N/A'})`);
    } catch (error) {
      console.error('Error loading history:', error);
      showError('Error', 'Failed to load user history');
    }
  }, [showError, users]);

  const handleViewHistory = async (user: UserData) => {
    if (expandedUserId === user.id) {
      setExpandedUserId(null);
      setHistoryData([]);
      setBalanceHistory([]);
      setHistoryTab('entries');
      return;
    }

    setExpandedUserId(user.id);
    setHistoryTab('entries');
    // Load history data (will use cache if available)
    await loadHistoryData(user.id, true);
    // Refresh user list in background to ensure entryCount is up-to-date
    loadUsers(false, false);
  };

  const handleEditTransaction = async (updatedTransaction: any) => {
    if (!editingTransaction || !expandedUserId) return;

    // INSTANT: Optimistically update UI immediately
    const oldTransaction = editingTransaction;
    const updatedTransactionData = {
      ...oldTransaction,
      first_amount: updatedTransaction.first,
      second_amount: updatedTransaction.second,
      number: updatedTransaction.number || oldTransaction.number,
    };
    
    setHistoryData(prev => prev.map(t => t.id === oldTransaction.id ? updatedTransactionData : t));
    setEditingTransaction(null);

    try {
      // Calculate balance difference
      const oldTotal = oldTransaction.first_amount + oldTransaction.second_amount;
      const newTotal = updatedTransaction.first + updatedTransaction.second;
      const difference = newTotal - oldTotal;

      // Get current user balance
      const { data: userData } = await db.getUserBalance(expandedUserId);
      if (!userData) {
        throw new Error('User data not found');
      }
      const newBalance = userData.balance - difference;
      const newTotalSpent = Math.max(0, (userData.total_spent || 0) + difference);

      // Update user balance
      await db.updateUserBalance(expandedUserId, newBalance, { totalSpent: newTotalSpent });

      // Update transaction
      await db.updateTransaction(oldTransaction.id, {
        number: updatedTransaction.number || oldTransaction.number,
        entryType: updatedTransaction.entryType || oldTransaction.entry_type,
        first: updatedTransaction.first,
        second: updatedTransaction.second,
        notes: updatedTransaction.notes,
      });

      await showSuccess('Success', 'Entry updated successfully');
      
      // Refresh in background to ensure sync
      loadHistoryData(expandedUserId, false);
      loadUsers(false, false);
    } catch (error) {
      console.error('Edit error:', error);
      // Rollback on error
      setHistoryData(prev => prev.map(t => t.id === oldTransaction.id ? oldTransaction : t));
      showError('Error', 'Failed to update entry');
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deletingTransaction || !expandedUserId) return;

    // INSTANT: Optimistically update UI immediately
    const transactionToDelete = deletingTransaction;
    setHistoryData(prev => prev.filter(t => t.id !== transactionToDelete.id));
    
    // Update user balance in UI immediately
    const refundAmount = transactionToDelete.first_amount + transactionToDelete.second_amount;
    const updatedUsers = users.map(u => 
      u.id === expandedUserId 
        ? { ...u, balance: u.balance + refundAmount }
        : u
    );
    setUsers(updatedUsers);
    setCachedData(usersCacheConfig, updatedUsers);
    
    setDeletingTransaction(null);

    try {
      // Refund the balance to the user
      const { data: userData } = await db.getUserBalance(expandedUserId);
      if (!userData) {
        throw new Error('User data not found');
      }
      const newBalance = userData.balance + refundAmount;
      const newTotalSpent = Math.max(0, (userData.total_spent || 0) - refundAmount);
      await db.updateUserBalance(expandedUserId, newBalance, { totalSpent: newTotalSpent });

      // Delete the transaction
      await db.deleteTransaction(transactionToDelete.id);
      await showSuccess('Success', 'Entry deleted successfully and balance refunded');
      
      // Refresh in background to ensure sync
      loadHistoryData(expandedUserId, false);
      loadUsers(false, false);
    } catch (error) {
      console.error('Delete error:', error);
      // Rollback on error
      setHistoryData(prev => [...prev, transactionToDelete]);
      setUsers(users);
      setCachedData(usersCacheConfig, users);
      showError('Error', 'Failed to delete entry');
    }
  };

  const handleToggleActive = async (user: UserData) => {
    // INSTANT: Optimistically update UI immediately
    const newStatus = !user.is_active;
    const updatedUsers = users.map(u => 
      u.id === user.id 
        ? { ...u, is_active: newStatus }
        : u
    );
    setUsers(updatedUsers);
    setCachedData(usersCacheConfig, updatedUsers);
    
    try {
      await db.toggleUserActiveStatus(user.id, newStatus);
      await showSuccess('Success', `User ${user.username} is now ${newStatus ? 'active' : 'inactive'}`);
      
      // Refresh in background to ensure sync
      loadUsers(false, false);
      // Refresh in background to ensure sync
      loadUsers(false, false);
    } catch (error) {
      console.error('Error toggling user status:', error);
      showError('Error', 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (user: UserData) => {
    if (!confirm) return;
    
    const result = await confirm(
      `Are you sure you want to delete user "${user.full_name}" (@${user.username})? This action cannot be undone.`,
      { type: 'danger', title: 'Delete User' }
    );
    
    if (!result) return;

    // INSTANT: Optimistically remove from UI immediately
    const userToDelete = user;
    const updatedUsers = users.filter(u => u.id !== userToDelete.id);
    setUsers(updatedUsers);
    setCachedData(usersCacheConfig, updatedUsers);

    try {
      await db.deleteUser(userToDelete.id, true); // Hard delete - completely remove from database
      await showSuccess('Success', `User ${userToDelete.username} has been permanently deleted`);
      
      // Refresh in background to ensure sync
      loadUsers(false, false);
    } catch (error) {
      console.error('Error deleting user:', error);
      // Rollback on error
      setUsers(users);
      setCachedData(usersCacheConfig, users);
      showError('Error', 'Failed to delete user');
    }
  };

  const handleResetUserHistory = async (user: UserData) => {
    if (!confirm) return;
    
    const firstConfirm = await confirm(
      `Are you sure you want to PERMANENTLY DELETE ALL HISTORY for "${user.full_name}" (@${user.username})?\n\nThis will PERMANENTLY DELETE:\n• All transactions (Open, Akra, Ring, Packet)\n• All entry history\n• All admin deductions\n• All balance history (deposits/withdrawals)\n\n🚨 THIS ACTION CANNOT BE UNDONE - ENTRIES WILL BE PERMANENTLY DELETED FROM ALL PAGES!`,
      { type: 'danger', title: '⚠️ Delete User History Permanently' }
    );
    
    if (!firstConfirm) return;

    // Double confirmation for safety
    const finalConfirm = await confirm(
      `You are about to delete ALL ${user.entryCount} entries for ${user.username}.\n\nAre you absolutely sure?`,
      { type: 'danger', title: '🚨 FINAL CONFIRMATION' }
    );
    
    if (!finalConfirm) return;

    try {
      const result = await db.resetUserHistory(user.id);
      await showSuccess(
        'History Reset',
        `Successfully deleted ${result.deletedCount} transaction(s) for ${user.username}`
      );
      loadUsers(true); // Force reload after reset
      // Close expanded history if it was open
      if (expandedUserId === user.id) {
        setExpandedUserId(null);
        setHistoryData([]);
      }
    } catch (error) {
      console.error('Error resetting user history:', error);
      showError('Error', 'Failed to reset user history');
    }
  };

  const handleResetUserSpent = async (user: UserData) => {
    if (!confirm) return;
    
    const result = await confirm(
      `Are you sure you want to RESET SPENT AMOUNT for "${user.full_name}" (@${user.username})?\n\nCurrent Spent: PKR ${(user.total_spent || 0).toLocaleString()}\n\nThis will set their spent amount to 0.\n\nThis action CANNOT be undone!`,
      { type: 'warning', title: '💸 Reset User Spent' }
    );
    
    if (!result) return;

    try {
      await db.resetUserSpent(user.id);
      await showSuccess(
        'Spent Reset',
        `Successfully reset spent amount for ${user.username} to PKR 0`
      );
      loadUsers(true); // Force reload after reset
    } catch (error) {
      console.error('Error resetting user spent:', error);
      showError('Error', 'Failed to reset user spent');
    }
  };

  const handleGeneratePDF = async (user: UserData) => {
    try {
      await showInfo('Generating...', 'Preparing PDF report...');
      
      // Fetch all user data
      const [openEntries, akraEntries, ringEntries, packetEntries, topupHistory] = await Promise.all([
        db.getUserEntries(user.id, 'open'),
        db.getUserEntries(user.id, 'akra'),
        db.getUserEntries(user.id, 'ring'),
        db.getUserEntries(user.id, 'packet'),
        db.getUserHistory(user.id).then(history => 
          history.filter((item: any) => item.isTopUp)
        )
      ]);

      // Transform entries to Transaction format
      const transformEntries = (entries: any[]) => 
        entries.map((e: any) => ({
          id: e.id,
          number: e.number,
          entryType: e.entry_type,
          first: e.first_amount,
          second: e.second_amount,
          createdAt: e.created_at,
          updatedAt: e.updated_at || e.created_at,
          userId: e.user_id
        }));

      // Generate the PDF
      generateUserReport({
        user: {
          fullName: user.full_name,
          username: user.username,
          email: user.email,
          balance: user.balance
        },
        entries: {
          open: transformEntries(openEntries),
          akra: transformEntries(akraEntries),
          ring: transformEntries(ringEntries),
          packet: transformEntries(packetEntries)
        },
        topupHistory: topupHistory
      });

      await showSuccess('Success', 'PDF report generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError('Error', 'Failed to generate PDF report');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            👥 User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage users, balances, and system settings
          </p>
        </div>

        {/* Top Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* System Toggle */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={entriesEnabled}
                    onChange={handleToggleEntriesEnabled}
                  />
                  <div className={`w-14 h-8 rounded-full transition-colors ${
                    entriesEnabled ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                      entriesEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </div>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  Entries {entriesEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            {/* Create User Button */}
            <button
              onClick={() => setCreateUserModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New User
            </button>
          </div>
        </div>

        {/* Users Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => {
            const isAdmin = user.role === 'admin' || user.username.toLowerCase() === 'gullbaba';
            const isGullBaba = user.username.toLowerCase() === 'gullbaba';
            
            return (
            <div key={user.id} className={`rounded-2xl shadow-xl overflow-hidden relative ${
              isGullBaba
                ? 'bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 dark:from-yellow-900/50 dark:via-amber-900/50 dark:to-yellow-900/50 border-4 border-yellow-400 dark:border-yellow-500 ring-4 ring-yellow-300 dark:ring-yellow-700/50 shadow-2xl'
                : user.is_partner 
                ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-orange-900/40 border-4 border-yellow-400 dark:border-yellow-500 ring-4 ring-yellow-200 dark:ring-yellow-800/50' 
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }`}>
              {/* King Badge for GULL BABA */}
              {isGullBaba && (
                <div className="absolute top-0 right-0 bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 text-white px-4 py-1 text-xs font-bold uppercase tracking-wider shadow-lg transform rotate-0 rounded-bl-xl flex items-center gap-1 z-10">
                  <span className="text-sm">👑</span>
                  <span>KING</span>
                </div>
              )}
              
              {/* Partner Badge Ribbon */}
              {user.is_partner && !isGullBaba && (
                <div className="absolute top-0 right-0 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 text-white px-4 py-1 text-xs font-bold uppercase tracking-wider shadow-lg transform rotate-0 rounded-bl-xl flex items-center gap-1">
                  <span className="text-sm">⭐</span>
                  <span>Partner</span>
                </div>
              )}
              
              {/* User Card */}
              <div className={`p-6 ${isGullBaba ? 'relative overflow-hidden' : ''}`}>
                {/* Decorative background pattern for GULL BABA */}
                {isGullBaba && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>
                    <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-yellow-300/30 to-transparent transform -translate-y-1/2"></div>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-400/10 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-amber-400/10 rounded-full blur-2xl"></div>
                  </>
                )}
                
                <div className={`flex items-start justify-between mb-6 ${isGullBaba ? 'relative z-10' : ''}`}>
                  <div className="flex-1">
                    {isGullBaba && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex gap-1">
                          <span className="text-2xl">👑</span>
                          <span className="text-xl">⚜️</span>
                          <span className="text-2xl">👑</span>
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 opacity-50"></div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`${isGullBaba ? 'text-2xl' : 'text-xl'} font-bold ${
                        isGullBaba
                          ? 'text-yellow-700 dark:text-yellow-300 drop-shadow-lg'
                          : user.is_partner 
                          ? 'text-amber-900 dark:text-amber-200' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {isGullBaba && '👑 '}
                        {user.full_name}
                      </h3>
                    </div>
                    <div className={`mt-2 ${isGullBaba ? 'space-y-1' : ''}`}>
                      <p className={`text-sm ${
                        isGullBaba
                          ? 'text-yellow-600 dark:text-yellow-400 font-semibold'
                          : user.is_partner 
                          ? 'text-amber-700 dark:text-amber-400' 
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {isGullBaba && '👤 '}
                        @{user.username}
                      </p>
                      <p className={`text-xs ${isGullBaba ? 'text-yellow-500 dark:text-yellow-500' : 'text-gray-500 dark:text-gray-500'} mt-1`}>
                        {isGullBaba && '📧 '}
                        {user.email}
                      </p>
                    </div>
                  </div>
                  {!isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80 cursor-pointer ${
                          user.is_active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}
                        title="Click to toggle active/inactive"
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete user"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {isAdmin && (
                    <div className={`flex flex-col items-end gap-2 ${isGullBaba ? 'relative z-10' : ''}`}>
                      <div className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-lg">
                        👑 Admin
                      </div>
                    </div>
                  )}
                </div>

                {/* Decorative separator for GULL BABA */}
                {isGullBaba && (
                  <div className="flex items-center gap-2 mb-6 relative z-10">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>
                    <div className="flex gap-1 px-2">
                      <span className="text-yellow-500">⚜️</span>
                      <span className="text-amber-500">👑</span>
                      <span className="text-yellow-500">⚜️</span>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>
                  </div>
                )}

                {/* Stats Section - Hidden for Admin users */}
                {!isAdmin && (
                  <div className={`space-y-2 mb-4 ${
                    user.is_partner 
                      ? 'bg-amber-100/50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-300 dark:border-amber-700' 
                      : ''
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${
                        user.is_partner 
                          ? 'text-amber-700 dark:text-amber-400 font-semibold' 
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>Balance:</span>
                      <span className={`font-bold ${
                        user.is_partner 
                          ? 'text-green-700 dark:text-green-300 text-lg' 
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        PKR {user.balance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${
                        user.is_partner 
                          ? 'text-amber-700 dark:text-amber-400 font-semibold' 
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>Total Spent:</span>
                      <span className={`font-bold ${
                        user.is_partner 
                          ? 'text-red-700 dark:text-red-300 text-lg' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        PKR {(user.total_spent || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${
                        user.is_partner 
                          ? 'text-amber-700 dark:text-amber-400 font-semibold' 
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>Total Entries:</span>
                      <span className={`font-semibold ${
                        user.is_partner 
                          ? 'text-amber-900 dark:text-amber-200 text-lg' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {user.entryCount}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {isAdmin ? (
                  /* Only Edit button for Admin users - Enhanced design */
                  <div className={`flex flex-col items-center gap-4 ${isGullBaba ? 'relative z-10' : ''}`}>
                    {isGullBaba && (
                      <div className="text-center">
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mb-2">
                          Manage Account Settings
                        </p>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setEditUserModalOpen(true);
                      }}
                      className={`${
                        isGullBaba
                          ? 'px-8 py-3 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 text-white rounded-xl font-bold text-base shadow-xl hover:shadow-2xl hover:scale-105 transition-all transform border-2 border-blue-300 dark:border-blue-400'
                          : 'px-6 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm'
                      }`}
                    >
                      {isGullBaba ? (
                        <span className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Edit Profile</span>
                        </span>
                      ) : (
                        '✏️ Edit'
                      )}
                    </button>
                    {isGullBaba && (
                      <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400">
                        <span>⚜️</span>
                        <span className="font-medium">Administrator Access</span>
                        <span>⚜️</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* All buttons for regular users */
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setTopUpModalOpen(true);
                      }}
                      className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm"
                    >
                      💰 Load
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setEditUserModalOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleViewHistory(user)}
                      className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm"
                    >
                      📜 History
                    </button>
                    <button
                      onClick={() => handleGeneratePDF(user)}
                      className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg font-semibold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors text-sm"
                    >
                      📄 PDF
                    </button>
                    <button
                      onClick={() => handleResetUserSpent(user)}
                      className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg font-semibold hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors text-sm border-2 border-yellow-300 dark:border-yellow-700"
                    >
                      💸 Reset Spent
                    </button>
                    <button
                      onClick={() => handleResetUserHistory(user)}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm border-2 border-red-300 dark:border-red-700"
                    >
                      🔄 Reset History
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded History Section */}
              {expandedUserId === user.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">User History</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Showing {historyData.length} entries {historyData.length !== user.entryCount && `(Card shows: ${user.entryCount})`}
                      </p>
                    </div>
                    
                    {/* Tabs */}
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => handleTabSwitch('entries')}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                          historyTab === 'entries'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                        }`}
                      >
                        📝 Entries
                      </button>
                      <button
                        onClick={() => handleTabSwitch('balance')}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                          historyTab === 'balance'
                            ? 'bg-green-600 text-white shadow-lg'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                        }`}
                      >
                        💰 Balance History
                      </button>
                      {historyTab === 'balance' && (
                        <button
                          onClick={() => expandedUserId && reloadBalanceHistory(expandedUserId)}
                          className="p-2 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Refresh balance history"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Entries Tab */}
                  {historyTab === 'entries' && (
                    historyData.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No entries found</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {historyData.map((item, idx) => (
                          <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg text-sm">
                            <div className="space-y-1">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 dark:text-white text-lg">
                                    {item.number}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                                    {item.entry_type}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-sm">
                                  {(item.first_amount || 0) > 0 && (
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                      F {item.first_amount.toLocaleString()}
                                    </span>
                                  )}
                                  {(item.second_amount || 0) > 0 && (
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                      S {item.second_amount.toLocaleString()}
                                    </span>
                                  )}
                                  {(item.first_amount || 0) <= 0 && (item.second_amount || 0) <= 0 && (
                                    <span className="font-semibold text-red-600 dark:text-red-400">
                                      Deduction
                                    </span>
                                  )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setEditingTransaction(item)}
                                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                      title="Edit Entry"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => setDeletingTransaction(item)}
                                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                      title="Delete Entry"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                {new Date(item.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {/* Balance History Tab */}
                  {historyTab === 'balance' && (
                    balanceHistory.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No balance history found</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {balanceHistory.map((item, idx) => (
                          <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg text-sm">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold ${
                                  item.amount > 0 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {item.amount > 0 ? '💰 Deposit' : '💸 Withdraw'}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-500">
                                  {new Date(item.created_at).toLocaleString()}
                                </span>
                              </div>
                              <span className={`font-bold ${
                                item.amount > 0 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {item.amount > 0 ? '+' : ''}PKR {Math.abs(item.amount).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>

        {usersLoading ? (
          <LoadingSpinner text="Loading users..." />
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No users found. Create your first user to get started.
            </p>
          </div>
        ) : null}
      </div>

      {/* Modals */}
      <CreateUserModal
        isOpen={createUserModalOpen}
        onClose={() => setCreateUserModalOpen(false)}
        onSubmit={handleCreateUser}
      />

      {selectedUser && (
        <>
          <TopUpModal
            isOpen={topUpModalOpen}
            onClose={() => {
              setTopUpModalOpen(false);
              setSelectedUser(null);
            }}
            userName={selectedUser.full_name}
            currentBalance={selectedUser.balance}
            onSubmit={handleTopUp}
          />

          <EditUserModal
            isOpen={editUserModalOpen}
            onClose={() => {
              setEditUserModalOpen(false);
              setSelectedUser(null);
            }}
            user={{
              id: selectedUser.id,
              username: selectedUser.username,
              fullName: selectedUser.full_name,
              email: selectedUser.email,
              isPartner: selectedUser.is_partner,
              role: selectedUser.role,
            }}
            onSubmit={handleEditUser}
          />
        </>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && expandedUserId && (
        <EditTransactionModal
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          transaction={{
            id: editingTransaction.id,
            number: editingTransaction.number,
            first: editingTransaction.first_amount,
            second: editingTransaction.second_amount,
            notes: '',
            entryType: editingTransaction.entry_type as any,
            projectId: 'admin',
            createdAt: editingTransaction.created_at,
            updatedAt: editingTransaction.created_at,
          }}
          onSave={handleEditTransaction}
          userBalance={users.find(u => u.id === expandedUserId)?.balance || 0}
          transactions={historyData.map(h => ({
            id: h.id,
            number: h.number,
            first: h.first_amount,
            second: h.second_amount,
            notes: '',
            entryType: h.entry_type as any,
            projectId: 'admin',
            createdAt: h.created_at,
            updatedAt: h.created_at,
          }))}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTransaction && (
        <DeleteConfirmationModal
          isOpen={!!deletingTransaction}
          onClose={() => setDeletingTransaction(null)}
          onConfirm={handleDeleteTransaction}
          title="Delete Entry"
          message="Are you sure you want to delete this entry? The balance will be refunded to the user."
          itemName={`Number: ${deletingTransaction.number} (${deletingTransaction.entry_type.toUpperCase()})`}
        />
      )}

    </div>
  );
};

export default UserManagement;

