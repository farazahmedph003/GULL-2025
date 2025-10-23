import { useCallback, useEffect, useState } from 'react';
import { db } from '../services/database';

export interface SystemSettingsState {
  entriesEnabled: boolean;
  loading: boolean;
  error: string | null;
}

export const useSystemSettings = () => {
  const [entriesEnabled, setEntriesEnabledState] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await db.getSystemSettings();
      setEntriesEnabledState(settings.entriesEnabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
      setEntriesEnabledState(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleEntriesEnabled = useCallback(async () => {
    try {
      const newValue = !entriesEnabled;
      await db.setSystemSettings({ entriesEnabled: newValue });
      setEntriesEnabledState(newValue);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update settings');
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


