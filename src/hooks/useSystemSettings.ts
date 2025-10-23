import { useCallback, useEffect, useState } from 'react';
import { db } from '../services/database';

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

    // If we already have settings and they're recent, use them
    if (globalSettings) {
      setEntriesEnabledState(globalSettings.entriesEnabled);
      setLoading(false);
      return;
    }

    globalLoading = true;
    setLoading(true);
    setError(null);
    globalError = null;

    try {
      console.log('🔍 Fetching system settings...');
      settingsPromise = db.getSystemSettings();
      const settings = await settingsPromise;
      
      console.log('🔍 System settings received:', settings);
      console.log('🔍 Parsed entriesEnabled:', settings.entriesEnabled);
      
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
      console.log('🔄 Toggling entries enabled to:', newValue);
      
      // Update immediately for responsive UI
      setEntriesEnabledState(newValue);
      globalSettings = { entriesEnabled: newValue };
      
      // Save to database
      await db.setSystemSettings({ entriesEnabled: newValue });
      console.log('✅ Settings saved to database');
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
  }, [fetchSettings]);

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


