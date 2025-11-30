import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProjects } from '../../utils/mockData';
import { useNeroAuth } from '../../contexts/NeroAuthContext';
import { ConfirmationContext } from '../../../App';
import type { NeroUser } from '../../types';
import { db } from '../../../services/database';

const AdminUserManagement: React.FC = () => {
  const { impersonateUser } = useNeroAuth();
  const navigate = useNavigate();
  const confirm = useContext(ConfirmationContext);
  const [users, setUsers] = useState<NeroUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<NeroUser | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resettingHistory, setResettingHistory] = useState(false);
  const [resettingSpent, setResettingSpent] = useState(false);
  const [newUser, setNewUser] = useState({
    displayName: '',
    phone: '',
    password: '',
    username: '',
    balance: '0',
    spendingLimit: '10000',
    isPartner: false,
  });

  // Load real users from database
  const loadUsers = useCallback(async () => {
    try {
      const data = await db.getAllUsersWithStats();
      // Convert to NeroUser format
      const neroUsers: NeroUser[] = data.map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.full_name,
        role: 'user',
        balance: user.balance,
        spendingLimit: 50000, // Default
        isOnline: false,
        status: user.is_active ? 'active' : 'inactive',
        isPartner: user.is_partner,
        phone: user.username,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalSpent: user.total_spent || 0,
        entryCount: user.entryCount || 0,
      }));
      setUsers(neroUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter((user) =>
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTopUp = (user: NeroUser) => {
    setSelectedUser(user);
    setTopUpAmount('');
    setShowTopUpModal(true);
  };

  const confirmTopUp = () => {
    if (selectedUser && topUpAmount) {
      console.log(`✅ Successfully topped up PKR ${topUpAmount} to ${selectedUser.displayName}'s account!`);
      setShowTopUpModal(false);
      setSelectedUser(null);
      setTopUpAmount('');
    }
  };

  const handleViewDetails = (user: NeroUser) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  const handleImpersonate = async (user: NeroUser) => {
    if (!confirm) return;
    
    const result = await confirm(
      `Impersonate ${user.displayName}? You'll be able to view their projects and make changes.`,
      { type: 'warning', title: 'Impersonate User' }
    );
    
    if (!result) return;

    try {
      setImpersonating(true);
      await impersonateUser(user.id);
      // Navigate to the impersonated projects view
      navigate(`/nero/admin/impersonate/${user.id}`);
    } catch (error) {
      console.error('Failed to impersonate user:', error);
      // Error handling - user will see this in console
    } finally {
      setImpersonating(false);
    }
  };

  const handleDeactivate = async (user: NeroUser) => {
    if (!confirm) return;
    
    const isActive = user.status === 'active';
    const action = isActive ? 'Deactivate' : 'Activate';
    
    const result = await confirm(
      `${action} ${user.displayName}'s account?`,
      { type: 'warning', title: `${action} User` }
    );
    
    if (!result) return;
    
    setLoading(true);
    try {
      // Update user status in database
      await db.updateUser(user.id, { isActive: !isActive });
      console.log(`✅ User ${user.displayName} has been ${isActive ? 'deactivated' : 'activated'}.`);
      alert(`✅ User ${user.displayName} has been ${isActive ? 'deactivated' : 'activated'} successfully!`);
      
      // Reload users to show updated status
      await loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert(`❌ Failed to ${action.toLowerCase()} user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user: NeroUser) => {
    if (!confirm) return;
    
    const result = await confirm(
      `⚠️ Delete ${user.displayName}'s account? This action cannot be undone!`,
      { type: 'danger', title: 'Delete User' }
    );
    
    if (!result) return;
    
    console.log(`❌ User ${user.displayName} has been deleted.`);
  };

  const handleResetHistory = async (user: NeroUser) => {
    if (!confirm) return;
    
    const result = await confirm(
      `Are you sure you want to PERMANENTLY DELETE ALL HISTORY for "${user.displayName}" (@${user.phone})?\n\nThis will PERMANENTLY DELETE:\n• All transactions (Open, Akra, Ring, Packet)\n• All entry history\n• All balance history (deposits/withdrawals)\n• All admin deductions\n\n⚠️ This will DELETE entries from ALL pages (User Dashboard AND Admin pages).\n\n🚨 THIS ACTION CANNOT BE UNDONE - ENTRIES WILL BE PERMANENTLY DELETED!`,
      { type: 'danger', title: '⚠️ Delete User History Permanently' }
    );
    
    if (!result) return;

    setResettingHistory(true);
    try {
      const resetResult = await db.resetUserHistory(user.id);
      alert(`✅ Successfully reset history for ${user.displayName}. ${resetResult.deletedCount} transaction(s) hidden from user view.`);
      await loadUsers();
      if (showUserDetails && selectedUser?.id === user.id) {
        setShowUserDetails(false);
      }
    } catch (error) {
      console.error('Error resetting user history:', error);
      alert(`❌ Failed to reset user history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setResettingHistory(false);
    }
  };

  const handleResetSpent = async (user: NeroUser) => {
    if (!confirm) return;
    
    const totalSpent = (user as any).totalSpent || 0;
    const result = await confirm(
      `Are you sure you want to RESET SPENT AMOUNT for "${user.displayName}" (@${user.phone})?\n\nCurrent Spent: PKR ${totalSpent.toLocaleString()}\n\nThis will set their spent amount to 0.\n\nThis action CANNOT be undone!`,
      { type: 'warning', title: '💸 Reset User Spent' }
    );
    
    if (!result) return;

    setResettingSpent(true);
    try {
      await db.resetUserSpent(user.id);
      alert(`✅ Successfully reset spent amount for ${user.displayName} to PKR 0`);
      await loadUsers();
      if (showUserDetails && selectedUser?.id === user.id) {
        setShowUserDetails(false);
      }
    } catch (error) {
      console.error('Error resetting user spent:', error);
      alert(`❌ Failed to reset user spent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setResettingSpent(false);
    }
  };

  const handleCreateUser = async () => {
    // Validate form
    if (!newUser.displayName || !newUser.password || !newUser.username) {
      alert('Please fill in all required fields (Name, Username, Password)');
      return;
    }

    setLoading(true);
    try {
      // Auto-generate email from username
      const autoGeneratedEmail = `${newUser.username}@gmail.com`;
      
      // Create user in database
      await db.createUser({
        username: newUser.username,
        password: newUser.password,
        fullName: newUser.displayName,
        email: autoGeneratedEmail,
        balance: parseInt(newUser.balance) || 0,
        isPartner: newUser.isPartner,
      });

      // Show success message
      console.log(`✅ User ${newUser.displayName} created successfully!`, {
        isPartner: newUser.isPartner ? '🤝 Partner Account' : '👤 Regular User'
      });
      alert(`✅ User ${newUser.displayName} created successfully${newUser.isPartner ? ' as Partner!' : '!'}`);

      // Reload users
      await loadUsers();

      // Reset form and close modal
      setNewUser({
        displayName: '',
        phone: '',
        username: '',
        password: '',
        balance: '0',
        spendingLimit: '10000',
        isPartner: false,
      });
      setShowCreateUserModal(false);
    } catch (error) {
      console.error('Error creating user:', error);
      alert(`❌ Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all users, balances, and permissions
          </p>
        </div>
        <button onClick={() => setShowCreateUserModal(true)} className="nero-btn-primary">
          <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New User
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="nero-card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
        </div>
        <div className="nero-card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {users.filter(u => u.status === 'active').length}
          </p>
        </div>
        <div className="nero-card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Online Now</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {users.filter(u => u.isOnline).length}
          </p>
        </div>
        <div className="nero-card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Balance</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            PKR {users.reduce((sum, u) => sum + u.balance, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="nero-card">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="nero-input pl-10"
          />
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Users Table */}
      <div className="nero-card overflow-hidden">
        <div className="overflow-x-auto nero-scrollbar">
          <table className="nero-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Balance</th>
                <th>Spending Limit</th>
                <th>Projects</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const userProjects = getUserProjects(user.id);
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                          {user.isOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{user.displayName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                          <div className="flex gap-1 mt-1">
                          {user.role === 'admin' && (
                              <span className="nero-badge nero-badge-info text-xs">Admin</span>
                            )}
                            {user.isPartner && (
                              <span className="nero-badge nero-badge-warning text-xs">🤝 Partner</span>
                          )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`nero-badge ${user.status === 'active' ? 'nero-badge-success' : 'nero-badge-error'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>
                      <p className="font-semibold text-gray-900 dark:text-white">PKR {user.balance.toLocaleString()}</p>
                    </td>
                    <td>
                      <p className="text-gray-700 dark:text-gray-300">PKR {user.spendingLimit.toLocaleString()}</p>
                    </td>
                    <td>
                      <p className="text-gray-700 dark:text-gray-300">{userProjects.length} projects</p>
                    </td>
                    <td>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(user.lastLoginAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetails(user)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleTopUp(user)}
                          className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Top Up Balance"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                        {user.role !== 'admin' && (
                          <>
                            <button
                              onClick={() => handleImpersonate(user)}
                              disabled={impersonating}
                              className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Impersonate User"
                            >
                              {impersonating ? (
                                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleDeactivate(user)}
                              className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                              title="Deactivate User"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleResetSpent(user)}
                              disabled={resettingSpent}
                              className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Reset Spent"
                            >
                              {resettingSpent ? (
                                <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleResetHistory(user)}
                              disabled={resettingHistory}
                              className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Reset History"
                            >
                              {resettingHistory ? (
                                <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Up Modal */}
      {showTopUpModal && selectedUser && (
        <div className="nero-modal-overlay" onClick={() => setShowTopUpModal(false)}>
          <div className="nero-card max-w-md w-full animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Top Up Balance</h2>
              <button
                onClick={() => setShowTopUpModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">User</p>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedUser.displayName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Current Balance</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">PKR {selectedUser.balance.toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Top Up Amount (PKR)
                </label>
                <input
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder="Enter amount..."
                  className="nero-input"
                  min="0"
                />
              </div>
              {topUpAmount && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    New Balance: PKR {(selectedUser.balance + parseInt(topUpAmount || '0')).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={confirmTopUp} className="flex-1 nero-btn-primary">
                Confirm Top Up
              </button>
              <button onClick={() => setShowTopUpModal(false)} className="flex-1 nero-btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="nero-modal-overlay" onClick={() => setShowCreateUserModal(false)}>
          <div className="nero-card max-w-lg w-full animate-slide-in overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New User</h2>
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="Enter full name..."
                  className="nero-input"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  placeholder="Enter username (no spaces)..."
                  className="nero-input"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Enter password (min 6 chars)..."
                  className="nero-input"
                  disabled={loading}
                  minLength={6}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Initial Balance (PKR)
                  </label>
                  <input
                    type="number"
                    value={newUser.balance}
                    onChange={(e) => setNewUser({ ...newUser, balance: e.target.value })}
                    placeholder="0"
                    className="nero-input"
                    min="0"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Partner Checkbox */}
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUser.isPartner}
                    onChange={(e) => setNewUser({ ...newUser, isPartner: e.target.checked })}
                    className="w-5 h-5 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      🤝 Mark as Partner
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Partner accounts get special privileges and are displayed with a partner badge
                    </p>
                  </div>
                </label>
              </div>

              {newUser.isPartner && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    This user will be created as a Partner account
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={handleCreateUser} 
                className="flex-1 nero-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? '⏳ Creating...' : 'Create User'}
              </button>
              <button 
                onClick={() => setShowCreateUserModal(false)} 
                className="flex-1 nero-btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <div className="nero-modal-overlay" onClick={() => setShowUserDetails(false)}>
          <div className="nero-card max-w-2xl w-full animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Details</h2>
              <button
                onClick={() => setShowUserDetails(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {selectedUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedUser.displayName}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{selectedUser.email}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">{selectedUser.phone}</p>
                  <div className="flex gap-2 mt-2">
                    {selectedUser.role === 'admin' && (
                      <span className="nero-badge nero-badge-info text-xs">Admin</span>
                    )}
                    {selectedUser.isPartner && (
                      <span className="nero-badge nero-badge-warning text-xs">🤝 Partner</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Balance</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">PKR {selectedUser.balance.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                  <p className="text-xl font-bold text-pink-600 dark:text-pink-400">PKR {((selectedUser as any).totalSpent || 0).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Spending Limit</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">PKR {selectedUser.spendingLimit.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Entries</p>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{((selectedUser as any).entryCount || 0).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Projects</p>
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{getUserProjects(selectedUser.id).length}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                  <span className={`nero-badge ${selectedUser.status === 'active' ? 'nero-badge-success' : 'nero-badge-error'}`}>
                    {selectedUser.status}
                  </span>
                </div>
              </div>

              {/* Reset Actions */}
              <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reset Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleResetSpent(selectedUser)}
                    disabled={resettingSpent}
                    className="px-4 py-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg font-semibold hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-2 border-yellow-300 dark:border-yellow-700"
                  >
                    {resettingSpent ? (
                      <>
                        <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Resetting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>💸 Reset Spent</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleResetHistory(selectedUser)}
                    disabled={resettingHistory}
                    className="px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-2 border-red-300 dark:border-red-700"
                  >
                    {resettingHistory ? (
                      <>
                        <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Resetting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>🔄 Reset History</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  ⚠️ Reset History will hide entries from user view only. Admin pages (Akra, Ring, Packet) will NOT be affected.
                </p>
              </div>

              {/* Activity */}
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Account Info</p>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-slate-700">
                    <span className="text-gray-600 dark:text-gray-400">Created</span>
                    <span className="text-gray-900 dark:text-white">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-slate-700">
                    <span className="text-gray-600 dark:text-gray-400">Last Login</span>
                    <span className="text-gray-900 dark:text-white">{new Date(selectedUser.lastLoginAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600 dark:text-gray-400">Role</span>
                    <span className="text-gray-900 dark:text-white capitalize">{selectedUser.role}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;

