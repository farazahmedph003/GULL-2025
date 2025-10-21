import React, { useState, useMemo, useEffect } from 'react';
import { useAdminData } from '../../hooks/useAdmin';
import LoadingSpinner from '../../components/LoadingSpinner';
import { db } from '../../services/database';
import { isOfflineMode, isSupabaseConfigured, isSupabaseConnected } from '../../lib/supabase';
import type { EntryType, Project, Transaction, ProjectStatistics } from '../../types';

const AdminFinancial: React.FC = () => {
  const { users, loading, refresh: refreshAdminData } = useAdminData();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedEntryType, setSelectedEntryType] = useState<EntryType | 'all'>('all');
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [projectTransactions, setProjectTransactions] = useState<Transaction[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  // Debug users loading
  useEffect(() => {
    console.log('AdminFinancial - Users updated:', { 
      usersCount: users?.length || 0, 
      loading,
      users: users?.map(u => ({ id: u.id, userId: u.userId, email: u.email })) 
    });
  }, [users, loading]);

  // Fetch user projects when user is selected
  useEffect(() => {
    const fetchUserProjects = async () => {
      if (!selectedUserId) {
        setUserProjects([]);
        setSelectedProjectId(null);
        setProjectsError(null);
        return;
      }

      // Don't attempt to fetch projects if users are still loading
      if (loading || !users) {
        console.log('Skipping project fetch - users still loading or not available');
        return;
      }

      setProjectsLoading(true);
      setProjectsError(null);
      try {
        console.log('Database connection status:', {
          isOffline: isOfflineMode(),
          isConfigured: isSupabaseConfigured(),
          isConnected: isSupabaseConnected(),
        });
        console.log('Fetching projects for user:', selectedUserId);
        console.log('Available users:', users?.map(u => ({ id: u.id, userId: u.userId, email: u.email })));
        
        if (!selectedUserId) {
          throw new Error('No user ID provided');
        }
        
        const projects = await db.getUserProjects(selectedUserId);
        console.log('Projects fetched:', projects);
        setUserProjects(projects);
        // Reset selected project when user changes
        setSelectedProjectId(null);
      } catch (error) {
        console.error('Error fetching user projects:', error);
        setUserProjects([]);
        let errorMessage = 'Failed to fetch user projects.';
        if (isOfflineMode()) {
          errorMessage = 'Database is in offline mode. Please check your connection settings.';
        } else if (!isSupabaseConfigured()) {
          errorMessage = 'Database is not properly configured. Please check your environment settings.';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        setProjectsError(errorMessage);
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchUserProjects();
  }, [selectedUserId, users, loading]);

  // Fetch project transactions when project is selected
  useEffect(() => {
    const fetchProjectTransactions = async () => {
      if (!selectedProjectId) {
        setProjectTransactions([]);
        setTransactionsError(null);
        return;
      }

      setTransactionsLoading(true);
      setTransactionsError(null);
      try {
        console.log('Fetching transactions for project:', selectedProjectId);
        const transactions = await db.getTransactions(selectedProjectId);
        console.log('Transactions fetched:', transactions.length, 'transactions');
        setProjectTransactions(transactions);
      } catch (error) {
        console.error('Error fetching project transactions:', error);
        setProjectTransactions([]);
        let errorMessage = 'Failed to fetch project transactions.';
        if (isOfflineMode()) {
          errorMessage = 'Database is in offline mode. Please check your connection settings.';
        } else if (!isSupabaseConfigured()) {
          errorMessage = 'Database is not properly configured. Please check your environment settings.';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        setTransactionsError(errorMessage);
      } finally {
        setTransactionsLoading(false);
      }
    };

    fetchProjectTransactions();
  }, [selectedProjectId]);

  // Calculate filtered statistics based on selected user, project, and entry type
  const filteredStats = useMemo((): ProjectStatistics => {
    if (!selectedProjectId || !projectTransactions.length) {
      return {
        totalEntries: 0,
        akraEntries: 0,
        ringEntries: 0,
        firstTotal: 0,
        secondTotal: 0,
        uniqueNumbers: 0,
      };
    }

    // Filter transactions by entry type if not 'all'
    const filteredTransactions = selectedEntryType === 'all' 
      ? projectTransactions 
      : projectTransactions.filter(t => t.entryType === selectedEntryType);

    const firstTotal = filteredTransactions.reduce((sum, t) => sum + t.first, 0);
    const secondTotal = filteredTransactions.reduce((sum, t) => sum + t.second, 0);
    
    // Calculate unique numbers properly handling bulk entries
    const uniqueNumbersSet = new Set<string>();
    filteredTransactions.forEach(t => {
      const isBulkEntry = t.number.includes(',') || t.number.includes(' ');
      if (isBulkEntry) {
        const numbers = t.number.split(/[,\s]+/).filter(n => n.trim().length > 0);
        numbers.forEach(num => uniqueNumbersSet.add(num.trim()));
      } else {
        uniqueNumbersSet.add(t.number);
      }
    });

    return {
      totalEntries: filteredTransactions.length,
      akraEntries: projectTransactions.filter(t => t.entryType === 'akra').length,
      ringEntries: projectTransactions.filter(t => t.entryType === 'ring').length,
      firstTotal,
      secondTotal,
      uniqueNumbers: uniqueNumbersSet.size,
    };
  }, [selectedProjectId, projectTransactions, selectedEntryType]);

  // Get available entry types for selected project
  const availableEntryTypes = useMemo(() => {
    if (!selectedProjectId) return [];
    const project = userProjects.find(p => p.id === selectedProjectId);
    return project?.entryTypes || [];
  }, [selectedProjectId, userProjects]);

  // Calculate financial metrics
  const metrics = useMemo(() => {
    if (!users) return null;

    const totalBalance = users.reduce((sum, u) => sum + u.balance, 0);
    const avgBalance = totalBalance / users.length;
    const topUsers = [...users].sort((a, b) => b.balance - a.balance).slice(0, 5);
    const lowBalanceUsers = users.filter(u => u.balance < 1000);

    return {
      totalBalance,
      avgBalance,
      topUsers,
      lowBalanceUsers,
      usersWithBalance: users.filter(u => u.balance > 0).length,
      usersWithoutBalance: users.filter(u => u.balance === 0).length,
    };
  }, [users]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financial Overview</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track balances, transactions, and financial metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTimeRange('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              timeRange === 'today'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeRange('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              timeRange === 'week'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              timeRange === 'month'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              timeRange === 'all'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* User and Project Selection */}
      <div className="card-premium">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Select User & Project</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select User
            </label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
              className="input-field w-full"
              disabled={loading}
            >
              <option value="">{loading ? 'Loading users...' : 'Choose a user...'}</option>
              {users?.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.displayName} ({user.email})
                </option>
              ))}
            </select>
            {loading && <div className="text-sm text-gray-500 mt-1">Loading users...</div>}
            {!loading && (!users || users.length === 0) && (
              <div className="text-sm text-yellow-600 mt-1 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                No users found. Make sure the database has profile records.
              </div>
            )}
          </div>

          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Project
            </label>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              className="input-field w-full"
              disabled={!selectedUserId || projectsLoading}
            >
              <option value="">Choose a project...</option>
              {userProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {projectsLoading && <div className="text-sm text-gray-500 mt-1">Loading projects...</div>}
            {projectsError && (
              <div className="text-sm text-red-500 mt-1 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {projectsError}
              </div>
            )}
            {!projectsLoading && !projectsError && selectedUserId && userProjects.length === 0 && (
              <div className="text-sm text-gray-500 mt-1 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                No projects found for this user.
              </div>
            )}
          </div>

          {/* Entry Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Entry Type
            </label>
            <select
              value={selectedEntryType}
              onChange={(e) => setSelectedEntryType(e.target.value as EntryType | 'all')}
              className="input-field w-full"
              disabled={!selectedProjectId}
            >
              <option value="all">All Types</option>
              {availableEntryTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filtered Statistics (4 boxes) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-premium bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-blue-100 text-sm font-medium">FIRST Total</p>
            <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold">PKR {filteredStats.firstTotal.toLocaleString()}</p>
          <p className="text-blue-200 text-sm mt-2">{selectedEntryType === 'all' ? 'Total amount' : `${selectedEntryType.charAt(0).toUpperCase() + selectedEntryType.slice(1)} only`}</p>
        </div>

        <div className="card-premium bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-100 text-sm font-medium">SECOND Total</p>
            <svg className="w-8 h-8 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold">PKR {filteredStats.secondTotal.toLocaleString()}</p>
          <p className="text-green-200 text-sm mt-2">{selectedEntryType === 'all' ? 'Total amount' : `${selectedEntryType.charAt(0).toUpperCase() + selectedEntryType.slice(1)} only`}</p>
        </div>

        <div className="card-premium bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-purple-100 text-sm font-medium">Total PKR</p>
            <svg className="w-8 h-8 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold">PKR {(filteredStats.firstTotal + filteredStats.secondTotal).toLocaleString()}</p>
          <p className="text-purple-200 text-sm mt-2">First + Second</p>
        </div>

        <div className="card-premium bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-orange-100 text-sm font-medium">Unique Numbers</p>
            <svg className="w-8 h-8 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
          <p className="text-3xl font-bold">{filteredStats.uniqueNumbers}</p>
          <p className="text-orange-200 text-sm mt-2">Different numbers</p>
        </div>
      </div>

      {/* Selected Project Stats */}
      {selectedProjectId && (
        <div className="card-premium">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            {selectedEntryType === 'all' ? 'Project Statistics' : `${selectedEntryType.charAt(0).toUpperCase() + selectedEntryType.slice(1)} Statistics`}
          </h2>
          
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading transaction data...</span>
            </div>
          ) : transactionsError ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-4 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <p className="font-medium">Failed to load transaction data</p>
                <p className="text-sm mt-1">{transactionsError}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {filteredStats.totalEntries}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Total Entries</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  PKR {filteredStats.firstTotal.toLocaleString()}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">First Total</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  PKR {filteredStats.secondTotal.toLocaleString()}
                </div>
                <div className="text-sm text-purple-700 dark:text-purple-300">Second Total</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {filteredStats.uniqueNumbers}
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">Unique Numbers</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Low Balance Users */}
      <div className="grid grid-cols-1 gap-6">
        <div className="card-premium">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Low Balance Alerts</h2>
            <span className="px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold rounded-full">
              {metrics.lowBalanceUsers.length} Users
            </span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {metrics.lowBalanceUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">✅ No low balance users</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">All users have balance above PKR 1,000</p>
              </div>
            ) : (
              metrics.lowBalanceUsers.map((user) => (
                <div key={user.userId} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{user.displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-600 dark:text-orange-400">
                      {user.balance.toLocaleString()} PKR
                    </p>
                    <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1">
                      Top Up
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Balance Distribution Chart (Simple bars) */}
      <div className="card-premium">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Balance Distribution</h2>
        <div className="space-y-4">
          {[
            { range: '0 PKR', count: metrics.usersWithoutBalance, color: 'bg-red-500' },
            { range: '1 - 1,000 PKR', count: users?.filter(u => u.balance > 0 && u.balance <= 1000).length || 0, color: 'bg-orange-500' },
            { range: '1,001 - 5,000 PKR', count: users?.filter(u => u.balance > 1000 && u.balance <= 5000).length || 0, color: 'bg-yellow-500' },
            { range: '5,001 - 10,000 PKR', count: users?.filter(u => u.balance > 5000 && u.balance <= 10000).length || 0, color: 'bg-blue-500' },
            { range: '10,000+ PKR', count: users?.filter(u => u.balance > 10000).length || 0, color: 'bg-green-500' },
          ].map((item) => (
            <div key={item.range}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.range}</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{item.count} users</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                <div
                  className={`${item.color} h-4 rounded-full transition-all duration-500 flex items-center justify-end px-2`}
                  style={{ width: `${(item.count / (users?.length || 1)) * 100}%` }}
                >
                  <span className="text-xs text-white font-semibold">
                    {Math.round((item.count / (users?.length || 1)) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminFinancial;

