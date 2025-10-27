import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Global real-time subscriptions for instant updates across the app
 * Subscribes to all database changes and triggers callbacks
 */

interface RealtimeCallbacks {
  onTransactionChange?: () => void;
  onUserChange?: () => void;
  onBalanceChange?: () => void;
  onAdminDeductionChange?: () => void;
}

export const useRealtimeSubscriptions = (callbacks: RealtimeCallbacks) => {
  useEffect(() => {
    if (!supabase) return;

    const subscriptions: any[] = [];

    // Subscribe to transactions table
    if (callbacks.onTransactionChange) {
      const transactionSub = supabase
        .channel('global-transactions')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions' },
          () => {
            callbacks.onTransactionChange?.();
          }
        )
        .subscribe();
      
      subscriptions.push(transactionSub);
    }

    // Subscribe to app_users table
    if (callbacks.onUserChange) {
      const userSub = supabase
        .channel('global-users')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_users' },
          () => {
            callbacks.onUserChange?.();
          }
        )
        .subscribe();
      
      subscriptions.push(userSub);
    }

    // Subscribe to balance_history table
    if (callbacks.onBalanceChange) {
      const balanceSub = supabase
        .channel('global-balance')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'balance_history' },
          () => {
            callbacks.onBalanceChange?.();
          }
        )
        .subscribe();
      
      subscriptions.push(balanceSub);
    }

    // Subscribe to admin_deductions table
    if (callbacks.onAdminDeductionChange) {
      const deductionSub = supabase
        .channel('global-deductions')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'admin_deductions' },
          () => {
            callbacks.onAdminDeductionChange?.();
          }
        )
        .subscribe();
      
      subscriptions.push(deductionSub);
    }

    // Cleanup subscriptions
    return () => {
      subscriptions.forEach(sub => {
        sub.unsubscribe();
      });
    };
  }, [callbacks.onTransactionChange, callbacks.onUserChange, callbacks.onBalanceChange, callbacks.onAdminDeductionChange]);
};

/**
 * Hook for user-specific real-time updates
 */
export const useUserRealtimeSubscriptions = (userId: string | undefined, onUpdate: () => void) => {
  useEffect(() => {
    if (!supabase || !userId) return;

    // Subscribe to user's transactions
    const subscription = supabase
      .channel(`user-${userId}-data`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        () => {
          onUpdate();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'balance_history',
          filter: `user_id=eq.${userId}`
        },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId, onUpdate]);
};

/**
 * Hook for admin real-time updates
 */
export const useAdminRealtimeSubscriptions = (onUpdate: () => void) => {
  useEffect(() => {
    if (!supabase) return;

    const subscription = supabase
      .channel('admin-all-data')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          onUpdate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_users' },
        () => {
          onUpdate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_deductions' },
        () => {
          onUpdate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'balance_history' },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [onUpdate]);
};

