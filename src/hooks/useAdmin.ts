import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isAdminEmail } from '../config/admin';
import type { UserAccount, UserReport, AdminStats, BalanceTransaction } from '../types/admin';
import { supabase, supabaseAdmin, isOfflineMode } from '../lib/supabase';
import { playMoneyDepositSound } from '../utils/audioFeedback';

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setIsAdmin(isAdminEmail(user.email));
    } else {
      setIsAdmin(false);
    }
    setLoading(false);
  }, [user]);

  return { isAdmin, loading };
};

// Mock data for now - will be replaced with real API calls
export const useAdminData = () => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdminData = useCallback(async () => {
    setLoading(true);

    try {
      if (!isOfflineMode() && supabase) {
        console.log('Loading admin data from Supabase...');
        
        // First, let's check the current user's auth status and admin role
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        console.log('Current authenticated user:', currentUser?.id, currentUser?.email);
        
        // Try to read from profiles; fallback to auth.users via admin RPC in future
        let { data: profiles, error } = await supabase
          .from('profiles')
          .select('user_id, email, display_name, role, balance, is_online, last_login_at, created_at, updated_at')
          .order('created_at', { ascending: false });

        console.log('Profiles query result:', { profiles, error });
        
        // Check if current user has a profile
        let currentUserProfile = profiles?.find(p => p.user_id === currentUser?.id);
        console.log('Current user profile:', currentUserProfile);
        console.log('Is current user admin?', currentUserProfile?.role === 'admin');
        
        // If no profile exists for current user, create one
        if (currentUser && !currentUserProfile) {
          console.log('No profile found for current user, creating one...');
          try {
            const { error: createError } = await supabase
              .from('profiles')
              .insert({
                user_id: currentUser.id,
                email: currentUser.email,
                display_name: currentUser.email?.split('@')[0] || 'User',
                role: isAdminEmail(currentUser.email) ? 'admin' : 'user'
              });
            
            if (createError) {
              console.warn('Failed to create profile:', createError);
            } else {
              console.log('Profile created successfully');
              // Re-fetch profiles after creating
              const { data: updatedProfiles } = await supabase
                .from('profiles')
                .select('user_id, email, display_name, role, balance, is_online, last_login_at, created_at, updated_at')
                .order('created_at', { ascending: false });
              profiles = updatedProfiles;
              currentUserProfile = profiles?.find(p => p.user_id === currentUser?.id);
            }
          } catch (err) {
            console.warn('Failed to create profile:', err);
          }
        }
        
        // If current user doesn't have admin role but should be admin, try to update it
        if (currentUser && currentUser.email && currentUserProfile && currentUserProfile.role !== 'admin') {
          // Check if this is an admin email
          const adminEmails = ['gmpfaraz@gmail.com']; // Add more admin emails as needed
          if (adminEmails.includes(currentUser.email)) {
            console.log('Updating user profile to admin role for:', currentUser.email);
            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ role: 'admin' })
                .eq('user_id', currentUser.id);
              
              if (updateError) {
                console.warn('Failed to update admin role:', updateError);
              } else {
                console.log('Admin role updated successfully');
                // Update the local profile data to reflect the change
                currentUserProfile.role = 'admin';
                // Re-fetch profiles to ensure the change is reflected
                const { data: updatedProfiles } = await supabase
                  .from('profiles')
                  .select('user_id, email, display_name, role, balance, is_online, last_login_at, created_at, updated_at')
                  .order('created_at', { ascending: false });
                profiles = updatedProfiles;
                currentUserProfile = profiles?.find(p => p.user_id === currentUser?.id);
              }
            } catch (error) {
              console.warn('Failed to update admin role:', error);
            }
          }
        }
        
        // Verify admin role is properly set
        console.log('🔍 Final admin role verification:', {
          currentUserEmail: currentUser?.email,
          currentUserProfile: currentUserProfile,
          isAdminRole: currentUserProfile?.role === 'admin',
          adminEmails: ['gmpfaraz@gmail.com']
        });

        // Fetch all projects to get counts per user
        let projects: any[] = [];
        let projectsError: any = null;
        
        try {
        // First, let's test if we can call the admin function directly
        const { data: adminCheck, error: adminCheckError } = await supabase
          .rpc('current_user_is_admin');
        
        console.log('Admin check result:', { adminCheck, adminCheckError });
        
        // Also check the current user's auth status
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        console.log('Auth user check:', { authUser: authUser?.id, authError });
        
        // Test a simple query to see if RLS is working at all
        const { data: testProjects, error: testError } = await supabase
          .from('projects')
          .select('count')
          .limit(1);
        console.log('Test projects query:', { testProjects, testError });

          // Try admin query first using service role client (bypasses RLS)
          let projectsData: any[] = [];
          let projectsQueryError: any = null;
          
          if (supabaseAdmin) {
            console.log('🔧 Using service role client for admin query (bypasses RLS)');
            try {
              const { data, error } = await supabaseAdmin
                .from('projects')
                .select('id, user_id, name, created_at');
              
              projectsData = data || [];
              projectsQueryError = error;
              console.log('🔧 Service role admin query result:', { 
                projectsCount: projectsData?.length || 0,
                projects: projectsData, 
                error: projectsQueryError
              });
            } catch (error) {
              console.warn('Service role admin query failed:', error);
              projectsQueryError = error;
            }
          } else {
            console.log('⚠️ Service role client not available, falling back to regular client');
            // Fallback to regular client
            const { data, error } = await supabase
              .from('projects')
              .select('id, user_id, name, created_at');

            projectsData = data || [];
            projectsQueryError = error;
          }

          projects = projectsData;
          projectsError = projectsQueryError;
          
          console.log('Admin data - Projects fetched:', { 
            projectsCount: projects?.length || 0,
            projects, 
            projectsError,
            adminCheckResult: adminCheck
          });

          // Try per-user fallback if admin query fails or returns no results
          // This handles cases where admin RLS policies don't work properly
          if (projectsError || (projects && projects.length === 0)) {
            console.log('Fetching projects per user as fallback...');
            const allProjects: any[] = [];
            
            for (const profile of profiles || []) {
              try {
                console.log(`Checking projects for user: ${profile.display_name} (${profile.user_id})`);
                const { data: userProjects, error: userProjError } = await supabase
                  .from('projects')
                  .select('id, user_id, name, created_at')
                  .eq('user_id', profile.user_id);
                
                console.log(`Projects query result for ${profile.display_name}:`, { userProjects, userProjError });
                
                if (!userProjError && userProjects && userProjects.length > 0) {
                  allProjects.push(...userProjects);
                  console.log(`✅ Found ${userProjects.length} projects for user ${profile.display_name}:`, userProjects);
                } else if (userProjError) {
                  console.warn(`❌ Error fetching projects for ${profile.display_name}:`, userProjError);
                } else {
                  console.log(`ℹ️ No projects found for user ${profile.display_name} (${profile.user_id})`);
                }
              } catch (err) {
                console.warn(`❌ Failed to fetch projects for user ${profile.user_id}:`, err);
              }
            }
            
            projects = allProjects;
            console.log('🎯 Final fallback result - total projects found:', projects.length);
            if (projects.length > 0) {
              console.log('📋 All fetched projects:', projects);
            }
          } else {
            console.log('✅ Admin query successful, projects:', projects);
          }
        } catch (error) {
          console.warn('Failed to fetch projects (caught error):', error);
          projectsError = error;
          projects = [];
        }

        // Fetch all transactions to get entry counts and totals using service role
        let transactions: any[] = [];
        let transactionsError: any = null;
        
        try {
          if (supabaseAdmin) {
            console.log('🔧 Using service role client for transactions query');
            const { data: transactionsData, error: transactionsQueryError } = await supabaseAdmin
              .from('transactions')
              .select('id, project_id, first_amount, second_amount');
            
            transactions = transactionsData || [];
            transactionsError = transactionsQueryError;
          } else {
            console.log('⚠️ Service role client not available for transactions, using regular client');
            const { data: transactionsData, error: transactionsQueryError } = await supabase
              .from('transactions')
              .select('id, project_id, first_amount, second_amount');
            
            transactions = transactionsData || [];
            transactionsError = transactionsQueryError;
          }
          
          console.log('Admin data - Transactions fetched:', { 
            transactionsCount: transactions?.length || 0,
            transactionsError 
          });
        } catch (error) {
          console.warn('Failed to fetch transactions (caught error):', error);
          transactionsError = error;
          transactions = [];
        }

        if (transactionsError) {
          console.warn('Failed to fetch transactions:', transactionsError);
        }

        // Build project count map
        const projectCountMap: { [userId: string]: number } = {};
        const projectIdToUserIdMap: { [projectId: string]: string } = {};
        
        console.log('🔍 Building project count map from projects:', projects);
        console.log('🔍 Raw projects array:', JSON.stringify(projects, null, 2));
        (projects || []).forEach((p, index) => {
          console.log(`Project ${index + 1}:`, {
            id: p.id,
            user_id: p.user_id,
            name: p.name,
            created_at: p.created_at
          });
          projectCountMap[p.user_id] = (projectCountMap[p.user_id] || 0) + 1;
          projectIdToUserIdMap[p.id] = p.user_id;
        });

        console.log('Admin data - Project count map after processing:', projectCountMap);
        console.log('Admin data - Available user IDs from profiles:', (profiles || []).map(p => ({ user_id: p.user_id, email: p.email, display_name: p.display_name })));
        console.log('Admin data - Project ID to User ID mapping:', projectIdToUserIdMap);
        
        // Additional debugging: Check if project user IDs match profile user IDs
        const profileUserIds = (profiles || []).map(p => p.user_id);
        const projectUserIds = Object.keys(projectCountMap);
        console.log('🔍 Profile User IDs:', profileUserIds);
        console.log('🔍 Project User IDs:', projectUserIds);
        console.log('🔍 Matching user IDs:', profileUserIds.filter(id => projectUserIds.includes(id)));
        
        // Final verification - check if any users have projects based on the count map
        Object.keys(projectCountMap).forEach(userId => {
          const count = projectCountMap[userId];
          const profile = profiles?.find(p => p.user_id === userId);
          console.log(`🔢 User ${profile?.display_name || userId} has ${count} projects`);
        });

        // Build transaction stats map
        const userStatsMap: { [userId: string]: { entries: number; firstTotal: number; secondTotal: number } } = {};
        (transactions || []).forEach((t) => {
          const userId = projectIdToUserIdMap[t.project_id];
          if (userId) {
            if (!userStatsMap[userId]) {
              userStatsMap[userId] = { entries: 0, firstTotal: 0, secondTotal: 0 };
            }
            userStatsMap[userId].entries++;
            userStatsMap[userId].firstTotal += t.first_amount || 0;
            userStatsMap[userId].secondTotal += t.second_amount || 0;
          }
        });

        const mapped: UserAccount[] = (profiles || []).map((p) => ({
          id: p.user_id,
          userId: p.user_id,
          email: p.email || '',
          displayName: p.display_name || p.email || 'User',
          role: (p.role as 'admin' | 'user') || 'user',
          balance: p.balance || 0,
          isActive: true,
          isOnline: p.is_online || false,
          lastSeen: p.last_login_at || p.updated_at,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          permissions: [],
        }));

        console.log('Mapped users for admin:', mapped);
        setUsers(mapped);
        const reportData = mapped.map((u) => {
          const stats = userStatsMap[u.userId] || { entries: 0, firstTotal: 0, secondTotal: 0 };
          const projectCount = projectCountMap[u.userId] || 0;
          
          console.log(`User ${u.displayName} (${u.userId}): projectCount = ${projectCount}`, {
            userId: u.userId,
            projectCount,
            projectCountMapEntry: projectCountMap[u.userId],
            availableUserIds: Object.keys(projectCountMap)
          });
          
          return {
            userId: u.userId,
            email: u.email,
            displayName: u.displayName,
            projectCount,
            totalEntries: stats.entries,
            firstTotal: stats.firstTotal,
            secondTotal: stats.secondTotal,
            grandTotal: stats.firstTotal + stats.secondTotal,
            balance: u.balance,
            isOnline: u.isOnline,
            lastSeen: u.lastSeen,
            createdAt: u.createdAt,
          };
        });

        console.log('Final reports data:', reportData.map(r => ({ userId: r.userId, projectCount: r.projectCount })));
        setReports(reportData);

        const totalProjects = (projects || []).length;
        const totalEntries = (transactions || []).length;

        setStats({
          totalUsers: mapped.length,
          activeUsers: mapped.filter((u) => u.isActive).length,
          onlineUsers: mapped.filter((u) => u.isOnline).length,
          totalProjects,
          totalEntries,
          totalBalance: mapped.reduce((s, u) => s + u.balance, 0),
          totalRevenue: 0,
        });
      } else {
        // Offline fallback: read from localStorage mock
        const allUsers: UserAccount[] = [];
        setUsers(allUsers);
        setReports([]);
        setStats({
          totalUsers: 0,
          activeUsers: 0,
          onlineUsers: 0,
          totalProjects: 0,
          totalEntries: 0,
          totalBalance: 0,
          totalRevenue: 0,
        });
      }
    } catch (e) {
      console.warn('Failed to load admin data:', e);
      setUsers([]);
      setReports([]);
      setStats({
        totalUsers: 0,
        activeUsers: 0,
        onlineUsers: 0,
        totalProjects: 0,
        totalEntries: 0,
        totalBalance: 0,
        totalRevenue: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Load admin data on mount
  useEffect(() => {
    // Load data from Supabase if available; fallback to local
    loadAdminData();
  }, [loadAdminData]);

  // Set up real-time subscription for projects table to update admin data automatically
  useEffect(() => {
    if (!isOfflineMode() && supabase) {
      console.log('Setting up real-time subscription for projects...');
      
      const subscription = supabase
        .channel('admin-projects-updates')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'projects',
          },
          (payload) => {
            console.log('🔥 REAL-TIME UPDATE: Project change detected:', {
              event: payload.eventType,
              new: payload.new,
              old: payload.old,
              table: payload.table,
              schema: payload.schema
            });
            console.log('Refreshing admin data due to project change...');
            // Refresh admin data when projects change
            setTimeout(() => {
              loadAdminData();
            }, 500); // Small delay to ensure database consistency
          }
        )
        .subscribe((status) => {
          console.log('Real-time subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Real-time subscription active for projects table');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Real-time subscription error for projects table');
          }
        });

      // Cleanup subscription on unmount
      return () => {
        console.log('Cleaning up admin projects real-time subscription');
        subscription.unsubscribe();
      };
    } else {
      console.log('Real-time subscription not setup - offline mode or supabase not available');
    }
  }, [loadAdminData]);

  const topUpBalance = async (userId: string, amount: number): Promise<boolean> => {
    try {
      if (!isOfflineMode() && supabase) {
        // Get current balance from Supabase
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('balance')
          .eq('user_id', userId)
          .single();

        if (fetchError) throw fetchError;

        const currentBalance = profile?.balance || 0;
        const newBalance = currentBalance + amount;

        // Update balance in Supabase
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ balance: newBalance })
          .eq('user_id', userId);

        if (updateError) throw updateError;
      } else {
        // Fallback to localStorage
        const balances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
        const currentBalance = balances[userId] || 0;
        balances[userId] = currentBalance + amount;
        localStorage.setItem('gull_user_balances', JSON.stringify(balances));
      }

      // Log transaction to localStorage (can be moved to Supabase later)
      const transactions: BalanceTransaction[] = JSON.parse(
        localStorage.getItem('gull_balance_transactions') || '[]'
      );
      transactions.push({
        id: Date.now().toString(),
        userId,
        type: 'topup',
        amount,
        balance: 0, // Will be recalculated
        description: `Admin top-up of ${amount} PKR`,
        performedBy: 'admin',
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('gull_balance_transactions', JSON.stringify(transactions));

      // Play deposit sound for successful admin top-up
      playMoneyDepositSound(amount);

      await loadAdminData();
      return true;
    } catch (error) {
      console.error('Failed to top up balance:', error);
      return false;
    }
  };

  const deductBalance = (userId: string, amount: number, description: string): boolean => {
    try {
      const balances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
      const currentBalance = balances[userId] || 0;
      
      if (currentBalance < amount) {
        return false; // Insufficient balance
      }

      balances[userId] = currentBalance - amount;
      localStorage.setItem('gull_user_balances', JSON.stringify(balances));

      // Log transaction
      const transactions: BalanceTransaction[] = JSON.parse(
        localStorage.getItem('gull_balance_transactions') || '[]'
      );
      transactions.push({
        id: Date.now().toString(),
        userId,
        type: 'deduction',
        amount,
        balance: balances[userId],
        description,
        performedBy: userId,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('gull_balance_transactions', JSON.stringify(transactions));

      return true;
    } catch (error) {
      console.error('Failed to deduct balance:', error);
      return false;
    }
  };

  const getUserBalance = (userId: string): number => {
    const balances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
    return balances[userId] || 0;
  };

  const deleteUser = (userId: string): boolean => {
    try {
      // This would delete from database in real implementation
      console.log('Deleting user:', userId);
      loadAdminData();
      return true;
    } catch (error) {
      console.error('Failed to delete user:', error);
      return false;
    }
  };

  const toggleUserStatus = (userId: string): boolean => {
    try {
      // This would update database in real implementation
      console.log('Toggling user status:', userId);
      loadAdminData();
      return true;
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      return false;
    }
  };

  return {
    users,
    reports,
    stats,
    loading,
    topUpBalance,
    deductBalance,
    getUserBalance,
    deleteUser,
    toggleUserStatus,
    refresh: loadAdminData,
  };
};

