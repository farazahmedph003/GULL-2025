import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isOfflineMode } from '../lib/supabase';
import { db } from '../services/database';
import { playMoneyDeductSound, playMoneyDepositSound } from '../utils/audioFeedback';

export interface UserBalance {
  balance: number;
  loading: boolean;
  error: string | null;
}

export const useUserBalance = () => {
  const { user } = useAuth();
  // Use a stable offline user id when no authenticated user is present
  const effectiveUserId = (() => {
    if (user?.id) return user.id as string;
    let id = localStorage.getItem('gull_offline_user_id');
    if (!id) {
      id = 'offline-user';
      localStorage.setItem('gull_offline_user_id', id);
    }
    return id;
  })();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user balance
  const fetchBalance = useCallback(async () => {
    console.log('fetchBalance called for userId:', effectiveUserId);
    
    // Always allow fetching in offline mode using effectiveUserId

    setLoading(true);
    setError(null);

    if (isOfflineMode() || !supabase || !user) {
      // Offline mode: use local storage
      const localBalances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
      let newBalance = localBalances[effectiveUserId];
      
      // If user has no balance or balance is 0, initialize with default
      if (newBalance === undefined || newBalance === null || newBalance === 0) {
        newBalance = 1000; // Default to 1000 for offline
        localBalances[effectiveUserId] = newBalance;
        localStorage.setItem('gull_user_balances', JSON.stringify(localBalances));
        console.log('Initialized balance for offline user:', newBalance);
      } else {
        console.log('Offline balance fetched:', newBalance);
      }
      
      setBalance(newBalance);
      // Don't dispatch event here to avoid infinite loop
      setLoading(false);
    } else {
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('balance')
          .eq('user_id', user.id)
          .single();

        if (fetchError) throw fetchError;

        const newBalance = data?.balance || 1000; // Default to 1000 for new users
        setBalance(newBalance);
        // Don't dispatch event here to avoid infinite loop
      } catch (err) {
        console.error('Error fetching balance:', err);
        setError('Failed to fetch balance');
        // Fallback to local storage
        const localBalances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
        let newBalance = localBalances[effectiveUserId];
        
        // If user has no balance or balance is 0, initialize with default
        if (newBalance === undefined || newBalance === null || newBalance === 0) {
          newBalance = 1000;
          localBalances[effectiveUserId] = newBalance;
          localStorage.setItem('gull_user_balances', JSON.stringify(localBalances));
          console.log('Initialized balance for online user (fallback):', newBalance);
        }
        
        setBalance(newBalance);
        // Don't dispatch event here to avoid infinite loop
      } finally {
        setLoading(false);
      }
    }
  }, [user, effectiveUserId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Check if user has sufficient balance
  const hasSufficientBalance = useCallback(
    (amount: number): boolean => {
      return balance >= amount;
    },
    [balance]
  );

  // Deduct balance
  const deductBalance = useCallback(
    async (amount: number): Promise<boolean> => {
      // In offline mode we still allow deductions using effectiveUserId

      if (!hasSufficientBalance(amount)) {
        setError('Insufficient balance');
        return false;
      }

      if (isOfflineMode() || !supabase || !user) {
        // Offline mode: update local storage
        const localBalances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
        localBalances[effectiveUserId] = (localBalances[effectiveUserId] || 0) - amount;
        localStorage.setItem('gull_user_balances', JSON.stringify(localBalances));
        const newBalance = localBalances[effectiveUserId];
        setBalance(newBalance);
        window.dispatchEvent(new CustomEvent('user-balance-updated', { detail: { balance: newBalance } }));
        
        // Play deduction sound
        playMoneyDeductSound(amount);
        return true;
      } else {
        try {
          const newBalance = balance - amount;
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('user_id', user.id);

          if (updateError) throw updateError;

          setBalance(newBalance);
          window.dispatchEvent(new CustomEvent('user-balance-updated', { detail: { balance: newBalance } }));
          
          // Play deduction sound
          playMoneyDeductSound(amount);
          return true;
        } catch (err) {
          console.error('Error deducting balance:', err);
          setError('Failed to deduct balance');
          return false;
        }
      }
    },
    [user, balance, hasSufficientBalance, effectiveUserId]
  );

  // Add balance (for admin top-ups)
  const addBalance = useCallback(
    async (amount: number): Promise<boolean> => {
      // In offline mode we still allow top-ups using effectiveUserId

      if (isOfflineMode() || !supabase || !user) {
        // Offline mode: update local storage
        const localBalances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
        localBalances[effectiveUserId] = (localBalances[effectiveUserId] || 0) + amount;
        localStorage.setItem('gull_user_balances', JSON.stringify(localBalances));
        const newBalance = localBalances[effectiveUserId];
        setBalance(newBalance);
        window.dispatchEvent(new CustomEvent('user-balance-updated', { detail: { balance: newBalance } }));
        
        // Play deposit sound
        playMoneyDepositSound(amount);
        return true;
      } else {
        try {
          const newBalance = balance + amount;
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('user_id', user.id);

          if (updateError) throw updateError;

          setBalance(newBalance);
          window.dispatchEvent(new CustomEvent('user-balance-updated', { detail: { balance: newBalance } }));
          
          // Play deposit sound
          playMoneyDepositSound(amount);
          return true;
        } catch (err) {
          console.error('Error adding balance:', err);
          setError('Failed to add balance');
          return false;
        }
      }
    },
    [user, balance, effectiveUserId]
  );

  // Listen for global balance updates
  useEffect(() => {
    const handler = (event: any) => {
      // Check if this balance update is for the current user
      const eventUserId = event.detail?.userId;
      
      // If no userId in event or it matches current user, refresh
      if (!eventUserId || eventUserId === effectiveUserId) {
        fetchBalance();
      }
    };
    
    window.addEventListener('user-balance-updated', handler as any);
    return () => window.removeEventListener('user-balance-updated', handler as any);
  }, [fetchBalance, effectiveUserId]);

  // Subscribe to realtime balance changes
  useEffect(() => {
    if (!user || isOfflineMode()) {
      return;
    }

    const unsubscribe = db.subscribeToUserBalance(user.id, (payload) => {
      console.log('Realtime balance update received:', payload);
      
      // Extract new balance from the payload
      const event = payload as any;
      if (event?.new?.balance !== undefined) {
        setBalance(event.new.balance);
      } else {
        // Fallback: refresh balance from database
        fetchBalance();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, fetchBalance]);

  return {
    balance,
    loading,
    error,
    hasSufficientBalance,
    deductBalance,
    addBalance,
    refresh: fetchBalance,
  };
};





