import { supabase, supabaseAdmin, isSupabaseConfigured, isSupabaseConnected } from '../lib/supabase';
import { cacheUsers, getUsersWithStatsFromCache, getEntriesByTypeFromCache, clearTransactionsCache } from './localDb';
import type { Project, Transaction, FilterPreset, ActionHistory, EntryType } from '../types';

// Get service key from environment
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY || '';

// ============================================
// DATABASE SERVICE
// ============================================

export class DatabaseService {
  private static instance: DatabaseService;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Check if online mode is available
  isOnline(): boolean {
    return isSupabaseConnected();
  }

  // Prefer service role for admin reads when available
  private getReadClient() {
    return supabaseAdmin || supabase;
  }

  // Retry mechanism for network requests
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Database operation attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Check if it's a network-related error that might be retryable
          const isRetryable = this.isRetryableError(error);
          if (isRetryable) {
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            continue;
          }
        }
        break;
      }
    }
    
    throw lastError || new Error('Database operation failed after all retries');
  }

  // Check if an error is retryable
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code || error.name || '';
    
    // Network-related errors that might be temporary
    const retryablePatterns = [
      'network',
      'timeout',
      'connection',
      'fetch',
      'load failed',
      'socket',
      'enotfound',
      'econnreset',
      'etimedout'
    ];
    
    return retryablePatterns.some(pattern => 
      errorMessage.includes(pattern) || errorCode.toLowerCase().includes(pattern)
    );
  }

  // ============================================
  // ADMIN ACTION LOGGING
  // ============================================

  async logAdminAction(
    adminUserId: string,
    targetUserId: string,
    actionType: string,
    description: string,
    metadata: any = {}
  ): Promise<void> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, skipping admin action logging');
      return;
    }

    if (!supabase) {
      console.warn('Database connection not available, skipping admin action logging');
      return;
    }

    try {
      await this.withRetry(async () => {
        const { error } = await supabase
          .from('admin_actions')
          .insert({
            admin_user_id: adminUserId,
            target_user_id: targetUserId,
            action_type: actionType,
            description,
            metadata
          });

        if (error) {
          console.error('Database error in logAdminAction:', error);
          // Don't throw - just log the error and continue
          console.warn('Admin action logging failed, but continuing with main operation');
        }
      });
    } catch (error) {
      console.error('Failed to log admin action:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  // ============================================
  // USER PROFILES & ADMIN UTILITIES
  // ============================================

  async getProfileByUserId(userId: string): Promise<any> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not properly configured. Please check your environment settings.');
    }

    if (!supabase) {
      throw new Error('Database connection is not available. Please check your internet connection.');
    }

    return this.withRetry(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Database error in getProfileByUserId:', error);
        throw error;
      }

      return data;
    });
  }

  async getAllProfiles(): Promise<any[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not properly configured. Please check your environment settings.');
    }

    if (!supabase) {
      throw new Error('Database connection is not available. Please check your internet connection.');
    }

    return this.withRetry(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error in getAllProfiles:', error);
        throw error;
      }

      return data || [];
    });
  }


  // ============================================
  // PROJECTS
  // ============================================

  async getProjects(userId: string): Promise<Project[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not properly configured. Please check your environment settings.');
    }

    if (!supabase) {
      throw new Error('Database connection is not available. Please check your internet connection.');
    }

    return this.withRetry(async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error in getProjects:', error);
        throw error;
      }
      
      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        date: row.created_at,
        entryTypes: (row.entry_types as EntryType[]) || ['akra', 'ring', 'open', 'packet'],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        userId: row.user_id,
      }));
    });
  }

  async getProject(projectId: string): Promise<Project | null> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not properly configured. Please check your environment settings.');
    }

    if (!supabase) {
      throw new Error('Database connection is not available. Please check your internet connection.');
    }

    return this.withRetry(async () => {
      // Use service role client if available (for admin operations)
      const clientToUse = supabaseAdmin || supabase;
      console.log('getProject - Using client:', supabaseAdmin ? 'service role' : 'regular');
      
      const { data, error } = await clientToUse
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error('Database error in getProject:', error);
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        date: data.created_at,
        entryTypes: (data.entry_types as EntryType[]) || ['akra', 'ring'],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        userId: data.user_id,
      };
    });
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not properly configured. Please check your environment settings.');
    }

    if (!supabase) {
      throw new Error('Database connection is not available. Please check your internet connection.');
    }

    return this.withRetry(async () => {
      console.log('getUserProjects - Querying projects for user_id:', userId);
      
      // Check if this is an admin impersonation by looking at localStorage
      const impersonationData = localStorage.getItem('gull-admin-impersonation');
      const isImpersonating = !!impersonationData;
      console.log('getUserProjects - Impersonation check:', { isImpersonating, impersonationData });
      console.log('getUserProjects - supabaseAdmin available:', !!supabaseAdmin);
      console.log('getUserProjects - Service key loaded:', !!supabaseServiceKey);
      
      // Also check all localStorage keys to see what's stored
      const allStorageKeys = Object.keys(localStorage);
      console.log('getUserProjects - All localStorage keys:', allStorageKeys);
      
      // Use service role client if available (always use it when available for admin operations)
      let clientToUse = supabase;
      if (supabaseAdmin) {
        console.log('getUserProjects - Using service role client (bypasses RLS)');
        console.log('getUserProjects - Service role client object:', supabaseAdmin);
        clientToUse = supabaseAdmin;
      } else {
        console.log('getUserProjects - Service role client not available, using regular supabase client');
        console.log('getUserProjects - supabaseAdmin is:', supabaseAdmin);
      }
      
      // First check if user is authenticated (always use regular client for auth)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('getUserProjects - Auth check:', { user: user?.id, authError });
      
      // Check if current user is admin (use regular client for RPC)
      if (user?.id) {
        const { data: adminCheck, error: adminCheckError } = await supabase
          .rpc('current_user_is_admin');
        console.log('getUserProjects - Admin check:', { adminCheck, adminCheckError });
        
        // Also check the current user's profile
        const { data: currentUserProfile, error: profileError } = await clientToUse
          .from('profiles')
          .select('user_id, role, email')
          .eq('user_id', user.id)
          .single();
        console.log('getUserProjects - Current user profile:', { currentUserProfile, profileError });
        
        // Check if we can access profiles table as admin
        const { data: allProfiles, error: allProfilesError } = await clientToUse
          .from('profiles')
          .select('user_id, email, role')
          .limit(5);
        console.log('getUserProjects - All profiles access test:', { allProfiles, allProfilesError });
      }
      
      // Check if user has a profile
      const { data: profile, error: profileError } = await clientToUse
        .from('profiles')
        .select('user_id, role')
        .eq('user_id', userId)
        .single();
      console.log('getUserProjects - Profile check:', { profile, profileError });
      
      // First, let's check if there are ANY projects in the database
      const { data: allProjects, error: allProjectsError } = await clientToUse
        .from('projects')
        .select('id, user_id, name')
        .limit(10);
      console.log('getUserProjects - All projects in database:', { allProjects, allProjectsError });
      
      // Check if the specific user has any projects
      const { data: userProjectsCheck, error: userProjectsCheckError } = await clientToUse
        .from('projects')
        .select('id, user_id, name')
        .eq('user_id', userId);
      console.log('getUserProjects - Projects for specific user:', { userProjectsCheck, userProjectsCheckError, userId });
      
      // Let's also check what user IDs exist in the projects table
      const { data: allUserIds, error: allUserIdsError } = await clientToUse
        .from('projects')
        .select('user_id');
      console.log('getUserProjects - All user IDs in projects table:', { allUserIds, allUserIdsError });
      
      // Check if our target user ID matches any of the project user IDs
      const matchingUserIds = allUserIds?.filter((p: any) => p.user_id === userId) || [];
      console.log('getUserProjects - Matching user IDs:', { matchingUserIds, targetUserId: userId });
      
      // Now try to query projects for the specific user (use only existing columns)
      const { data, error } = await clientToUse
        .from('projects')
        .select('id, name, description, created_at, updated_at, user_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      console.log('getUserProjects - Query result for user:', { data, error, userId });
      
      // Also try the exact same query that the admin panel uses
      const { data: adminStyleQuery, error: adminStyleError } = await clientToUse
        .from('projects')
        .select('id, user_id, name, created_at')
        .eq('user_id', userId);
      console.log('getUserProjects - Admin-style query result:', { adminStyleQuery, adminStyleError, userId });

      if (error) {
        console.error('Database error in getUserProjects:', error);
        throw error;
      }

      console.log('getUserProjects - Raw projects data:', data);
      return data.map((project: any) => ({
        id: project.id,
        name: project.name,
        date: project.created_at,
        entryTypes: (project.entry_types as EntryType[]) || ['akra', 'ring'],
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        userId: project.user_id,
      }));
    });
  }

  async createProject(userId: string, project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<Project> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not properly configured. Please check your environment settings.');
    }

    if (!supabase) {
      throw new Error('Database connection is not available. Please check your internet connection.');
    }

    // Validate entry types before sending to database
    const validEntryTypes = ['open', 'akra', 'ring', 'packet'];
    const invalidEntryTypes = project.entryTypes.filter(type => !validEntryTypes.includes(type));
    
    if (invalidEntryTypes.length > 0) {
      throw new Error(`Invalid entry types: ${invalidEntryTypes.join(', ')}. Valid types are: ${validEntryTypes.join(', ')}`);
    }

    return this.withRetry(async () => {
      console.log('Creating project with user_id:', userId, 'and project data:', {
        name: project.name,
        entry_types: project.entryTypes
      });

      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: project.name,
          description: null,
          entry_types: project.entryTypes,
        })
        .select()
        .single();

      console.log('Project creation result:', { data, error, userId });

      if (error) {
        console.error('Database error creating project:', error);
        
        // Provide more specific error message for entry type issues
        if (error.message && (error.message.includes('entry_types') || error.message.includes('check constraint') || error.message.includes('projects_entry_types_check'))) {
          throw new Error('Database constraint error: The selected entry types (Open, Packet) are not yet supported by the database schema. Please select only Akra and/or Ring entry types for now.');
        }
        
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        date: data.created_at,
        entryTypes: (data.entry_types as EntryType[]) || ['akra', 'ring'],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        userId: data.user_id,
      };
    });
  }

  async updateProject(projectId: string, updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { error } = await supabase
      .from('projects')
      .update({
        name: updates.name,
      })
      .eq('id', projectId);

    if (error) throw error;
  }

  async deleteProject(projectId: string): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
  }

  // ============================================
  // TRANSACTIONS
  // ============================================

  async getTransactions(projectId: string, userId?: string): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not properly configured. Please check your environment settings.');
    }

    if (!supabase) {
      throw new Error('Database connection is not available. Please check your internet connection.');
    }

    return this.withRetry(async () => {
      // Always use service role client for app_users since they don't have Supabase Auth sessions
      // This bypasses RLS policies that require auth.uid() = user_id
      const clientToUse = supabaseAdmin || supabase;

      console.log('🔍 getTransactions debug:', {
        projectId,
        userId,
        hasSupabaseAdmin: !!supabaseAdmin,
        usingClient: supabaseAdmin ? 'supabaseAdmin (service role)' : 'supabase (fallback)'
      });

      // Handle 'user-scope' by querying for NULL project_id
      // For user-scope, we need to filter by the current user's user_id
      let query = clientToUse
        .from('transactions')
        .select('*');

      if (projectId === 'user-scope') {
        // For user-scope, filter by NULL project_id only (all user's projectless transactions)
        query = query.is('project_id', null);
      } else {
        query = query.eq('project_id', projectId);
      }

      // Filter by user ID if provided (for regular users to see only their own entries)
      if (userId) {
        query = query.eq('user_id', userId);
        console.log('🔒 Filtering transactions by user ID:', userId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      console.log('🔍 getTransactions result:', {
        projectId,
        dataLength: data?.length || 0,
        error: error?.message || 'none',
        firstTransaction: data?.[0] || 'none'
      });

      if (error) {
        console.error('Database error in getTransactions:', error);
        throw error;
      }

      return data.map((row: any) => ({
        id: row.id,
        projectId: row.project_id || 'user-scope', // Map NULL back to 'user-scope'
        number: row.number,
        entryType: row.entry_type as EntryType,
        first: row.first_amount,
        second: row.second_amount,
        notes: row.notes || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    });
  }

  async createTransaction(
    userId: string, 
    transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
    adminUserId?: string
  ): Promise<Transaction> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    // Use service role client to bypass RLS for app_users who don't have Supabase Auth sessions
    // app_users authenticate via custom password hash, not Supabase Auth, so auth.uid() is NULL
    const clientToUse = supabaseAdmin || supabase; // Always prefer service role if available

    // Handle 'user-scope' by setting project_id to NULL
    const projectId = transaction.projectId === 'user-scope' ? null : transaction.projectId;

    console.log('🔍 Creating transaction:', {
      userId,
      projectId,
      entryType: transaction.entryType,
      number: transaction.number,
      first: transaction.first,
      second: transaction.second,
      usingServiceRole: clientToUse === supabaseAdmin
    });

    const { data, error} = await clientToUse
      .from('transactions')
      .insert({
        user_id: userId,
        project_id: projectId,
        number: transaction.number,
        entry_type: transaction.entryType,
        first_amount: transaction.first,
        second_amount: transaction.second,
        notes: transaction.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Transaction insert failed:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error details:', error.details);
      console.error('❌ Error hint:', error.hint);
      throw error;
    }

    console.log('✅ Transaction created successfully:', data.id);

    // Log admin action if this was performed by an admin
    if (adminUserId && adminUserId !== userId) {
      await this.logAdminAction(
        adminUserId,
        userId,
        'create_transaction',
        `Admin created transaction: ${transaction.number} (${transaction.entryType}) - First: ${transaction.first}, Second: ${transaction.second}`,
        {
          transactionId: data.id,
          projectId: transaction.projectId,
          number: transaction.number,
          entryType: transaction.entryType,
          firstAmount: transaction.first,
          secondAmount: transaction.second
        }
      );
    }

    return {
      id: data.id,
      projectId: data.project_id || 'user-scope', // Map NULL back to 'user-scope'
      number: data.number,
      entryType: data.entry_type,
      first: data.first_amount,
      second: data.second_amount,
      notes: data.notes || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateTransaction(
    transactionId: string, 
    updates: Partial<Omit<Transaction, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>,
    adminUserId?: string
  ): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    // Use service role client to bypass RLS for app_users
    const clientToUse = supabaseAdmin || supabase;

    // Get the transaction first to log the change
    const { data: existingTransaction, error: fetchError } = await clientToUse
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError) throw fetchError;

    const updateData: Record<string, unknown> = {};
    if (updates.number !== undefined) updateData.number = updates.number;
    if (updates.entryType !== undefined) updateData.entry_type = updates.entryType;
    if (updates.first !== undefined) updateData.first_amount = updates.first;
    if (updates.second !== undefined) updateData.second_amount = updates.second;
    if (updates.notes !== undefined) updateData.notes = updates.notes || null;

    const { error } = await clientToUse
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (error) throw error;

    // Log admin action if this was performed by an admin
    if (adminUserId && adminUserId !== existingTransaction.user_id) {
      await this.logAdminAction(
        adminUserId,
        existingTransaction.user_id,
        'update_transaction',
        `Admin updated transaction: ${existingTransaction.number} (${existingTransaction.entry_type})`,
        {
          transactionId,
          projectId: existingTransaction.project_id,
          oldValues: {
            number: existingTransaction.number,
            entryType: existingTransaction.entry_type,
            firstAmount: existingTransaction.first_amount,
            secondAmount: existingTransaction.second_amount,
            notes: existingTransaction.notes
          },
          newValues: updates
        }
      );
    }
  }

  async deleteTransaction(transactionId: string, adminUserId?: string): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    // Use service role client to bypass RLS for app_users
    const clientToUse = supabaseAdmin || supabase;

    // Get the transaction first to log the deletion
    const { data: existingTransaction, error: fetchError } = await clientToUse
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await clientToUse
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) throw error;

    // Log admin action if this was performed by an admin
    if (adminUserId && adminUserId !== existingTransaction.user_id) {
      await this.logAdminAction(
        adminUserId,
        existingTransaction.user_id,
        'delete_transaction',
        `Admin deleted transaction: ${existingTransaction.number} (${existingTransaction.entry_type}) - First: ${existingTransaction.first_amount}, Second: ${existingTransaction.second_amount}`,
        {
          transactionId,
          projectId: existingTransaction.project_id,
          deletedTransaction: {
            number: existingTransaction.number,
            entryType: existingTransaction.entry_type,
            firstAmount: existingTransaction.first_amount,
            secondAmount: existingTransaction.second_amount,
            notes: existingTransaction.notes
          }
        }
      );
    }
  }

  async deleteTransactionsByProject(projectId: string): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('project_id', projectId);

    if (error) throw error;
  }

  async deleteAllTransactions(): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    // Use service role client to bypass RLS
    const clientToUse = supabaseAdmin || supabase;

    const { error } = await clientToUse
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (error) {
      console.error('Error deleting all transactions:', error);
      throw error;
    }

    // Clear local cache
    await clearTransactionsCache();
  }

  // ============================================
  // ACTION HISTORY
  // ============================================

  async getActionHistory(projectId: string, limit: number = 50): Promise<ActionHistory[]> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { data, error } = await supabase
      .from('action_history')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      type: row.action_type as 'add' | 'edit' | 'delete' | 'filter' | 'import' | 'batch',
      description: row.description,
      affectedNumbers: row.affected_numbers || [],
      timestamp: row.created_at,
      data: {}, // Empty data for now
    }));
  }

  async addActionHistory(userId: string, action: Omit<ActionHistory, 'id' | 'timestamp' | 'data'>): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { error } = await supabase
      .from('action_history')
      .insert({
        user_id: userId,
        project_id: action.projectId,
        action_type: action.type,
        description: action.description,
        affected_numbers: action.affectedNumbers,
      });

    if (error) throw error;
  }

  // ============================================
  // FILTER PRESETS
  // ============================================

  async getFilterPresets(userId: string, entryType: EntryType): Promise<FilterPreset[]> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { data, error } = await supabase
      .from('filter_presets')
      .select('*')
      .eq('user_id', userId)
      .eq('entry_type', entryType)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      entryType: row.entry_type as EntryType,
      firstQuery: row.first_query || undefined,
      secondQuery: row.second_query || undefined,
      createdAt: row.created_at,
    }));
  }

  async createFilterPreset(userId: string, preset: Omit<FilterPreset, 'id' | 'createdAt'>): Promise<FilterPreset> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { data, error } = await supabase
      .from('filter_presets')
      .insert({
        user_id: userId,
        name: preset.name,
        entry_type: preset.entryType,
        first_query: preset.firstQuery || null,
        second_query: preset.secondQuery || null,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      entryType: data.entry_type,
      firstQuery: data.first_query || undefined,
      secondQuery: data.second_query || undefined,
      createdAt: data.created_at,
    };
  }

  async deleteFilterPreset(presetId: string): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { error } = await supabase
      .from('filter_presets')
      .delete()
      .eq('id', presetId);

    if (error) throw error;
  }

  // ============================================
  // USER PREFERENCES
  // ============================================

  async getUserPreferences(userId: string): Promise<Record<string, unknown>> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return {}; // Not found, return empty
      throw error;
    }

    return {
      theme: data.theme,
      language: data.language,
      notificationsEnabled: data.notifications_enabled,
      ...data.preferences,
    };
  }

  async setUserPreferences(userId: string, preferences: Record<string, unknown>): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { theme, language, notificationsEnabled, ...otherPrefs } = preferences;

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        theme: theme as string || 'light',
        language: language as string || 'en',
        notifications_enabled: notificationsEnabled as boolean ?? true,
        preferences: otherPrefs,
      });

    if (error) throw error;
  }

  // ============================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================

  subscribeToProjects(userId: string, callback: (payload: unknown) => void) {
    if (!this.isOnline() || !supabase) {
      return () => {}; // Return empty unsubscribe function
    }

    const subscription = supabase
      .channel(`projects:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  subscribeToTransactions(projectId: string, callback: (payload: unknown) => void) {
    if (!this.isOnline() || !supabase) {
      return () => {}; // Return empty unsubscribe function
    }

    const subscription = supabase
      .channel(`transactions:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `project_id=eq.${projectId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Subscribe to user balance changes for push notifications
   */
  subscribeToUserBalance(userId: string, callback: (payload: unknown) => void) {
    if (!this.isOnline() || !supabase) {
      return () => {}; // Return empty unsubscribe function
    }

    const subscription = supabase
      .channel(`user_balance:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Subscribe to transactions updates for a specific user (all their projects)
   * This will catch transactions from other devices/sessions
   */
  subscribeToUserTransactions(userId: string, callback: (payload: unknown) => void) {
    if (!this.isOnline() || !supabase) {
      return () => {}; // Return empty unsubscribe function
    }

    const subscription = supabase
      .channel(`user_transactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Subscribe to system-wide notifications or admin actions
   */
  subscribeToSystemEvents(userId: string, callback: (payload: unknown) => void) {
    if (!this.isOnline() || !supabase) {
      return () => {}; // Return empty unsubscribe function
    }

    // For now, we'll use a custom channel for system events
    // This could be extended to listen to specific admin action tables
    const subscription = supabase
      .channel(`system_events:${userId}`)
      .on('broadcast', { event: 'system_notification' }, callback)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  // ============================================
  // USER MANAGEMENT (Admin)
  // ============================================

  /**
   * Get all users with their statistics
   */
  async getAllUsersWithStats(): Promise<any[]> {
    // Cache-first
    const cached = await getUsersWithStatsFromCache();
    if (!isSupabaseConfigured() || !supabase) return cached;

    // Always use service role client to bypass RLS for app_users
    const client = supabaseAdmin || supabase;
    
    console.log('🔍 getAllUsersWithStats debug:', {
      hasSupabaseAdmin: !!supabaseAdmin,
      usingClient: supabaseAdmin ? 'supabaseAdmin (service role)' : 'supabase (fallback)'
    });

    try {
      const usersWithStats = await this.withRetry(async () => {
        const { data: users, error } = await client
          .from('app_users')
          .select('id, username, full_name, email, role, is_active, is_partner, balance, total_spent, created_at, updated_at')
          .order('created_at', { ascending: false });
        if (error) throw error;

        // Cache latest users
        await cacheUsers(users as any);

        // Aggregate counts in a single query
        const { data: tx, error: txErr } = await client
          .from('transactions')
          .select('user_id');
        if (txErr) throw txErr;
        const counts: Record<string, number> = {};
        (tx || []).forEach((r: any) => {
          counts[r.user_id] = (counts[r.user_id] || 0) + 1;
        });
        
        const result = (users || []).map((u: any) => ({ ...u, entryCount: counts[u.id] || 0 }));
        
        console.log('🔍 getAllUsersWithStats result:', {
          usersCount: users?.length || 0,
          transactionsCount: tx?.length || 0,
          userCounts: counts
        });
        
        return result;
      });
      return usersWithStats;
    } catch {
      return cached;
    }
  }

  /**
   * Create a new user (admin only)
   */
  async createUser(userData: {
    username: string;
    password: string;
    fullName: string;
    email: string;
    balance?: number;
    isPartner?: boolean;
  }): Promise<any> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    return this.withRetry(async () => {
      // Step 1: Create Supabase Auth user first (for proper authentication)
      // Use admin client to create user directly
      if (!supabaseAdmin) {
        throw new Error('Admin client required to create users. Please configure VITE_SUPABASE_SERVICE_KEY.');
      }

      console.log('🔍 Creating Supabase Auth user for:', userData.email);

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          username: userData.username,
          full_name: userData.fullName,
        },
      });

      if (authError) {
        console.error('❌ Failed to create Supabase Auth user:', authError);
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Auth user creation succeeded but no user returned');
      }

      const authUserId = authData.user.id;
      console.log('✅ Supabase Auth user created:', authUserId);

      // Step 2: Hash password for app_users table (for backward compatibility)
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // Step 3: Create app_users record with matching ID
      const { data, error } = await supabaseAdmin
        .from('app_users')
        .insert({
          id: authUserId, // Use the same ID as auth.users
          username: userData.username,
          password_hash: passwordHash,
          full_name: userData.fullName,
          email: userData.email,
          role: 'user',
          is_active: true,
          balance: userData.balance || 0,
          is_partner: userData.isPartner || false,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create app_users record:', error);
        
        // Rollback: Delete the auth user we just created
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          console.log('🔄 Rolled back auth user creation');
        } catch (rollbackError) {
          console.error('❌ Failed to rollback auth user:', rollbackError);
        }

        if (error.code === '23505') {
          throw new Error('Username or email already exists');
        }
        throw error;
      }

      console.log('✅ User created successfully:', data.id);
      return data;
    });
  }

  /**
   * Sync Supabase Auth user for existing app_users (admin only)
   * Creates a Supabase Auth account for users that were created before the fix
   */
  async syncAuthUser(userId: string, email: string, newPassword: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      throw new Error('Admin client required to sync auth users');
    }

    console.log('🔍 Syncing auth user for app_users ID:', userId);

    // Check if auth user already exists
    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
    const authUserExists = existingAuthUser?.users?.some((u: { email: string }) => u.email === email);

    if (authUserExists) {
      throw new Error('Auth user already exists for this email');
    }

    // Get the app_user data
    const { data: appUser, error: fetchError } = await supabaseAdmin
      .from('app_users')
      .select('username, full_name')
      .eq('id', userId)
      .single();

    if (fetchError || !appUser) {
      throw new Error('App user not found');
    }

    // Create Supabase Auth user with the app_user's ID
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: newPassword,
      email_confirm: true,
      user_metadata: {
        username: appUser.username,
        full_name: appUser.full_name,
      },
    });

    if (authError) {
      console.error('❌ Failed to create auth user:', authError);
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    console.log('✅ Auth user created:', authData.user?.id);

    // Update password hash in app_users
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabaseAdmin
      .from('app_users')
      .update({ password_hash: passwordHash })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to update password hash:', updateError);
      // Don't throw - auth user is created, password update failure is not critical
    }

    console.log('✅ Auth user synced successfully');
  }

  /**
   * Test service role client access
   */
  async testServiceRoleAccess(): Promise<{ success: boolean, error?: any }> {
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return { success: false, error: new Error('Admin client not available') };
    }

    try {
      console.log('🧪 Testing service role access...');
      
      // Try to read from app_users table
      const { data, error } = await supabaseAdmin
        .from('app_users')
        .select('id, username, balance')
        .limit(1);

      if (error) {
        console.error('❌ Service role test failed:', error);
        return { success: false, error };
      }

      console.log('✅ Service role test successful:', data);
      return { success: true };
    } catch (err) {
      console.error('❌ Service role test exception:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Get user balance (uses service role to bypass RLS)
   */
  async getUserBalance(userId: string): Promise<{ data?: { balance: number; total_spent: number }, error?: any }> {
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      console.error('❌ Admin client not available for getUserBalance:', { 
        isSupabaseConfigured: isSupabaseConfigured(), 
        hasSupabaseAdmin: !!supabaseAdmin 
      });
      return { error: new Error('Admin client required to get balance') };
    }

    try {
      console.log('🔧 Getting balance with service role client:', {
        userId,
        hasServiceKey: !!supabaseAdmin.supabaseKey,
        serviceKeyPreview: supabaseAdmin.supabaseKey ? supabaseAdmin.supabaseKey.substring(0, 20) + '...' : 'NOT SET'
      });

      const { data, error } = await supabaseAdmin
        .from('app_users')
        .select('balance, total_spent')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Failed to get balance from database:', error);
        return { error };
      }

      console.log('✅ Balance retrieved from database for user:', userId, 'balance:', data.balance, 'total_spent:', data.total_spent);
      return { data };
    } catch (err) {
      console.error('❌ Exception getting balance:', err);
      return { error: err };
    }
  }

  /**
   * Update user balance (uses service role to bypass RLS)
   */
  async updateUserBalance(userId: string, newBalance: number): Promise<{ error?: any }> {
    // ⚠️ CRITICAL: Prevent negative balance
    if (newBalance < 0) {
      console.error('❌ Cannot update balance: Balance would become negative', {
        userId,
        attemptedBalance: newBalance
      });
      return { error: new Error('Insufficient balance. Balance cannot be negative.') };
    }

    if (!isSupabaseConfigured() || !supabaseAdmin) {
      console.error('❌ Admin client not available:', { 
        isSupabaseConfigured: isSupabaseConfigured(), 
        hasSupabaseAdmin: !!supabaseAdmin 
      });
      return { error: new Error('Admin client required to update balance') };
    }

    try {
      console.log('🔧 Updating balance with service role client:', {
        userId,
        newBalance,
        hasServiceKey: !!supabaseAdmin.supabaseKey,
        serviceKeyPreview: supabaseAdmin.supabaseKey ? supabaseAdmin.supabaseKey.substring(0, 20) + '...' : 'NOT SET'
      });

      const { error } = await supabaseAdmin
        .from('app_users')
        .update({ balance: newBalance })
        .eq('id', userId);

      if (error) {
        console.error('❌ Failed to update balance in database:', error);
        return { error };
      }

      console.log('✅ Balance updated in database for user:', userId);
      return {};
    } catch (err) {
      console.error('❌ Exception updating balance:', err);
      return { error: err };
    }
  }

  /**
   * Update user data (admin only)
   */
  async updateUser(userId: string, updates: {
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
    isActive?: boolean;
    isPartner?: boolean;
  }): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    return this.withRetry(async () => {
      const updateData: any = {};

      if (updates.fullName !== undefined) updateData.full_name = updates.fullName;
      if (updates.username !== undefined) updateData.username = updates.username;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.isPartner !== undefined) updateData.is_partner = updates.isPartner;

      if (updates.password !== undefined) {
        const bcrypt = await import('bcryptjs');
        updateData.password_hash = await bcrypt.hash(updates.password, 10);
      }

      const { error } = await supabase
        .from('app_users')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Username or email already exists');
        }
        throw error;
      }
    });
  }

  /**
   * Top up user balance (admin only)
   */
  async topUpUserBalance(userId: string, amount: number): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    // Always use service role client to bypass RLS for app_users
    const client = supabaseAdmin || supabase;
    
    console.log('🔍 topUpUserBalance debug:', {
      userId,
      amount,
      hasSupabaseAdmin: !!supabaseAdmin,
      usingClient: supabaseAdmin ? 'supabaseAdmin (service role)' : 'supabase (fallback)'
    });

    return this.withRetry(async () => {
      // Get current balance
      const { data: user, error: fetchError } = await client
        .from('app_users')
        .select('balance')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      // Update balance
      const newBalance = (user.balance || 0) + amount;
      const { error: updateError } = await client
        .from('app_users')
        .update({ balance: newBalance })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log the top-up in balance_history table (if it exists)
      try {
        await client
          .from('balance_history')
          .insert({
            app_user_id: userId,
            amount: amount,
            type: 'top_up',
            balance_after: newBalance,
          });
      } catch (err) {
        console.warn('Could not log balance history:', err);
      }
    });
  }

  /**
   * Get user's entries by type
   */
  async getUserEntries(userId: string, entryType?: string): Promise<any[]> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    // Use service role client for admin reads to bypass RLS
    const client = this.getReadClient();

    return this.withRetry(async () => {
      let query = client
        .from('transactions')
        .select('*')
        .eq('user_id', userId) // Use user_id for app_users
        .order('created_at', { ascending: false });

      if (entryType) {
        query = query.eq('entry_type', entryType);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data;
    });
  }

  /**
   * Get all entries by type (all users)
   * @param entryType - The entry type to filter by
   * @param adminView - If true, applies admin deductions to amounts (admin-only view)
   */
  async getAllEntriesByType(entryType: string, adminView: boolean = false): Promise<any[]> {
    // Cache-first
    const cached = await getEntriesByTypeFromCache(entryType);
    if (!isSupabaseConfigured() || !supabase) return cached;

    // Always use service role client to bypass RLS for app_users
    const client = supabaseAdmin || supabase;
    
    console.log('🔍 getAllEntriesByType debug:', {
      entryType,
      adminView,
      hasSupabaseAdmin: !!supabaseAdmin,
      usingClient: supabaseAdmin ? 'supabaseAdmin (service role)' : 'supabase (fallback)',
      supabaseAdminKey: supabaseAdmin ? 'SET' : 'NOT SET',
      supabaseAdminType: typeof supabaseAdmin
    });

    try {
      const rows = await this.withRetry(async () => {
        // First, get all transactions for this entry type
        const { data: transactions, error: txError } = await client
          .from('transactions')
          .select('id, user_id, project_id, number, entry_type, first_amount, second_amount, created_at, updated_at')
          .eq('entry_type', entryType)
          .order('created_at', { ascending: false });
        
        console.log('🔍 getAllEntriesByType transactions result:', {
          entryType,
          dataLength: transactions?.length || 0,
          error: txError?.message || 'none',
          firstTransaction: transactions?.[0] || 'none'
        });
        
        if (txError) throw txError;
        
        if (!transactions || transactions.length === 0) {
          return [];
        }
        
        // Get all unique user IDs from transactions
        const userIds = [...new Set(transactions.map((t: any) => t.user_id).filter(Boolean))];
        
        // Fetch user details for all users
        const { data: users, error: usersError } = await client
          .from('app_users')
          .select('id, username, full_name')
          .in('id', userIds);
        
        console.log('🔍 getAllEntriesByType users result:', {
          userIds,
          usersLength: users?.length || 0,
          error: usersError?.message || 'none'
        });
        
        if (usersError) throw usersError;
        
        // Create a map of user details
        const userMap = new Map();
        (users || []).forEach((user: any) => {
          userMap.set(user.id, { username: user.username, full_name: user.full_name });
        });
        
        // Get admin deductions if adminView is true
        let deductionsMap = new Map<string, { first: number; second: number }>();
        if (adminView) {
          try {
            const { data: deductions, error: dedError } = await client
              .from('admin_deductions')
              .select('transaction_id, deducted_first, deducted_second')
              .in('transaction_id', transactions.map((t: any) => t.id));
            
            if (!dedError && deductions) {
              // Sum up all deductions per transaction
              deductions.forEach((ded: any) => {
                const existing = deductionsMap.get(ded.transaction_id) || { first: 0, second: 0 };
                deductionsMap.set(ded.transaction_id, {
                  first: existing.first + (ded.deducted_first || 0),
                  second: existing.second + (ded.deducted_second || 0),
                });
              });
            }
          } catch (err) {
            console.warn('Could not load admin deductions:', err);
          }
        }
        
        // Split bulk entries and combine transactions with user details
        const allEntries: any[] = [];
        
        transactions.forEach((transaction: any) => {
          const userId = transaction.user_id;
          const userInfo = userMap.get(userId) || { username: 'Unknown', full_name: 'Unknown User' };
          
          // Check if this is a bulk entry (comma or space separated numbers)
          const isBulkEntry = transaction.number && (transaction.number.includes(',') || transaction.number.includes(' '));
          
          if (isBulkEntry) {
            // Split bulk entry into individual entries
            const numbers = transaction.number.split(/[,\s]+/).filter((n: string) => n.trim().length > 0);
            
            numbers.forEach((number: string) => {
              const trimmedNumber = number.trim();
              
              // Apply admin deductions if in admin view
              let firstAmount = transaction.first_amount || 0;
              let secondAmount = transaction.second_amount || 0;
              
              if (adminView) {
                const deductions = deductionsMap.get(transaction.id) || { first: 0, second: 0 };
                // Distribute deductions equally across split entries
                const deductionPerEntry = {
                  first: deductions.first / numbers.length,
                  second: deductions.second / numbers.length,
                };
                firstAmount = Math.max(0, firstAmount - deductionPerEntry.first);
                secondAmount = Math.max(0, secondAmount - deductionPerEntry.second);
              }
              
              allEntries.push({
                ...transaction,
                number: trimmedNumber,
                first_amount: firstAmount,
                second_amount: secondAmount,
                user_id: userId,
                app_users: userInfo,
                is_split_entry: true,
                original_transaction_id: transaction.id,
              });
            });
          } else {
            // Single entry
            let firstAmount = transaction.first_amount || 0;
            let secondAmount = transaction.second_amount || 0;
            
            if (adminView) {
              const deductions = deductionsMap.get(transaction.id) || { first: 0, second: 0 };
              firstAmount = Math.max(0, firstAmount - deductions.first);
              secondAmount = Math.max(0, secondAmount - deductions.second);
            }
            
            allEntries.push({
              ...transaction,
              first_amount: firstAmount,
              second_amount: secondAmount,
              user_id: userId,
              app_users: userInfo,
            });
          }
        });
        
        console.log('🔍 getAllEntriesByType final result:', {
          entryType,
          adminView,
          originalTransactions: transactions.length,
          finalDataLength: allEntries.length,
          sampleEntry: allEntries[0] || 'none'
        });
        
        return allEntries;
      });
      return rows;
    } catch {
      return cached;
    }
  }

  /**
   * Get user history (entries + top-ups + admin actions)
   */
  async getUserHistory(userId: string): Promise<any[]> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    // Always use service role client to bypass RLS for app_users
    const client = supabaseAdmin || supabase;
    
    console.log('🔍 getUserHistory debug:', {
      userId,
      hasSupabaseAdmin: !!supabaseAdmin,
      usingClient: supabaseAdmin ? 'supabaseAdmin (service role)' : 'supabase (fallback)'
    });

    return this.withRetry(async () => {
      // Get entries (use user_id for app_users)
      const { data: entries, error: entriesError } = await client
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (entriesError) throw entriesError;

      // Try to get balance history (both top-ups and withdrawals)
      let balanceHistoryItems: any[] = [];
      try {
        const { data: balanceHistory, error: balanceError } = await client
          .from('balance_history')
          .select('*')
          .eq('app_user_id', userId)
          .order('created_at', { ascending: false });

        if (!balanceError && balanceHistory) {
          balanceHistoryItems = balanceHistory.map((item: any) => ({
            ...item,
            isTopUp: true, // Keep this for compatibility with existing UI
          }));
        }
      } catch (err) {
        console.warn('Balance history table not available:', err);
      }

      // Try to get admin actions affecting this user
      let adminActions: any[] = [];
      try {
        const { data: actions, error: actionsError } = await client
          .from('admin_actions')
          .select('*, admin_user:admin_user_id(username, email)')
          .eq('target_user_id', userId)
          .order('created_at', { ascending: false });

        if (!actionsError && actions) {
          adminActions = actions.map((action: any) => ({
            ...action,
            isAdminAction: true,
          }));
        }
      } catch (err) {
        console.warn('Admin actions table not available:', err);
      }

      // Combine and sort by date
      const combined = [
        ...entries.map((e: any) => ({ ...e, isEntry: true })),
        ...balanceHistoryItems,
        ...adminActions,
      ];

      combined.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return combined;
    });
  }

  /**
   * Get/Set system-wide settings
   */
  async getSystemSettings(): Promise<{ entriesEnabled: boolean }> {
    if (!isSupabaseConfigured() || !supabase) {
      console.log('🔍 Supabase not configured, using default: entriesEnabled = true');
      return { entriesEnabled: true };
    }

    try {
      console.log('🔍 Fetching system settings from database...');
      // Use service role client if available for reliable access
      const clientToUse = supabaseAdmin || supabase;
      console.log('🔍 Using client:', supabaseAdmin ? 'service role' : 'regular');
      
      const { data, error } = await clientToUse
        .from('system_settings')
        .select('entries_enabled')
        .eq('id', 'global')
        .single();

      console.log('🔍 System settings query result:', { data, error });

      if (error && error.code !== 'PGRST116') {
        console.warn('Could not fetch system settings:', error);
        return { entriesEnabled: true };
      }

      const entriesEnabled = data?.entries_enabled === true;
      console.log('🔍 Parsed entriesEnabled:', entriesEnabled);
      
      return { entriesEnabled };
    } catch (err) {
      console.warn('System settings table not available:', err);
      return { entriesEnabled: true };
    }
  }

  async setSystemSettings(settings: { entriesEnabled: boolean }): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      console.log('🔍 Supabase not configured, cannot save system settings');
      throw new Error('Database not available');
    }

    try {
      console.log('🔍 Saving system settings to database:', settings);
      // Use service role client if available for reliable access
      const clientToUse = supabaseAdmin || supabase;
      console.log('🔍 Using client for save:', supabaseAdmin ? 'service role' : 'regular');
      
      const { error } = await clientToUse
        .from('system_settings')
        .upsert({
          id: 'global',
          entries_enabled: settings.entriesEnabled,
          updated_at: new Date().toISOString(),
        });
      
      if (error) {
        console.error('❌ Error saving system settings:', error);
        throw error;
      }
      
      console.log('✅ System settings saved to database');
    } catch (err) {
      console.error('❌ Failed to save system settings:', err);
      throw err;
    }
  }

  // ============================================
  // ADMIN DEDUCTION FUNCTIONS
  // ============================================

  /**
   * Save admin deduction (affects admin view only, not actual user data)
   */
  async saveAdminDeduction(
    transactionId: string,
    adminUserId: string,
    deductedFirst: number,
    deductedSecond: number,
    deductionType: string,
    metadata?: any
  ): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    const client = supabaseAdmin || supabase;

    return this.withRetry(async () => {
      const { error } = await client
        .from('admin_deductions')
        .insert({
          transaction_id: transactionId,
          admin_user_id: adminUserId,
          deducted_first: deductedFirst,
          deducted_second: deductedSecond,
          deduction_type: deductionType,
          metadata: metadata || {},
        });

      if (error) throw error;
    });
  }

  /**
   * Get admin deductions for a specific entry type
   */
  async getAdminDeductionsByType(entryType: 'open' | 'akra' | 'ring' | 'packet'): Promise<any[]> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    const client = supabaseAdmin || supabase;

    return this.withRetry(async () => {
      // First, get all deductions with their transaction details (without embedding app_users)
      const { data, error } = await client
        .from('admin_deductions')
        .select(`
          *,
          transactions!inner (
            id,
            number,
            entry_type,
            user_id
          )
        `)
        .eq('transactions.entry_type', entryType)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        return [];
      }
      
      // Get unique user IDs from transactions
      const transactionUserIds = [...new Set(data.map((d: any) => d.transactions.user_id).filter(Boolean))];
      
      // Fetch transaction user details separately
      const { data: transactionUsers } = await client
        .from('app_users')
        .select('id, username, full_name')
        .in('id', transactionUserIds);

      // Fetch admin user details separately
      const adminUserIds = [...new Set(data.map((d: any) => d.admin_user_id))];
      const { data: adminUsers } = await client
        .from('app_users')
        .select('id, username, full_name')
        .in('id', adminUserIds);

      // Create maps for quick lookup
      const transactionUserMap = new Map((transactionUsers || []).map((u: any) => [u.id, u]));
      const adminMap = new Map((adminUsers || []).map((u: any) => [u.id, u]));
      
      // Combine all data
      return data.map((d: any) => ({
        ...d,
        transactions: {
          ...d.transactions,
          app_users: transactionUserMap.get(d.transactions.user_id) || { username: 'Unknown', full_name: 'Unknown' }
        },
        admin: adminMap.get(d.admin_user_id) || { username: 'Unknown', full_name: 'Unknown' }
      }));
    });
  }

  /**
   * Delete a specific admin deduction (undo deduction)
   */
  async deleteAdminDeduction(deductionId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    const client = supabaseAdmin || supabase;

    return this.withRetry(async () => {
      const { error } = await client
        .from('admin_deductions')
        .delete()
        .eq('id', deductionId);

      if (error) throw error;

      // Clear cache so next load shows updated amounts
      clearTransactionsCache();
    });
  }

  /**
   * Get all admin deductions for specific transactions
   */
  async getAdminDeductions(transactionIds: string[]): Promise<any[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    const client = supabaseAdmin || supabase;

    try {
      const { data, error } = await client
        .from('admin_deductions')
        .select('*')
        .in('transaction_id', transactionIds);

      if (error) throw error;

      return data || [];
    } catch (err) {
      console.warn('Could not fetch admin deductions:', err);
      return [];
    }
  }

  // ============================================
  // USER MANAGEMENT FUNCTIONS
  // ============================================

  /**
   * Toggle user active status
   */
  async toggleUserActiveStatus(userId: string, isActive: boolean): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    const client = supabaseAdmin || supabase;

    return this.withRetry(async () => {
      const { error } = await client
        .from('app_users')
        .update({ is_active: isActive })
        .eq('id', userId);

      if (error) throw error;
    });
  }

  /**
   * Delete user (soft delete - sets is_active to false and deleted_at)
   */
  async deleteUser(userId: string, hardDelete: boolean = false): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    const client = supabaseAdmin || supabase;

    return this.withRetry(async () => {
      if (hardDelete) {
        // Hard delete - remove from database (cascades to transactions)
        const { error } = await client
          .from('app_users')
          .delete()
          .eq('id', userId);

        if (error) throw error;

        // Also delete from Supabase auth if using admin client
        if (supabaseAdmin) {
          try {
            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
            if (authError) {
              console.warn('Failed to delete auth user:', authError);
              // Don't throw - app_users deletion already succeeded
            } else {
              console.log('✅ Successfully deleted user from Supabase auth');
            }
          } catch (err) {
            console.warn('Error deleting auth user:', err);
            // Don't throw - app_users deletion already succeeded
          }
        }
      } else {
        // Soft delete - set inactive and deleted_at timestamp
        const { error } = await client
          .from('app_users')
          .update({
            is_active: false,
            deleted_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (error) throw error;
      }
    });
  }

  /**
   * Reset user history (delete all transactions for a specific user)
   */
  async resetUserHistory(userId: string): Promise<{ deletedCount: number }> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    const client = supabaseAdmin || supabase;

    return this.withRetry(async () => {
      // First, get count of transactions to be deleted
      const { count, error: countError } = await client
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) throw countError;

      // Delete all transactions for this user
      const { error: deleteError } = await client
        .from('transactions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Delete all admin deductions for this user's transactions
      // Note: These will also be cascade-deleted if foreign key is set properly,
      // but we do it explicitly to be safe
      const { error: deductionsError } = await client
        .from('admin_deductions')
        .delete()
        .eq('admin_user_id', userId);

      // Don't throw on deductions error as they might not exist
      if (deductionsError) {
        console.warn('Error deleting admin deductions:', deductionsError);
      }

      // EXPLICITLY reset total_spent to 0 (even though trigger should do this)
      const { error: resetSpentError } = await client
        .from('app_users')
        .update({ total_spent: 0 })
        .eq('id', userId);

      if (resetSpentError) {
        console.warn('Error resetting total_spent:', resetSpentError);
      }

      // Clear cache
      clearTransactionsCache();

      return { deletedCount: count || 0 };
    });
  }

  /**
   * Reset user's total spent amount to 0
   */
  async resetUserSpent(userId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    const client = supabaseAdmin || supabase;

    return this.withRetry(async () => {
      const { error } = await client
        .from('app_users')
        .update({ total_spent: 0 })
        .eq('id', userId);

      if (error) throw error;
    });
  }

  /**
   * Delete all entries of a specific type (open, akra, ring, packet)
   */
  async deleteAllEntriesByType(entryType: 'open' | 'akra' | 'ring' | 'packet'): Promise<{ deletedCount: number }> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    const client = supabaseAdmin || supabase;

    return this.withRetry(async () => {
      // First, get transaction IDs and count to be deleted
      const { data: transactionsToDelete, count, error: countError } = await client
        .from('transactions')
        .select('id', { count: 'exact' })
        .eq('entry_type', entryType);

      if (countError) throw countError;

      // If there are transactions to delete, also delete their admin deductions
      if (transactionsToDelete && transactionsToDelete.length > 0) {
        const transactionIds = transactionsToDelete.map((t: any) => t.id);
        
        // Delete admin deductions for these transactions
        const { error: deductionsError } = await client
          .from('admin_deductions')
          .delete()
          .in('transaction_id', transactionIds);

        // Don't throw on deductions error as they might not exist
        if (deductionsError) {
          console.warn('Error deleting admin deductions:', deductionsError);
        }
      }

      // Delete all transactions of this type
      const { error: deleteError } = await client
        .from('transactions')
        .delete()
        .eq('entry_type', entryType);

      if (deleteError) throw deleteError;

      // Clear cache
      clearTransactionsCache();

      return { deletedCount: count || 0 };
    });
  }

  /**
   * Withdraw from user balance (opposite of top-up)
   */
  async withdrawUserBalance(userId: string, amount: number): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Database not available');
    }

    const client = supabaseAdmin || supabase;

    return this.withRetry(async () => {
      // Get current balance
      const { data: user, error: fetchError } = await client
        .from('app_users')
        .select('balance')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      const currentBalance = user.balance || 0;
      if (currentBalance < amount) {
        throw new Error('Insufficient balance for withdrawal');
      }

      // Update balance
      const newBalance = currentBalance - amount;
      const { error: updateError } = await client
        .from('app_users')
        .update({ balance: newBalance })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log the withdrawal in balance_history table (if it exists)
      try {
        await client
          .from('balance_history')
          .insert({
            app_user_id: userId,
            amount: -amount, // Negative to indicate withdrawal
            type: 'withdrawal',
            balance_after: newBalance,
          });
      } catch (err) {
        console.warn('Could not log balance history:', err);
      }
    });
  }
}

// Export singleton instance
export const db = DatabaseService.getInstance();

