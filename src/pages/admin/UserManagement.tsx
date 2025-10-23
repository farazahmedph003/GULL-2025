import React, { useState, useEffect } from 'react';
import { db } from '../../services/database';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { useNotifications } from '../../contexts/NotificationContext';
import CreateUserModal from '../../components/CreateUserModal';
import TopUpModal from '../../components/TopUpModal';
import EditUserModal from '../../components/EditUserModal';
import SyncAuthUserModal from '../../components/SyncAuthUserModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { generateUserReport } from '../../utils/pdfGenerator';

interface UserData {
  id: string;
  username: string;
  full_name: string;
  email: string;
  balance: number;
  entryCount: number;
  is_active: boolean;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modals
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [syncAuthModalOpen, setSyncAuthModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  const { showSuccess, showError, showInfo } = useNotifications();
  const { entriesEnabled, toggleEntriesEnabled } = useSystemSettings();

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await db.getAllUsersWithStats();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      showError('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (userData: {
    username: string;
    password: string;
    fullName: string;
    email: string;
    balance?: number;
  }) => {
    try {
      await db.createUser(userData);
      await showSuccess('Success', `User ${userData.username} created successfully`);
      loadUsers();
    } catch (error) {
      throw error;
    }
  };

  const handleTopUp = async (amount: number) => {
    if (!selectedUser) return;
    
    try {
      await db.topUpUserBalance(selectedUser.id, amount);
      await showSuccess('Success', `Added PKR ${amount.toLocaleString()} to ${selectedUser.username}'s balance`);
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
      return;
    }

    setExpandedUserId(user.id);
    setLoadingHistory(true);
    try {
      const history = await db.getUserHistory(user.id);
      setHistoryData(history);
    } catch (error) {
      console.error('Error loading history:', error);
      showError('Error', 'Failed to load user history');
    } finally {
      setLoadingHistory(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading users..." />
      </div>
    );
  }

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
            <div key={user.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              {/* User Card */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {user.full_name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">@{user.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{user.email}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.is_active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
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
                    💰 Top Up
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
                    onClick={() => {
                      setSelectedUser(user);
                      setSyncAuthModalOpen(true);
                    }}
                    className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg font-semibold hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors text-sm"
                    title="Create Supabase Auth account for this user"
                  >
                    🔐 Sync Auth
                  </button>
                  <button
                    onClick={() => handleGeneratePDF(user)}
                    className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg font-semibold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors text-sm"
                  >
                    📄 PDF
                  </button>
                </div>
              </div>

              {/* Expanded History Section */}
              {expandedUserId === user.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900/50">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-4">User History</h4>
                  {loadingHistory ? (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : historyData.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No history found</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {historyData.map((item, idx) => (
                        <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg text-sm">
                          {item.isTopUp ? (
                            <div className="flex justify-between items-center">
                              <span className="text-green-600 dark:text-green-400 font-semibold">
                                💰 Top Up
                              </span>
                              <span className="text-green-600 dark:text-green-400 font-bold">
                                +PKR {item.amount.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {item.entry_type?.toUpperCase()}: {item.number}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  PKR {((item.first_amount || 0) + (item.second_amount || 0)).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                {new Date(item.created_at).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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

      {/* Sync Auth Modal */}
      {syncAuthModalOpen && selectedUser && (
        <SyncAuthUserModal
          userId={selectedUser.id}
          username={selectedUser.username}
          email={selectedUser.email}
          onClose={() => {
            setSyncAuthModalOpen(false);
            setSelectedUser(null);
          }}
          onSuccess={loadUsers}
        />
      )}
    </div>
  );
};

export default UserManagement;

