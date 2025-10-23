import React, { useState, useEffect } from 'react';
import { db } from '../../services/database';
import LoadingSpinner from '../../components/LoadingSpinner';
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
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await db.getAllUsersWithStats();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserStatsForType = async (entryType: EntryType) => {
    try {
      setLoading(true);
      const stats: UserStats[] = [];

      for (const user of users) {
        const entries = await db.getUserEntries(user.id, entryType);
        
        const firstPkr = entries.reduce((sum, e) => sum + (e.first_amount || 0), 0);
        const secondPkr = entries.reduce((sum, e) => sum + (e.second_amount || 0), 0);
        const totalPkr = firstPkr + secondPkr;
        
        // Calculate unique numbers
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
    } finally {
      setLoading(false);
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
  const systemUniqueNumbers = userStats.reduce((sum, u) => sum + Math.max(u.firstUnique, u.secondUnique), 0);
  const activeUsers = users.filter(u => u.is_active).length;

  if (loading && !selectedFilter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📊 Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            System overview and user statistics
          </p>
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
            <p className="text-3xl font-bold">{systemUniqueNumbers}</p>
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

            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner text="Loading stats..." />
              </div>
            ) : (
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
            )}
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



