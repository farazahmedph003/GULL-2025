import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isOfflineMode } from '../lib/supabase';
import { db } from '../services/database';
import { playMoneyDeductSound, playMoneyDepositSound } from '../utils/audioFeedback';

export interface UserBalance {
  balance: number;
  loading: boolean;
  error: string | null;
  spent?: number;
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
  const [spent, setSpent] = useState<number>(0);

  // Fetch user balance
  const fetchBalance = useCallback(async () => {
    console.log('fetchBalance called for userId:', effectiveUserId);
    
    setLoading(true);
    setError(null);

    if (isOfflineMode() || !supabase || !user) {
      // Offline mode: use local storage
      const localBalances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
      let newBalance = localBalances[effectiveUserId];
      
      // If user has no balance, initialize with 0 (admin must top up)
      if (newBalance === undefined || newBalance === null) {
        newBalance = 0; // Default to 0 - admin must top up
        localBalances[effectiveUserId] = newBalance;
        localStorage.setItem('gull_user_balances', JSON.stringify(localBalances));
        console.log('Initialized balance to 0 for offline user:', effectiveUserId);
      } else {
        console.log('Offline balance fetched:', newBalance);
      }
      
      setBalance(newBalance);
      // Load spent from local storage tracker
      const spentMap = JSON.parse(localStorage.getItem('gull_user_spent') || '{}');
      setSpent(spentMap[effectiveUserId] || 0);
      setLoading(false);
    } else {
      // Online mode: ALWAYS fetch from database first
      try {
        console.log('🌐 Fetching balance from database for user:', user.id);
        
        // Use service role client to bypass RLS
        const { data, error: fetchError } = await db.getUserBalance(user.id);

        if (fetchError) {
          console.error('❌ Database fetch failed:', fetchError);
          throw fetchError;
        }

        const newBalance = data?.balance || 0; // Default to 0 for new users - admin must top up
        console.log('✅ Balance fetched from database:', newBalance);
        
        setBalance(newBalance);
        
        // Update localStorage as cache (but don't rely on it)
        const localBalances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
        localBalances[effectiveUserId] = newBalance;
        localStorage.setItem('gull_user_balances', JSON.stringify(localBalances));
        
        // Load spent from local storage tracker (this is just for UI display)
        const spentMap = JSON.parse(localStorage.getItem('gull_user_spent') || '{}');
        setSpent(spentMap[effectiveUserId] || 0);
        
      } catch (err) {
        console.error('❌ Error fetching balance from database:', err);
        setError('Failed to fetch balance from database');
        
        // Only fallback to localStorage if database is completely unavailable
        console.log('🔄 Falling back to localStorage...');
        const localBalances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
        let newBalance = localBalances[effectiveUserId];
        
        if (newBalance === undefined || newBalance === null) {
          newBalance = 0; // Default fallback - admin must top up
          localBalances[effectiveUserId] = newBalance;
          localStorage.setItem('gull_user_balances', JSON.stringify(localBalances));
          console.log('Initialized fallback balance to 0:', effectiveUserId);
        }
        
        setBalance(newBalance);
        const spentMap = JSON.parse(localStorage.getItem('gull_user_spent') || '{}');
        setSpent(spentMap[effectiveUserId] || 0);
      } finally {
        setLoading(false);
      }
    }
  }, [user, effectiveUserId]);

  useEffect(() => {
    // Test service role access first
    const testAccess = async () => {
      if (!isOfflineMode() && supabase && user) {
        console.log('🧪 Testing service role access...');
        const result = await db.testServiceRoleAccess();
        if (!result.success) {
          console.error('❌ Service role access test failed:', result.error);
        }
      }
    };
    
    testAccess();
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
        // track spent
        const spentMap = JSON.parse(localStorage.getItem('gull_user_spent') || '{}');
        spentMap[effectiveUserId] = (spentMap[effectiveUserId] || 0) + amount;
        localStorage.setItem('gull_user_spent', JSON.stringify(spentMap));
        setSpent(spentMap[effectiveUserId]);
        window.dispatchEvent(new CustomEvent('user-balance-updated', { detail: { balance: newBalance } }));
        
        // Play deduction sound
        playMoneyDeductSound(amount);
        return true;
      } else {
        try {
          const newBalance = balance - amount;
          
          console.log('💰 Deducting balance:', {
            userId: user.id,
            currentBalance: balance,
            amount,
            newBalance
          });

          // Use service role client to bypass RLS (app_users don't have auth sessions)
          const { error: updateError } = await db.updateUserBalance(user.id, newBalance);

          if (updateError) {
            console.error('❌ Balance deduction failed:', updateError);
            throw updateError;
          }

          console.log('✅ Balance deducted successfully');

          setBalance(newBalance);
          // track spent locally
          const spentMap = JSON.parse(localStorage.getItem('gull_user_spent') || '{}');
          spentMap[effectiveUserId] = (spentMap[effectiveUserId] || 0) + amount;
          localStorage.setItem('gull_user_spent', JSON.stringify(spentMap));
          setSpent(spentMap[effectiveUserId]);
          window.dispatchEvent(new CustomEvent('user-balance-updated', { detail: { balance: newBalance } }));
          
          // Play deduction sound
          playMoneyDeductSound(amount);
          return true;
        } catch (err) {
          console.error('❌ Error deducting balance:', err);
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
          
          console.log('💰 Adding balance:', {
            userId: user.id,
            currentBalance: balance,
            amount,
            newBalance
          });

          // Use service role client to bypass RLS (app_users don't have auth sessions)
          const { error: updateError } = await db.updateUserBalance(user.id, newBalance);

          if (updateError) {
            console.error('❌ Balance addition failed:', updateError);
            throw updateError;
          }

          console.log('✅ Balance added successfully');

          setBalance(newBalance);
          window.dispatchEvent(new CustomEvent('user-balance-updated', { detail: { balance: newBalance } }));
          
          // Play deposit sound
          playMoneyDepositSound(amount);
          return true;
        } catch (err) {
          console.error('❌ Error adding balance:', err);
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
    spent,
    hasSufficientBalance,
    deductBalance,
    addBalance,
    refresh: fetchBalance,
  };
};





