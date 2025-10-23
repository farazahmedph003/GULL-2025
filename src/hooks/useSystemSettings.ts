import { useCallback, useEffect, useState } from 'react';
import { supabase, isOfflineMode } from '../lib/supabase';

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
      if (!isOfflineMode() && supabase) {
        const { data, error: qError } = await supabase
          .from('system_settings')
          .select('entries_enabled')
          .eq('id', 'global')
          .single();

        if (qError) throw qError;
        setEntriesEnabledState(data?.entries_enabled ?? true);
      } else {
        // Offline fallback: local cache
        const cached = localStorage.getItem('gull_system_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          setEntriesEnabledState(parsed.entriesEnabled ?? true);
        } else {
          setEntriesEnabledState(true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
      setEntriesEnabledState(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    entriesEnabled,
    loading,
    error,
    refresh: fetchSettings,
    // Admin setter will be added in Admin dashboard later
  } as SystemSettingsState & { refresh: () => Promise<void> };
};


