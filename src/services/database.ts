import { supabase, isSupabaseConfigured, isSupabaseConnected } from '../lib/supabase';
import type { Project, Transaction, FilterPreset, ActionHistory, EntryType } from '../types';

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
      const { data, error } = await supabase
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
      
      // First check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('getUserProjects - Auth check:', { user: user?.id, authError });
      
      // Check if user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, role')
        .eq('user_id', userId)
        .single();
      console.log('getUserProjects - Profile check:', { profile, profileError });
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      console.log('getUserProjects - Query result:', { data, error, userId });

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

  async getTransactions(projectId: string): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not properly configured. Please check your environment settings.');
    }

    if (!supabase) {
      throw new Error('Database connection is not available. Please check your internet connection.');
    }

    return this.withRetry(async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Database error in getTransactions:', error);
        throw error;
      }

      return data.map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
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

  async createTransaction(userId: string, transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        project_id: transaction.projectId,
        number: transaction.number,
        entry_type: transaction.entryType,
        first_amount: transaction.first,
        second_amount: transaction.second,
        notes: transaction.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      projectId: data.project_id,
      number: data.number,
      entryType: data.entry_type,
      first: data.first_amount,
      second: data.second_amount,
      notes: data.notes || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateTransaction(transactionId: string, updates: Partial<Omit<Transaction, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const updateData: Record<string, unknown> = {};
    if (updates.number !== undefined) updateData.number = updates.number;
    if (updates.entryType !== undefined) updateData.entry_type = updates.entryType;
    if (updates.first !== undefined) updateData.first_amount = updates.first;
    if (updates.second !== undefined) updateData.second_amount = updates.second;
    if (updates.notes !== undefined) updateData.notes = updates.notes || null;

    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (error) throw error;
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) throw error;
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
}

// Export singleton instance
export const db = DatabaseService.getInstance();

