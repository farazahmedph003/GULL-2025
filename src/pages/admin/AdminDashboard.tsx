import React, { useState, useEffect } from 'react';
import { db } from '../../services/database';
import { useNotifications } from '../../contexts/NotificationContext';
import type { EntryType } from '../../types';

interface UserStats {
  id: string;
  username: string;
  full_name: string;
  balance: number;
  entryCount: number;
  firstPkr: number;
  secondPkr: number;
  totalPkr: number;
  firstUnique: number;
  secondUnique: number;
}

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<EntryType | null>(null);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const { showSuccess, showError } = useNotifications();

  const loadUsers = async () => {
    try {
      const data = await db.getAllUsersWithStats();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadUserStatsForType = async (entryType: EntryType) => {
    try {
      const stats: UserStats[] = [];
      const allEntries: any[] = []; // Collect all entries for global unique calculation

      for (const user of users) {
        const entries = await db.getUserEntries(user.id, entryType);
        allEntries.push(...entries); // Add to global collection
        
        const firstPkr = entries.reduce((sum, e) => sum + (e.first_amount || 0), 0);
        const secondPkr = entries.reduce((sum, e) => sum + (e.second_amount || 0), 0);
        const totalPkr = firstPkr + secondPkr;
        
        // Calculate unique numbers per user
        const uniqueFirst = new Set(entries.filter(e => e.first_amount > 0).map(e => e.number)).size;
        const uniqueSecond = new Set(entries.filter(e => e.second_amount > 0).map(e => e.number)).size;

        stats.push({
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          balance: user.balance,
          entryCount: entries.length,
          firstPkr,
          secondPkr,
          totalPkr,
          firstUnique: uniqueFirst,
          secondUnique: uniqueSecond,
        });
      }

      setUserStats(stats);
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedFilter) {
      loadUserStatsForType(selectedFilter);
    }
  }, [selectedFilter, users]);

  const systemTotalPkr = userStats.reduce((sum, u) => sum + u.totalPkr, 0);
  
  // Calculate GLOBAL unique numbers across all users (not sum of individual user uniques)
  const [globalUniqueNumbers, setGlobalUniqueNumbers] = useState<number>(0);
  const [globalFirstUnique, setGlobalFirstUnique] = useState<number>(0);
  const [globalSecondUnique, setGlobalSecondUnique] = useState<number>(0);
  
  useEffect(() => {
    const calculateGlobalUnique = async () => {
      if (!selectedFilter) {
        setGlobalUniqueNumbers(0);
        setGlobalFirstUnique(0);
        setGlobalSecondUnique(0);
        return;
      }
      
      try {
        // Get all entries for this type across all users
        const allNumbers = new Set<string>();
        const firstNumbers = new Set<string>();
        const secondNumbers = new Set<string>();
        
        for (const user of users) {
          const entries = await db.getUserEntries(user.id, selectedFilter);
          entries.forEach(e => {
            allNumbers.add(e.number);
            // Only add to firstNumbers if first_amount > 0
            if (e.first_amount > 0) {
              firstNumbers.add(e.number);
            }
            // Only add to secondNumbers if second_amount > 0
            if (e.second_amount > 0) {
              secondNumbers.add(e.number);
            }
          });
        }
        
        setGlobalUniqueNumbers(allNumbers.size);
        setGlobalFirstUnique(firstNumbers.size);
        setGlobalSecondUnique(secondNumbers.size);
      } catch (error) {
        console.error('Error calculating global unique numbers:', error);
      }
    };
    
    calculateGlobalUnique();
  }, [selectedFilter, users, userStats]);
  
  const activeUsers = users.filter(u => u.is_active).length;

  // Combined stats for all users
  const combinedStats = {
    totalEntries: userStats.reduce((sum, u) => sum + u.entryCount, 0),
    firstPkr: userStats.reduce((sum, u) => sum + u.firstPkr, 0),
    secondPkr: userStats.reduce((sum, u) => sum + u.secondPkr, 0),
    totalPkr: userStats.reduce((sum, u) => sum + u.totalPkr, 0),
    firstUnique: userStats.reduce((sum, u) => sum + u.firstUnique, 0),
    secondUnique: userStats.reduce((sum, u) => sum + u.secondUnique, 0),
  };

  const handleResetAllData = async () => {
    if (!confirm('Are you sure you want to reset ALL user data? This will delete all transactions, reset all balances to 0, and reset spent to 0. This action cannot be undone!')) {
      return;
    }

    try {
      setIsResetting(true);
      
      // Reset all user balances to 0
      for (const user of users) {
        await db.updateUserBalance(user.id, 0);
      }
      
      // Delete all transactions
      await db.deleteAllTransactions();
      
      // Reset spent to 0 for all users in localStorage
      localStorage.setItem('gull_user_spent', JSON.stringify({}));
      console.log('✅ Spent reset to 0 for all users');
      
      // Reload data
      await loadUsers();
      if (selectedFilter) {
        await loadUserStatsForType(selectedFilter);
      }
      
      showSuccess('Success', 'All user data has been reset successfully (balance, transactions, and spent)');
    } catch (error) {
      console.error('Reset error:', error);
      showError('Error', 'Failed to reset user data');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              📊 Admin Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              System overview and user statistics
            </p>
          </div>
          <button
            onClick={() => {
              loadUsers();
              if (selectedFilter) {
                loadUserStatsForType(selectedFilter);
              }
            }}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Data
          </button>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Total PKR</h3>
            <p className="text-3xl font-bold">{systemTotalPkr.toLocaleString()}</p>
            <p className="text-teal-100 text-sm mt-2">Across all users</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Unique Numbers</h3>
            <p className="text-3xl font-bold">{globalUniqueNumbers}</p>
            <p className="text-orange-100 text-sm mt-2">Total unique entries</p>
          </div>

          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Active Users</h3>
            <p className="text-3xl font-bold">{activeUsers}</p>
            <p className="text-cyan-100 text-sm mt-2">Out of {users.length} total</p>
          </div>
        </div>


        {/* Filter Buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Filter by Entry Type</h2>
          <div className="flex flex-wrap gap-3">
            {(['open', 'akra', 'ring', 'packet'] as EntryType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedFilter(type === selectedFilter ? null : type)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  selectedFilter === type
                    ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
            {selectedFilter && (
              <button
                onClick={() => setSelectedFilter(null)}
                className="px-6 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* User Stats Grid (shown when filter selected) */}
        {selectedFilter && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {selectedFilter.toUpperCase()} - User Statistics
            </h2>

            {/* Combined Statistics Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Entries</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{combinedStats.totalEntries}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">First PKR</p>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {combinedStats.firstPkr.toLocaleString()}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Second PKR</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {combinedStats.secondPkr.toLocaleString()}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total PKR</p>
                <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                  {combinedStats.totalPkr.toLocaleString()}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">First Unique</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {globalFirstUnique}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Second Unique</p>
                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  {globalSecondUnique}
                </p>
              </div>
            </div>

            {/* Reset Button */}
            <div className="flex justify-end mb-8">
              <button
                onClick={handleResetAllData}
                disabled={isResetting}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
              >
                {isResetting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Resetting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset All Data
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userStats.map((user) => (
                  <div key={user.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {user.full_name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">@{user.username}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-500">Balance</p>
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">
                            PKR {user.balance.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Total Entries:</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{user.entryCount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">First PKR:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {user.firstPkr.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Second PKR:</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {user.secondPkr.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Total PKR:</span>
                          <span className="font-bold text-cyan-600 dark:text-cyan-400">
                            {user.totalPkr.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">First Unique:</span>
                          <span className="font-semibold text-purple-600 dark:text-purple-400">
                            {user.firstUnique}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Second Unique:</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {user.secondUnique}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                        className="w-full px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-teal-700 transition-all"
                      >
                        {expandedUserId === user.id ? 'Hide Details' : 'View Details'}
                      </button>
                    </div>

                    {expandedUserId === user.id && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900/50">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Detailed statistics and actions coming soon...
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
          </div>
        )}

        {!selectedFilter && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Select an entry type above to view detailed user statistics
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;



