import { useState, useEffect, useCallback } from 'react';
import type { Transaction, ProjectStatistics } from '../types';
import { useUserBalance } from './useUserBalance';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/database';
import { isSupabaseConfigured, isOfflineMode } from '../lib/supabase';

// In projectless mode, pass 'user-scope' for current user
export const useTransactions = (projectId: string) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isImpersonating, originalAdminUser } = useAuth();
  const { deductBalance, addBalance } = useUserBalance();
  const isUserScope = projectId === 'user-scope';
  const storageKey = isUserScope ? 'gull-transactions-user' : `gull-transactions-${projectId}`;

  const removeTransactionsById = useCallback((idsToRemove: string[]) => {
    if (!idsToRemove?.length) {
      return;
    }
    const idSet = new Set(idsToRemove);
    setTransactions(prevTransactions => {
      const updated = prevTransactions.filter(t => !idSet.has(t.id));
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }, [storageKey]);

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

  // Load transactions from database or localStorage as fallback
  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Prefer database whenever we're online; reading does not require auth uid
      if (isSupabaseConfigured() && !isOfflineMode()) {
        // Online mode: ALWAYS fetch from database first
        console.log('🌐 Loading transactions from database for project:', projectId);
        
        let dbTransactions: Transaction[] = [];
        try {
          // Pass user ID to filter transactions for this specific user only
          const userId = user?.id;
          dbTransactions = await db.getTransactions(projectId, userId);
          console.log('✅ Transactions loaded from database:', dbTransactions.length, userId ? `(filtered by user: ${userId})` : '(all users)');
          
          // Log if there's a discrepancy with cached data
          const cachedData = localStorage.getItem(storageKey);
          if (cachedData) {
            const cachedTransactions = JSON.parse(cachedData);
            if (cachedTransactions.length !== dbTransactions.length) {
              console.log(`🔄 Cache update: Cached had ${cachedTransactions.length} entries, database has ${dbTransactions.length} entries - updating cache`);
            }
          }
        } catch (dbError) {
          console.error('❌ Database fetch failed:', dbError);
          throw dbError;
        }

        // Merge with existing state to prevent losing transactions that were just added
        // This prevents race conditions where database hasn't committed yet
        setTransactions(prevTransactions => {
          // Create a map of existing transactions by ID for fast lookup
          const existingMap = new Map(prevTransactions.map(t => [t.id, t]));
          
          // Add all database transactions to the map
          dbTransactions.forEach(t => {
            existingMap.set(t.id, t);
          });
          
          // Convert back to array and sort by creation date (newest first)
          const mergedTransactions = Array.from(existingMap.values()).sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA; // Newest first
          });
          
          // Log if merge resulted in more transactions
          if (mergedTransactions.length > dbTransactions.length) {
            console.log(`🔄 Merge: Had ${prevTransactions.length} in state, ${dbTransactions.length} from DB, ${mergedTransactions.length} after merge`);
          }
          
          // Update localStorage cache
          localStorage.setItem(storageKey, JSON.stringify(mergedTransactions));
          return mergedTransactions;
        });
        
      } else if (isOfflineMode()) {
        // Offline mode: use localStorage
        console.log('📱 Loading transactions from localStorage (offline mode)');
        const data = localStorage.getItem(storageKey);
        const parsed = data ? JSON.parse(data) : [];
        setTransactions(parsed);
        console.log('Transactions loaded from localStorage:', parsed.length);
        
      } else {
        // No Supabase configured: fallback to localStorage
        console.log('⚠️ No Supabase configured, using localStorage');
        const data = localStorage.getItem(storageKey);
        const parsed = data ? JSON.parse(data) : [];
        setTransactions(parsed);
        console.log('Transactions loaded from localStorage:', parsed.length);
      }
    } catch (error) {
      console.error('❌ Error loading transactions:', error);
      
      // Only fallback to localStorage if database is completely unavailable
      console.log('🔄 Falling back to localStorage...');
      try {
        const data = localStorage.getItem(storageKey);
        const parsed = data ? JSON.parse(data) : [];
        setTransactions(parsed);
        
        let errorMessage = 'Failed to load transactions from database.';
        if (isOfflineMode()) {
          errorMessage = 'Database is in offline mode. Using local storage.';
        } else if (!isSupabaseConfigured()) {
          errorMessage = 'Database is not configured. Using local storage.';
        } else if (error instanceof Error) {
          errorMessage = `Database error: ${error.message}. Using local storage.`;
        }
        setError(errorMessage);
      } catch (localError) {
        console.error('❌ Error loading from localStorage:', localError);
        setTransactions([]);
        setError('Failed to load transactions from both database and local storage.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.id]);

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
      }

      // Update state using functional update to avoid stale closure issues
      setTransactions(prevTransactions => {
        const updatedTransactions = [...prevTransactions, newTransaction];
        // Always save to localStorage as backup/cache
        localStorage.setItem(storageKey, JSON.stringify(updatedTransactions));
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
      }

      // Update state using functional update
      setTransactions(prevTransactions => {
        const updatedTransactions = [...prevTransactions, ...newTransactions];
        // Always save to localStorage as backup/cache
        localStorage.setItem(storageKey, JSON.stringify(updatedTransactions));
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

      // Update the transaction in local state
      const updated = transactions.map(t =>
        t.id === transactionId
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t
      );
      localStorage.setItem(storageKey, JSON.stringify(updated));
      
      // Update state using functional update
      setTransactions(prevTransactions => prevTransactions.map(t =>
        t.id === transactionId
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t
      ));
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

