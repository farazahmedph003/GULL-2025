import { useState, useEffect, useCallback } from 'react';
import type { Transaction, ProjectStatistics } from '../types';
import { useUserBalance } from './useUserBalance';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/database';
import { isSupabaseConfigured, isOfflineMode } from '../lib/supabase';
import { getCachedData, setCachedData, CACHE_KEYS } from '../utils/cache';
import { enqueue } from '../services/localDb';

// In projectless mode, pass 'user-scope' for current user
export const useTransactions = (projectId: string) => {
  const isUserScope = projectId === 'user-scope';
  const storageKey = isUserScope ? 'gull-transactions-user' : `gull-transactions-${projectId}`;
  const cacheKey = isUserScope ? CACHE_KEYS.USER_TRANSACTIONS : `cache-transactions-${projectId}`;
  
  // INSTANT: Check cache synchronously to determine initial loading state
  const cacheConfig = {
    key: cacheKey,
    validator: (data: any): data is Transaction[] => Array.isArray(data),
  };
  const initialCached = typeof window !== 'undefined' ? getCachedData<Transaction[]>(cacheConfig) : { data: null };
  
  const [transactions, setTransactions] = useState<Transaction[]>(initialCached.data || []);
  const [loading, setLoading] = useState(!initialCached.data); // Only loading if no cache
  const [error, setError] = useState<string | null>(null);
  const { user, isImpersonating, originalAdminUser } = useAuth();
  const { deductBalance, addBalance } = useUserBalance();

  const removeTransactionsById = useCallback((idsToRemove: string[]) => {
    if (!idsToRemove?.length) {
      return;
    }
    const idSet = new Set(idsToRemove);
    setTransactions(prevTransactions => {
      const updated = prevTransactions.filter(t => !idSet.has(t.id));
      localStorage.setItem(storageKey, JSON.stringify(updated));
      // INSTANT: Update cache immediately
      setCachedData(cacheConfig, updated);
      return updated;
    });
  }, [storageKey, cacheConfig]);

  const settleBalanceForAmount = useCallback(async (amount: number) => {
    if (amount === 0) {
      return;
    }

    // IMPORTANT: Don't update total_spent here - let database trigger/reconciliation handle it to avoid doubling
    if (amount > 0) {
      const success = await addBalance(amount, false); // adjustSpent=false to prevent doubling
      if (!success) {
        throw new Error('Failed to refund user balance');
      }
    } else {
      const success = await deductBalance(Math.abs(amount), false); // adjustSpent=false to prevent doubling
      if (!success) {
        throw new Error('Failed to adjust user balance');
      }
    }
  }, [addBalance, deductBalance]);

  // Load transactions from database with stale-while-revalidate cache
  const loadTransactions = useCallback(async () => {
    setError(null);

    // Cache already loaded synchronously in initial state, so just fetch fresh data
    // But check cache again in case it was updated elsewhere
    const cached = getCachedData<Transaction[]>(cacheConfig);
    if (cached.data && transactions.length === 0) {
      // If state is empty but cache exists, load it (shouldn't happen but safety check)
      setTransactions(cached.data);
      setLoading(false);
    }

    // 2. Always fetch fresh data in background
    try {
      if (isSupabaseConfigured() && !isOfflineMode()) {
        console.log('🌐 Loading transactions from database for project:', projectId);
        
        const userId = user?.id;
        const dbTransactions = await db.getTransactions(projectId, userId);
        console.log('✅ Transactions loaded from database:', dbTransactions.length, userId ? `(filtered by user: ${userId})` : '(all users)');

        // Sort by date (newest first)
        const sortedTransactions = [...dbTransactions].sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });

        // Update cache and state
        setCachedData(cacheConfig, sortedTransactions);
        setTransactions(sortedTransactions);
        
        // Also update legacy storage key for compatibility
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(sortedTransactions));
        }
        
      } else if (isOfflineMode()) {
        // Offline mode: use cache only
        console.log('📱 Offline mode - using cached transactions');
        if (cached.data) {
          setTransactions(cached.data);
        }
      } else {
        // No Supabase configured: use cache only
        console.log('⚠️ No Supabase configured, using cached transactions');
        if (cached.data) {
          setTransactions(cached.data);
        }
      }
    } catch (error) {
      console.error('❌ Error loading transactions:', error);
      
      // Fallback to cached data if available
      if (cached.data) {
        console.log('🔄 Using cached data as fallback');
        setTransactions(cached.data);
      } else {
        // Try legacy storage key as last resort
        try {
          const legacyData = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
          if (legacyData) {
            const parsed = JSON.parse(legacyData);
            setTransactions(parsed);
          } else {
            setTransactions([]);
          }
        } catch {
          setTransactions([]);
        }
      }
      
      let errorMessage = 'Failed to load transactions from database.';
      if (isOfflineMode()) {
        errorMessage = 'Database is in offline mode. Using cached data.';
      } else if (!isSupabaseConfigured()) {
        errorMessage = 'Database is not configured. Using cached data.';
      } else if (error instanceof Error) {
        errorMessage = `Database error: ${error.message}. Using cached data.`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.id, isUserScope, storageKey]);

  // Initial load
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Refresh transactions
  const refresh = useCallback(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Calculate statistics
  const getStatistics = useCallback((): ProjectStatistics => {
    const akraTransactions = transactions.filter(t => t.entryType === 'akra');
    const ringTransactions = transactions.filter(t => t.entryType === 'ring');
    
    const firstTotal = transactions.reduce((sum, t) => sum + t.first, 0);
    const secondTotal = transactions.reduce((sum, t) => sum + t.second, 0);
    
    // Calculate unique numbers properly handling bulk entries
    const uniqueNumbersSet = new Set<string>();
    transactions.forEach(t => {
      // Check if this is a bulk entry (contains comma or space separated numbers)
      const isBulkEntry = t.number.includes(',') || t.number.includes(' ');
      if (isBulkEntry) {
        // Split bulk entry into individual numbers
        const numbers = t.number.split(/[,\s]+/).filter(n => n.trim().length > 0);
        numbers.forEach(num => uniqueNumbersSet.add(num.trim()));
      } else {
        // Single entry
        uniqueNumbersSet.add(t.number);
      }
    });
    const uniqueNumbers = uniqueNumbersSet.size;

    return {
      totalEntries: transactions.length,
      akraEntries: akraTransactions.length,
      ringEntries: ringTransactions.length,
      firstTotal,
      secondTotal,
      uniqueNumbers,
    };
  }, [transactions]);

  // Get transactions by entry type
  const getByEntryType = useCallback((entryType: 'akra' | 'ring') => {
    return transactions.filter(t => t.entryType === entryType);
  }, [transactions]);

  // Get transactions by number
  const getByNumber = useCallback((number: string) => {
    return transactions.filter(t => {
      // Check if this transaction is a bulk entry that contains our number
      const isBulkEntry = t.number.includes(',') || t.number.includes(' ');
      if (isBulkEntry) {
        const numbers = t.number.split(/[,\s]+/).map(n => n.trim());
        return numbers.includes(number);
      }
      
      // For single entries, check exact match
      return t.number === number;
    });
  }, [transactions]);

  // Get transaction by ID
  const getTransaction = useCallback((transactionId: string) => {
    return transactions.find(t => t.id === transactionId);
  }, [transactions]);

  // Delete transaction with balance refund
  const deleteTransaction = useCallback(async (transactionId: string) => {
    const transactionToDelete = transactions.find(t => t.id === transactionId);
    if (!transactionToDelete) {
      throw new Error('Transaction not found');
    }

    const refundAmount = (transactionToDelete.first || 0) + (transactionToDelete.second || 0);
    const shouldUseDatabase = isSupabaseConfigured() && !isOfflineMode();

    try {
      if (shouldUseDatabase) {
        await db.deleteTransaction(transactionId, isImpersonating ? originalAdminUser?.id : undefined);
      } else {
        await enqueue('transactions', 'delete', {
          ids: [transactionId],
          adminUserId: isImpersonating ? originalAdminUser?.id : undefined,
        });
      }

      await settleBalanceForAmount(refundAmount);
      removeTransactionsById([transactionId]);
      
      return true;
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error instanceof Error ? error : new Error('Failed to delete transaction');
    }
  }, [transactions, removeTransactionsById, settleBalanceForAmount, isImpersonating, originalAdminUser?.id]);

  // Bulk delete transactions with balance refunds (using batch operation)
  const bulkDeleteTransactions = useCallback(async (transactionIds: string[]) => {
    if (!transactionIds.length) {
      return false;
    }

    const targetTransactions = transactions.filter(t => transactionIds.includes(t.id));
    if (!targetTransactions.length) {
      throw new Error('No transactions found for deletion');
    }

    const shouldUseDatabase = isSupabaseConfigured() && !isOfflineMode();
    const deletedTransactions: Transaction[] = [];

    const finalizeDeleted = async () => {
      if (!deletedTransactions.length) {
        return;
      }
      const totalAmount = deletedTransactions.reduce((sum, t) => {
        return sum + (t.first || 0) + (t.second || 0);
      }, 0);
      await settleBalanceForAmount(totalAmount);
      removeTransactionsById(deletedTransactions.map(t => t.id));
    };

    try {
      if (shouldUseDatabase) {
        // Use batch delete for instant deletion
        console.log(`🚀 Batch deleting ${targetTransactions.length} transactions...`);
        await db.deleteTransactionsBatch(
          targetTransactions.map(t => t.id),
          isImpersonating ? originalAdminUser?.id : undefined
        );
        deletedTransactions.push(...targetTransactions);
        console.log(`✅ Batch delete complete!`);
      } else {
        deletedTransactions.push(...targetTransactions);

        // Queue batch delete for sync
        await enqueue('transactions', 'delete', {
          ids: targetTransactions.map(t => t.id),
          adminUserId: isImpersonating ? originalAdminUser?.id : undefined,
        });
      }

      await finalizeDeleted();
      return deletedTransactions.length === transactionIds.length;
    } catch (error) {
      console.error('Error bulk deleting transactions:', error);
      await finalizeDeleted();
      throw error instanceof Error ? error : new Error('Failed to bulk delete transactions');
    }
  }, [transactions, removeTransactionsById, settleBalanceForAmount, isImpersonating, originalAdminUser?.id]);

  // Add transaction with balance integration
  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>, skipBalanceDeduction: boolean = false): Promise<Transaction | null> => {
    console.log('🔍 Debug - addTransaction called with:', transaction, 'skipBalanceDeduction:', skipBalanceDeduction);
    try {
      // Calculate total cost for balance deduction
      const totalCost = (transaction.first || 0) + (transaction.second || 0);
      console.log('🔍 Debug - Total cost:', totalCost);
      
      // Deduct balance for positive amounts (only if not skipped)
      if (!skipBalanceDeduction && totalCost > 0) {
        console.log('🔍 Debug - Attempting to deduct balance:', totalCost);
        const success = await deductBalance(totalCost);
        console.log('🔍 Debug - Balance deduction result:', success);
        if (!success) {
          throw new Error('Failed to deduct balance');
        }
      }

      // Add balance for negative amounts (refunds/deductions)
      if (!skipBalanceDeduction && totalCost < 0) {
        const success = await addBalance(Math.abs(totalCost));
        if (!success) {
          throw new Error('Failed to add balance');
        }
      }

      let newTransaction: Transaction;

      // Try to save to Supabase first (only if user is authenticated)
      // Note: We save even for 'user-scope' mode - projectId is just used as an identifier
      if (isSupabaseConfigured() && !isOfflineMode() && user?.id) {
        try {
          console.log('🔍 Debug - Attempting to save transaction to Supabase for user:', user.id);
          console.log('🔍 Debug - Transaction data:', transaction);
          console.log('🔍 Debug - isImpersonating:', isImpersonating);
          console.log('🔍 Debug - originalAdminUser:', originalAdminUser?.id);
          newTransaction = await db.createTransaction(user.id, transaction, isImpersonating ? originalAdminUser?.id : undefined);
          console.log('✅ Transaction saved to Supabase:', newTransaction.id);
        } catch (dbError) {
          console.error('❌ Failed to save to Supabase, falling back to localStorage:', dbError);
          console.error('❌ Error details:', JSON.stringify(dbError, null, 2));
          // Fallback to localStorage
          newTransaction = {
            ...transaction,
            id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      } else {
        console.log('🔍 Debug - Not saving to Supabase, reasons:', {
          isSupabaseConfigured: isSupabaseConfigured(),
          isOfflineMode: isOfflineMode(),
          hasUserId: !!user?.id,
          userId: user?.id
        });
        // Offline mode - use localStorage
        newTransaction = {
          ...transaction,
          id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Queue for sync when back online
        const offlineUserId = user?.id || 'offline-user';
        await enqueue('transactions', 'create', {
          userId: offlineUserId,
          transaction,
          adminUserId: isImpersonating ? originalAdminUser?.id : undefined,
        });
      }

      // INSTANT: Update state and cache immediately
      setTransactions(prevTransactions => {
        const updatedTransactions = [...prevTransactions, newTransaction].sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA; // Newest first
        });
        // Always save to localStorage as backup/cache
        localStorage.setItem(storageKey, JSON.stringify(updatedTransactions));
        // INSTANT: Update cache immediately
        setCachedData(cacheConfig, updatedTransactions);
        return updatedTransactions;
      });
      
      console.log('🔍 Debug - Transaction added successfully:', newTransaction.id);
      return newTransaction;
    } catch (error) {
      console.error('🔍 Debug - Error adding transaction:', error);
      return null;
    }
  }, [projectId, deductBalance, addBalance, user]);

  // Batch add transactions with balance integration (much faster than individual adds)
  const addTransactionsBatch = useCallback(async (
    transactionsToAdd: Array<Omit<Transaction, 'id'>>,
    skipBalanceDeduction: boolean = false
  ): Promise<Transaction[]> => {
    if (transactionsToAdd.length === 0) {
      return [];
    }

    try {
      // Calculate total cost for balance deduction
      const totalCost = transactionsToAdd.reduce((sum, t) => {
        return sum + (t.first || 0) + (t.second || 0);
      }, 0);

      // Deduct balance for positive amounts (only if not skipped)
      if (!skipBalanceDeduction && totalCost > 0) {
        const success = await deductBalance(totalCost);
        if (!success) {
          throw new Error('Failed to deduct balance');
        }
      }

      // Add balance for negative amounts (refunds/deductions)
      if (!skipBalanceDeduction && totalCost < 0) {
        const success = await addBalance(Math.abs(totalCost));
        if (!success) {
          throw new Error('Failed to add balance');
        }
      }

      let newTransactions: Transaction[] = [];

      // Try to save to Supabase first (only if user is authenticated)
      if (isSupabaseConfigured() && !isOfflineMode() && user?.id) {
        try {
          console.log(`🚀 Batch creating ${transactionsToAdd.length} transactions...`);
          newTransactions = await db.createTransactionsBatch(
            user.id,
            transactionsToAdd,
            isImpersonating ? originalAdminUser?.id : undefined
          );
          console.log(`✅ Batch create complete! ${newTransactions.length} transactions created`);
        } catch (dbError) {
          console.error('❌ Failed to batch save to Supabase, falling back to individual saves:', dbError);
          // Fallback to individual saves
          for (const transaction of transactionsToAdd) {
            try {
              const tx = await db.createTransaction(user.id, transaction, isImpersonating ? originalAdminUser?.id : undefined);
              newTransactions.push(tx);
            } catch (err) {
              console.error('Failed to save transaction:', err);
            }
          }
        }
      } else {
        // Offline mode - use localStorage
        newTransactions = transactionsToAdd.map(transaction => ({
          ...transaction,
          id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        // Queue batch for sync
        const offlineUserId = user?.id || 'offline-user';
        for (const tx of transactionsToAdd) {
          await enqueue('transactions', 'create', {
            userId: offlineUserId,
            transaction: tx,
            adminUserId: isImpersonating ? originalAdminUser?.id : undefined,
          });
        }
      }

      // Update state using functional update
      setTransactions(prevTransactions => {
        const updatedTransactions = [...prevTransactions, ...newTransactions];
        // Always save to localStorage as backup/cache
        localStorage.setItem(storageKey, JSON.stringify(updatedTransactions));
        // INSTANT: Update cache immediately
        setCachedData(cacheConfig, updatedTransactions);
        return updatedTransactions;
      });

      console.log(`✅ Batch add complete! ${newTransactions.length} transactions added`);
      return newTransactions;
    } catch (error) {
      console.error('Error batch adding transactions:', error);
      throw error instanceof Error ? error : new Error('Failed to batch add transactions');
    }
  }, [projectId, deductBalance, addBalance, user, isImpersonating, originalAdminUser?.id]);

  // Update transaction with balance handling
  const updateTransaction = useCallback(async (transactionId: string, updates: Partial<Transaction>) => {
    try {
      const originalTransaction = transactions.find(t => t.id === transactionId);
      if (!originalTransaction) {
        console.error('Transaction not found for ID:', transactionId);
        return false;
      }

      // Calculate balance difference
      const originalTotal = (originalTransaction.first || 0) + (originalTransaction.second || 0);
      const newTotal = ((updates.first !== undefined ? updates.first : originalTransaction.first) || 0) + 
                      ((updates.second !== undefined ? updates.second : originalTransaction.second) || 0);
      const balanceDifference = newTotal - originalTotal;

      // Handle balance adjustments
      // IMPORTANT: Don't update total_spent here - let database trigger/reconciliation handle it to avoid doubling
      if (balanceDifference !== 0) {
        if (balanceDifference > 0) {
          // Need to deduct more balance
          const success = await deductBalance(balanceDifference, false); // adjustSpent=false to prevent doubling
          if (!success) {
            throw new Error('Failed to deduct balance for transaction update');
          }
        } else {
          // Refund balance
          const success = await addBalance(Math.abs(balanceDifference), false); // adjustSpent=false to prevent doubling
          if (!success) {
            throw new Error('Failed to refund balance for transaction update');
          }
        }
      }

      // Try to update in Supabase first
      if (isSupabaseConfigured() && !isOfflineMode()) {
        try {
          // Prepare updates for Supabase (exclude id, projectId, createdAt, updatedAt)
          const { id, projectId: _, createdAt, updatedAt, ...supabaseUpdates } = updates;
          await db.updateTransaction(transactionId, supabaseUpdates, isImpersonating ? originalAdminUser?.id : undefined);
          console.log('Transaction updated in Supabase:', transactionId);
        } catch (dbError) {
          console.warn('Failed to update in Supabase:', dbError);
        }
      }

      // INSTANT: Update state and cache immediately
      setTransactions(prevTransactions => {
        const updated = prevTransactions.map(t =>
          t.id === transactionId
            ? { ...t, ...updates, updatedAt: new Date().toISOString() }
            : t
        );
        localStorage.setItem(storageKey, JSON.stringify(updated));
        // INSTANT: Update cache immediately
        setCachedData(cacheConfig, updated);
        return updated;
      });

      // Queue update for sync when offline
      if (isOfflineMode() || !isSupabaseConfigured()) {
        await enqueue('transactions', 'update', {
          transactionId,
          updates,
          adminUserId: isImpersonating ? originalAdminUser?.id : undefined,
        });
      }
      return true;
    } catch (error) {
      console.error('Error updating transaction:', error);
      return false;
    }
  }, [transactions, projectId, deductBalance, addBalance]);

  return {
    transactions,
    loading,
    error,
    refresh,
    getStatistics,
    getByEntryType,
    getByNumber,
    getTransaction,
    addTransaction,
    addTransactionsBatch,
    deleteTransaction,
    bulkDeleteTransactions,
    updateTransaction,
  };
};

