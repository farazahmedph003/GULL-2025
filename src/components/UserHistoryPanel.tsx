import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Transaction } from '../types';
import { supabase, supabaseAdmin } from '../lib/supabase';

interface HistoryItem {
  id: string;
  created_at: string;
  createdAt?: string;
  isEntry?: boolean;
  isTopUp?: boolean;
  isAdminAction?: boolean;
  // Transaction fields
  number?: string;
  entry_type?: string;
  entryType?: string;
  first_amount?: number;
  first?: number;
  second_amount?: number;
  second?: number;
  // Top-up fields
  amount?: number;
  // Admin action fields
  action_type?: string;
  description?: string;
  metadata?: any;
  admin_user?: {
    username?: string;
    email?: string;
  };
}

interface UserHistoryPanelProps {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
}

const UserHistoryPanel: React.FC<UserHistoryPanelProps> = ({ transactions, onEdit, onDelete }) => {
  const { user } = useAuth();
  const [adminActions, setAdminActions] = useState<any[]>([]);
  const [topUps, setTopUps] = useState<any[]>([]);

  // Load admin actions and top-ups once
  useEffect(() => {
    loadAdditionalHistory();
  }, [user?.id]);

  const loadAdditionalHistory = async () => {
    if (!user?.id) {
      return;
    }
    
    try {
      const client = supabaseAdmin || supabase;
      
      if (!client) {
        return;
      }

      // Load admin actions
      try {
        const { data: actions } = await client
          .from('admin_actions')
          .select('*, admin_user:admin_user_id(username, email)')
          .eq('target_user_id', user.id)
          .order('created_at', { ascending: false });

        if (actions) {
          setAdminActions(actions.map((a: any) => ({ ...a, isAdminAction: true })));
        }
      } catch (err) {
        console.warn('Could not load admin actions:', err);
      }

      // Load top-ups
      try {
        const { data: balanceHistory } = await client
          .from('balance_history')
          .select('*')
          .eq('app_user_id', user.id)
          .eq('type', 'top_up')
          .order('created_at', { ascending: false });

        if (balanceHistory) {
          setTopUps(balanceHistory.map((t: any) => ({ ...t, isTopUp: true })));
        }
      } catch (err) {
        console.warn('Could not load top-ups:', err);
      }
    } catch (error) {
      console.error('Error loading additional history:', error);
    }
  };

  // Combine transactions (from props) with admin actions and top-ups
  const history = useMemo(() => {
    const combined = [
      ...transactions.map((t: any) => ({ ...t, isEntry: true })),
      ...topUps,
      ...adminActions,
    ];

    combined.sort((a, b) => {
      const dateA = a.created_at || a.createdAt || '';
      const dateB = b.created_at || b.createdAt || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return combined;
  }, [transactions, topUps, adminActions]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getItemDate = (item: HistoryItem) => {
    return item.created_at || item.createdAt || '';
  };

  const getEntryType = (item: HistoryItem) => {
    return item.entry_type || item.entryType || '';
  };

  const getFirstAmount = (item: HistoryItem) => {
    return item.first_amount || item.first || 0;
  };

  const getSecondAmount = (item: HistoryItem) => {
    return item.second_amount || item.second || 0;
  };

  const renderHistoryItem = (item: HistoryItem) => {
    // Admin Action
    if (item.isAdminAction) {
      return (
        <div
          key={item.id}
          className="px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors rounded-lg border-l-4 border-orange-500"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-semibold text-orange-700 dark:text-orange-400 uppercase text-xs tracking-wide">
                  Admin Action
                </span>
              </div>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {item.description}
              </p>
              {item.admin_user && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  By: {item.admin_user.username || item.admin_user.email}
                </p>
              )}
              {item.metadata && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  {item.metadata.entryType && <span className="mr-3">Type: {item.metadata.entryType.toUpperCase()}</span>}
                  {item.metadata.numbersCount && <span className="mr-3">Numbers: {item.metadata.numbersCount}</span>}
                  {item.metadata.entriesUpdated && <span>Updated: {item.metadata.entriesUpdated} entries</span>}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 ml-4 text-right">
              {formatDate(getItemDate(item))}
            </div>
          </div>
        </div>
      );
    }

    // Top-up
    if (item.isTopUp) {
      return (
        <div
          key={item.id}
          className="px-4 py-3 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors rounded-lg border-l-4 border-green-500"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="font-semibold text-green-700 dark:text-green-400 uppercase text-xs tracking-wide">
                  Balance Top-Up
                </span>
              </div>
              <p className="text-gray-900 dark:text-gray-100 font-bold text-lg">
                +PKR {item.amount?.toLocaleString() || 0}
              </p>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 ml-4 text-right">
              {formatDate(getItemDate(item))}
            </div>
          </div>
        </div>
      );
    }

    // Transaction/Entry
    if (item.isEntry) {
      const firstAmount = getFirstAmount(item);
      const secondAmount = getSecondAmount(item);
      const entryType = getEntryType(item);

      return (
        <div
          key={item.id}
          className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors rounded-lg border-l-4 border-blue-500"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-bold text-xl text-gray-900 dark:text-gray-100">
                  {item.number}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  {entryType}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {firstAmount > 0 && (
                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    F {firstAmount.toLocaleString()}
                  </div>
                )}
                {secondAmount > 0 && (
                  <div className="text-amber-600 dark:text-amber-400 font-semibold">
                    S {secondAmount.toLocaleString()}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatDate(getItemDate(item))}
              </div>
            </div>
            
            {/* Edit and Delete Actions */}
            <div className="flex items-center gap-2 ml-4">
              {onEdit && (
                <button
                  onClick={() => {
                    const transaction: Transaction = {
                      id: item.id,
                      number: item.number || '',
                      entryType: (item.entryType || item.entry_type || 'akra') as any,
                      first: getFirstAmount(item),
                      second: getSecondAmount(item),
                      projectId: 'user-scope',
                      createdAt: getItemDate(item),
                      updatedAt: getItemDate(item),
                    };
                    onEdit(transaction);
                  }}
                  className="p-2.5 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 transition-colors"
                  title="Edit entry"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-2.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 transition-colors"
                  title="Delete entry"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };


  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-300 mb-2">Complete History</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {history.length} total activities
          </p>
        </div>
        <button
          onClick={loadAdditionalHistory}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Refresh history"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 min-h-[400px] max-h-[600px] overflow-y-auto">
        {history.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-2">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500">No activity yet</p>
            <p className="text-gray-600 text-sm mt-1">Your history will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => renderHistoryItem(item))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserHistoryPanel;

