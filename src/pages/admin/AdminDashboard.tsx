import React, { useState, useEffect, useContext, useCallback } from 'react';
import { db } from '../../services/database';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAdminRefresh } from '../../contexts/AdminRefreshContext';
import { ConfirmationContext } from '../../App';
import type { EntryType } from '../../types';
import { localDb } from '../../services/localDb';

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

const DASHBOARD_USERS_CACHE_KEY = 'admin-dashboard-users-cache';

const AdminDashboard: React.FC = () => {
  // INSTANT: Load cache synchronously BEFORE first render
  const initialCachedUsers = typeof window !== 'undefined' 
    ? (() => {
        try {
          const cached = window.localStorage.getItem(DASHBOARD_USERS_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              return parsed;
            }
          }
        } catch {}
        return [];
      })()
    : [];
  
  const [users, setUsers] = useState<any[]>(initialCachedUsers);
  const [selectedFilter, setSelectedFilter] = useState<EntryType | null>(null);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [systemFirstPkr, setSystemFirstPkr] = useState<number>(0);
  const [systemSecondPkr, setSystemSecondPkr] = useState<number>(0);
  const [systemTotalPkr, setSystemTotalPkr] = useState<number>(0);
  const [isUsersLoading, setIsUsersLoading] = useState<boolean>(initialCachedUsers.length === 0);
  const { showSuccess, showError } = useNotifications();
  const { setRefreshCallback } = useAdminRefresh();
  const confirm = useContext(ConfirmationContext);

  const loadUsers = useCallback(async () => {
    // 2) Always fetch fresh data in background (cache already loaded synchronously in useEffect)
    try {
      const data = await db.getAllUsersWithStats();
      setUsers(data);

      // Persist fresh data for instant next render
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DASHBOARD_USERS_CACHE_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsUsersLoading(false);
    }
  }, []);

  const calculateSystemTotals = useCallback(async () => {
    try {
      let totalFirst = 0;
      let totalSecond = 0;

      // If online, use database; otherwise fall back to cached transactions
      if (db.isOnline()) {
        for (const user of users) {
          for (const entryType of ['open', 'akra', 'ring', 'packet'] as EntryType[]) {
            const entries = await db.getUserEntries(user.id, entryType);
            totalFirst += entries.reduce((sum, e) => sum + (e.first_amount || 0), 0);
            totalSecond += entries.reduce((sum, e) => sum + (e.second_amount || 0), 0);
          }
        }
      } else {
        // Offline: use cached transactions in IndexedDB
        const cachedTx = await localDb.transactions.toArray();
        cachedTx.forEach(tx => {
          totalFirst += tx.first_amount || 0;
          totalSecond += tx.second_amount || 0;
        });
      }

      setSystemFirstPkr(totalFirst);
      setSystemSecondPkr(totalSecond);
      setSystemTotalPkr(totalFirst + totalSecond);
    } catch (error) {
      console.error('Error calculating system totals:', error);
    }
  }, [users]);

  const loadUserStatsForType = useCallback(async (entryType: EntryType) => {
    try {
      const stats: UserStats[] = [];

      for (const user of users) {
        let entries: any[] = [];
        if (db.isOnline()) {
          entries = await db.getUserEntries(user.id, entryType);
        } else {
          // Offline: read from cached transactions
          const cached = await localDb.transactions
            .where('entry_type')
            .equals(entryType)
            .filter(t => t.user_id === user.id)
            .toArray();
          entries = cached;
        }

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
  }, [users]);

  // Load users from IndexedDB cache if localStorage cache is empty (offline instant render)
  useEffect(() => {
    if (users.length === 0) {
      (async () => {
        try {
          const cachedUsers = await localDb.users.toArray();
          if (cachedUsers.length > 0) {
            setUsers(cachedUsers as any[]);
            setIsUsersLoading(false);
          }
        } catch (err) {
          console.warn('Failed to load cached users from IndexedDB:', err);
        }
      })();
    }
  }, [users.length]);

  useEffect(() => {
    // Register refresh callback for the refresh button
    setRefreshCallback(() => {
      loadUsers();
      calculateSystemTotals();
      if (selectedFilter) {
        loadUserStatsForType(selectedFilter);
      }
    });
    
    // Initial load (cache already loaded in initial state, this updates it in background)
    loadUsers();

    // Set up real-time subscription for auto-updates (primary live source)
    if (supabase) {
      const subscription = supabase
        .channel('admin-dashboard-realtime')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'transactions'
          },
          (payload: any) => {
            console.log('🔴 Real-time update received for Dashboard (transactions):', payload);
            loadUsers();
            if (selectedFilter) {
              loadUserStatsForType(selectedFilter);
            }
          }
        )
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_users'
          },
          (payload: any) => {
            console.log('🔴 Real-time update received for Dashboard (users):', payload);
            loadUsers();
            if (selectedFilter) {
              loadUserStatsForType(selectedFilter);
            }
          }
        )
        .subscribe((status: string) => {
          console.log('📡 Dashboard subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Dashboard real-time subscription active');
          }
        });

      return () => {
        console.log('🔌 Cleaning up Dashboard subscriptions...');
        subscription.unsubscribe();
      };
    }

    return () => {
      console.log('🔌 Cleaning up dashboard effect (no auto-refresh interval to clear)');
    };
  }, []); // Empty dependency - only run once on mount

  useEffect(() => {
    if (selectedFilter) {
      loadUserStatsForType(selectedFilter);
    }
  }, [selectedFilter, users]);

  // Calculate system totals whenever users change
  useEffect(() => {
    if (users.length > 0) {
      calculateSystemTotals();
    }
  }, [users, calculateSystemTotals]);

  // Calculate GLOBAL unique numbers across all users (not sum of individual user uniques)
  const [globalFirstUnique, setGlobalFirstUnique] = useState<number>(0);
  const [globalSecondUnique, setGlobalSecondUnique] = useState<number>(0);
  
  useEffect(() => {
    const calculateGlobalUnique = async () => {
      if (!selectedFilter) {
        setGlobalFirstUnique(0);
        setGlobalSecondUnique(0);
        return;
      }
      
      try {
        // Get all entries for this type across all users
        const firstNumbers = new Set<string>();
        const secondNumbers = new Set<string>();
        
        if (db.isOnline()) {
          for (const user of users) {
            const entries = await db.getUserEntries(user.id, selectedFilter);
            entries.forEach(e => {
              if (e.first_amount > 0) firstNumbers.add(e.number);
              if (e.second_amount > 0) secondNumbers.add(e.number);
            });
          }
        } else {
          const cached = await localDb.transactions
            .where('entry_type')
            .equals(selectedFilter)
            .toArray();
          cached.forEach(e => {
            if (e.first_amount > 0) firstNumbers.add(e.number);
            if (e.second_amount > 0) secondNumbers.add(e.number);
          });
        }
        
        setGlobalFirstUnique(firstNumbers.size);
        setGlobalSecondUnique(secondNumbers.size);
      } catch (error) {
        console.error('Error calculating global unique numbers:', error);
      }
    };
    
    calculateGlobalUnique();
  }, [selectedFilter, users, userStats]);

  // Combined stats for all users
  const combinedStats = {
    totalEntries: userStats.reduce((sum, u) => sum + u.entryCount, 0),
    firstPkr: userStats.reduce((sum, u) => sum + u.firstPkr, 0),
    secondPkr: userStats.reduce((sum, u) => sum + u.secondPkr, 0),
    totalPkr: userStats.reduce((sum, u) => sum + u.totalPkr, 0),
    firstUnique: userStats.reduce((sum, u) => sum + u.firstUnique, 0),
    secondUnique: userStats.reduce((sum, u) => sum + u.secondUnique, 0),
  };


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
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="text-lg font-semibold mb-2">First PKR</h3>
            <p className="text-3xl font-bold">{systemFirstPkr.toLocaleString()}</p>
            <p className="text-emerald-100 text-sm mt-2">All types (Open, Akra, Ring, Packet)</p>
          </div>
          
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Second PKR</h3>
            <p className="text-3xl font-bold">{systemSecondPkr.toLocaleString()}</p>
            <p className="text-amber-100 text-sm mt-2">All types (Open, Akra, Ring, Packet)</p>
          </div>
          
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Total PKR</h3>
            <p className="text-3xl font-bold">{systemTotalPkr.toLocaleString()}</p>
            <p className="text-cyan-100 text-sm mt-2">First + Second (All users)</p>
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

        {/* Skeleton loader for first-time users (no cache) */}
        {isUsersLoading && users.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="space-y-3 animate-pulse">
                  <div className="bg-gray-200 dark:bg-gray-700 h-4 w-1/2 rounded" />
                  <div className="bg-gray-200 dark:bg-gray-700 h-4 w-1/3 rounded" />
                  <div className="bg-gray-200 dark:bg-gray-700 h-4 w-2/3 rounded" />
                  <div className="bg-gray-200 dark:bg-gray-700 h-4 w-1/4 rounded" />
                  <div className="bg-gray-200 dark:bg-gray-700 h-4 w-3/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

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
                        onClick={async () => {
                          if (!confirm) {
                            console.error('Confirmation dialog not available');
                            showError('Error', 'Confirmation dialog not available');
                            return;
                          }
                          
                          const result = await confirm(
                            `Are you sure you want to RESET ALL DATA for "${user.full_name}" (@${user.username})?\n\nThis will:\n• Delete ALL transactions\n• Delete ALL balance history\n• Reset total spent to 0\n\nThis action CANNOT be undone!`,
                            { type: 'danger', title: '⚠️ Reset User Data' }
                          );
                          
                          if (!result) {
                            console.log('Reset cancelled by user');
                            return;
                          }

                          try {
                            console.log('Starting reset for user:', user.id);
                            const resetResult = await db.resetUserHistory(user.id);
                            console.log('Reset result:', resetResult);
                            
                            await showSuccess(
                              'User Data Reset',
                              `Successfully reset all data for ${user.username} (${resetResult.deletedCount} transactions deleted)`
                            );
                            
                            // Force reload with a small delay to ensure database updates propagate
                            setTimeout(() => {
                            loadUsers();
                            if (selectedFilter) {
                              loadUserStatsForType(selectedFilter);
                            }
                            }, 500);
                          } catch (error: any) {
                            console.error('Error resetting user data:', error);
                            showError('Reset Failed', error?.message || 'Failed to reset user data');
                          }
                        }}
                        className="w-full px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all"
                      >
                        Reset All Data
                      </button>
                    </div>
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



