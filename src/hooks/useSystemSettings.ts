import { useCallback, useEffect, useState } from 'react';
import { db } from '../services/database';
import { supabase } from '../lib/supabase';

export interface SystemSettingsState {
  entriesEnabled: boolean;
  loading: boolean;
  error: string | null;
}

// Global state to prevent multiple instances from conflicting
let globalSettings: { entriesEnabled: boolean } | null = null;
let globalLoading = false;
let globalError: string | null = null;
let settingsPromise: Promise<{ entriesEnabled: boolean }> | null = null;

export const useSystemSettings = () => {
  const [entriesEnabled, setEntriesEnabledState] = useState<boolean>(globalSettings?.entriesEnabled ?? true);
  const [loading, setLoading] = useState<boolean>(globalLoading);
  const [error, setError] = useState<string | null>(globalError);

  const fetchSettings = useCallback(async () => {
    // If already loading, wait for the existing promise
    if (settingsPromise) {
      try {
        const settings = await settingsPromise;
        setEntriesEnabledState(settings.entriesEnabled);
        return;
      } catch (e) {
        console.error('❌ Error waiting for settings:', e);
        return;
      }
    }

    // ALWAYS fetch fresh data from database (don't use cached settings)
    globalLoading = true;
    setLoading(true);
    setError(null);
    globalError = null;

    try {
      settingsPromise = db.getSystemSettings();
      const settings = await settingsPromise;
      
      globalSettings = settings;
      setEntriesEnabledState(settings.entriesEnabled);
    } catch (e) {
      console.error('❌ Error fetching system settings:', e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to load settings';
      setError(errorMessage);
      globalError = errorMessage;
      setEntriesEnabledState(true);
    } finally {
      setLoading(false);
      globalLoading = false;
      settingsPromise = null;
    }
  }, []);

  const toggleEntriesEnabled = useCallback(async () => {
    try {
      const newValue = !entriesEnabled;
      
      // Update immediately for responsive UI
      setEntriesEnabledState(newValue);
      globalSettings = { entriesEnabled: newValue };
      
      // Save to database
      await db.setSystemSettings({ entriesEnabled: newValue });
    } catch (e) {
      console.error('❌ Error toggling settings:', e);
      setError(e instanceof Error ? e.message : 'Failed to update settings');
      // Revert on error
      setEntriesEnabledState(entriesEnabled);
      globalSettings = { entriesEnabled };
      throw e;
    }
  }, [entriesEnabled]);

  useEffect(() => {
    fetchSettings();

    // ✨ Real-time subscription to system_settings for INSTANT updates
    if (!supabase) return;
    
    const subscription = supabase
      .channel('system-settings-realtime')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings'
        },
        (payload: any) => {
          if (payload.new) {
            const newEntriesEnabled = payload.new.entries_enabled === true || payload.new.entries_enabled === 'true';
            
            // Update local state instantly
            setEntriesEnabledState(newEntriesEnabled);
            globalSettings = { entriesEnabled: newEntriesEnabled };
            
            // Broadcast to other tabs/windows
            window.dispatchEvent(new CustomEvent('system-settings-updated', {
              detail: { entriesEnabled: newEntriesEnabled }
            }));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchSettings]);

  // Listen for cross-tab updates
  useEffect(() => {
    const handleStorageUpdate = (event: any) => {
      if (event.detail?.entriesEnabled !== undefined) {
        setEntriesEnabledState(event.detail.entriesEnabled);
        globalSettings = { entriesEnabled: event.detail.entriesEnabled };
      }
    };

    window.addEventListener('system-settings-updated', handleStorageUpdate as any);
    return () => window.removeEventListener('system-settings-updated', handleStorageUpdate as any);
  }, []);

  return {
    entriesEnabled,
    loading,
    error,
    refresh: fetchSettings,
    toggleEntriesEnabled,
  } as SystemSettingsState & { 
    refresh: () => Promise<void>;
    toggleEntriesEnabled: () => Promise<void>;
  };
};


