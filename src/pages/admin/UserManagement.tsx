import React, { useState, useEffect, useContext, useCallback } from 'react';
import { db } from '../../services/database';
import { supabase } from '../../lib/supabase';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAdminRefresh } from '../../contexts/AdminRefreshContext';
import { ConfirmationContext } from '../../App';
import CreateUserModal from '../../components/CreateUserModal';
import TopUpModal from '../../components/TopUpModal';
import EditUserModal from '../../components/EditUserModal';
import { generateUserReport } from '../../utils/pdfGenerator';

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
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyTab, setHistoryTab] = useState<'entries' | 'balance'>('entries');
  const [balanceHistory, setBalanceHistory] = useState<any[]>([]);

  // Modals
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  const { showSuccess, showError, showInfo } = useNotifications();
  const { entriesEnabled, toggleEntriesEnabled } = useSystemSettings();
  const { setRefreshCallback } = useAdminRefresh();
  const confirm = useContext(ConfirmationContext);

  const loadUsers = useCallback(async () => {
    try {
      const data = await db.getAllUsersWithStats();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      showError('Error', 'Failed to load users');
    }
  }, [showError]);

  useEffect(() => {
    // Register refresh callback for the refresh button
    setRefreshCallback(loadUsers);
    
    loadUsers();

    // Auto-refresh every 5 seconds
    console.log('⏰ Setting up auto-refresh every 5 seconds for User Management...');
    const autoRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing User Management data...');
      loadUsers();
    }, 5000);

    // Set up real-time subscription for auto-updates
    if (supabase) {
      const subscription = supabase
        .channel('users-changes-realtime')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'app_users' },
          (payload: any) => {
            console.log('🔴 Real-time update received for users:', payload);
            loadUsers();
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'transactions' },
          (payload: any) => {
            console.log('🔴 Real-time update received for transactions (user stats):', payload);
            loadUsers();
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
      const existingUser = users.find(u => u.username.toLowerCase() === userData.username.toLowerCase());
      if (existingUser) {
        throw new Error(`Username "${userData.username}" is already taken. Please choose a different username.`);
      }
      
      await db.createUser(userData);
      await showSuccess('Success', `User ${userData.username} created successfully${userData.isPartner ? ' as Partner' : ''}`);
      loadUsers();
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
      loadUsers();
    } catch (error) {
      throw error;
    }
  };

  const handleEditUser = async (updates: {
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
  }) => {
    if (!selectedUser) return;

    try {
      await db.updateUser(selectedUser.id, updates);
      await showSuccess('Success', 'User updated successfully');
      loadUsers();
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
    try {
      const history = await db.getUserHistory(user.id);
      // Separate entries from balance history
      const entries = history.filter((item: any) => !item.isTopUp);
      const balanceHist = history.filter((item: any) => item.isTopUp);
      
      setHistoryData(entries);
      setBalanceHistory(balanceHist);
    } catch (error) {
      console.error('Error loading history:', error);
      showError('Error', 'Failed to load user history');
    }
  };

  const handleToggleActive = async (user: UserData) => {
    try {
      const newStatus = !user.is_active;
      await db.toggleUserActiveStatus(user.id, newStatus);
      await showSuccess('Success', `User ${user.username} is now ${newStatus ? 'active' : 'inactive'}`);
      loadUsers();
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

    try {
      await db.deleteUser(user.id, true); // Hard delete - completely remove from database
      await showSuccess('Success', `User ${user.username} has been permanently deleted`);
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showError('Error', 'Failed to delete user');
    }
  };

  const handleResetUserHistory = async (user: UserData) => {
    if (!confirm) return;
    
    const firstConfirm = await confirm(
      `Are you sure you want to RESET ALL HISTORY for "${user.full_name}" (@${user.username})?\n\nThis will permanently delete:\n• All transactions (Open, Akra, Ring, Packet)\n• All entry history\n• All admin deductions\n\nThis action CANNOT be undone!`,
      { type: 'danger', title: '⚠️ Reset User History' }
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
      loadUsers();
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
      loadUsers();
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
          {users.map((user) => (
            <div key={user.id} className={`rounded-2xl shadow-lg overflow-hidden ${
              user.is_partner 
                ? 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-900/30 dark:via-orange-900/30 dark:to-yellow-900/30 border-2 border-amber-300 dark:border-amber-600' 
                : 'bg-white dark:bg-gray-800'
            }`}>
              {/* User Card */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {user.full_name}
                      </h3>
                      {user.is_partner && (
                        <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-md">
                          ⭐ PARTNER
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">@{user.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{user.email}</p>
                  </div>
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
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Balance:</span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      PKR {user.balance.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Spent:</span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      PKR {(user.total_spent || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Entries:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {user.entryCount}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
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
              </div>

              {/* Expanded History Section */}
              {expandedUserId === user.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 dark:text-white">User History</h4>
                    
                    {/* Tabs */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setHistoryTab('entries')}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                          historyTab === 'entries'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                        }`}
                      >
                        📝 Entries
                      </button>
                      <button
                        onClick={() => setHistoryTab('balance')}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                          historyTab === 'balance'
                            ? 'bg-green-600 text-white shadow-lg'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                        }`}
                      >
                        💰 Balance History
                      </button>
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
          ))}
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No users found. Create your first user to get started.
            </p>
          </div>
        )}
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
            }}
            onSubmit={handleEditUser}
          />
        </>
      )}

    </div>
  );
};

export default UserManagement;

