import { supabase, isOfflineMode } from '../lib/supabase';
import type { Project, Transaction, FilterPreset, ActionHistory } from '../types';

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
    return !isOfflineMode() && !!supabase;
  }

  // ============================================
  // PROJECTS
  // ============================================

  async getProjects(userId: string): Promise<Project[]> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data.map(row => ({
      id: row.id,
      name: row.name,
      date: row.created_at,
      entryTypes: ['akra', 'ring'] as ('akra' | 'ring')[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userId: row.user_id,
    }));
  }

  async getProject(projectId: string): Promise<Project | null> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      date: data.created_at,
      entryTypes: data.entry_types || ['akra', 'ring'],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      userId: data.user_id,
    };
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(project => ({
      id: project.id,
      name: project.name,
      date: project.created_at,
      entryTypes: project.entry_types || ['akra', 'ring'],
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      userId: project.user_id,
    }));
  }

  async createProject(userId: string, project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<Project> {
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

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

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      date: data.created_at,
      entryTypes: data.entry_types || ['akra', 'ring'],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      userId: data.user_id,
    };
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
    if (!this.isOnline() || !supabase) {
      throw new Error('Database not available in offline mode');
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      projectId: row.project_id,
      number: row.number,
      entryType: row.entry_type as 'akra' | 'ring',
      first: row.first_amount,
      second: row.second_amount,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
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

    return data.map(row => ({
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

  async getFilterPresets(userId: string, entryType: 'akra' | 'ring'): Promise<FilterPreset[]> {
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

    return data.map(row => ({
      id: row.id,
      name: row.name,
      entryType: row.entry_type as 'akra' | 'ring',
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
}

// Export singleton instance
export const db = DatabaseService.getInstance();

