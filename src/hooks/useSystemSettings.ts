import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../services/database';
import { supabase } from '../lib/supabase';
import type { AmountLimitMap, EntryType } from '../types';

export interface SystemSettingsState {
  entriesEnabled: boolean;
  amountLimits: AmountLimitMap;
  loading: boolean;
  error: string | null;
}

// Global state to prevent multiple instances from conflicting
let globalSettings: { entriesEnabled: boolean; amountLimits: AmountLimitMap } | null = null;
let globalLoading = false;
let globalError: string | null = null;
let settingsPromise: Promise<{ entriesEnabled: boolean; amountLimits: AmountLimitMap }> | null = null;

export const useSystemSettings = () => {
  const buildDefaultLimits = useCallback((): AmountLimitMap => ({
    open: { first: null, second: null },
    akra: { first: null, second: null },
    ring: { first: null, second: null },
    packet: { first: null, second: null },
  }), []);

  const parseAmountLimits = useCallback((raw: any): AmountLimitMap => {
    const defaults = buildDefaultLimits();
    if (!raw || typeof raw !== 'object') {
      return defaults;
    }

    const entryTypes: EntryType[] = ['open', 'akra', 'ring', 'packet'];
    const sanitize = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      return Number.isFinite(num) && num >= 0 ? num : null;
    };

    entryTypes.forEach((type) => {
      const config = raw[type] || {};
      defaults[type] = {
        first: sanitize(config.first),
        second: sanitize(config.second),
      };
    });

    return defaults;
  }, [buildDefaultLimits]);

  const defaultAmountLimits = useMemo(
    () => globalSettings?.amountLimits ?? buildDefaultLimits(),
    [buildDefaultLimits],
  );

  const [entriesEnabled, setEntriesEnabledState] = useState<boolean>(globalSettings?.entriesEnabled ?? true);
  const [amountLimits, setAmountLimitsState] = useState<AmountLimitMap>(defaultAmountLimits);
  const [loading, setLoading] = useState<boolean>(globalLoading);
  const [error, setError] = useState<string | null>(globalError);

  const fetchSettings = useCallback(async () => {
    // If already loading, wait for the existing promise
    if (settingsPromise) {
      try {
        const settings = await settingsPromise;
        setEntriesEnabledState(settings.entriesEnabled);
        setAmountLimitsState(settings.amountLimits);
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
      setAmountLimitsState(settings.amountLimits);
    } catch (e) {
      console.error('❌ Error fetching system settings:', e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to load settings';
      setError(errorMessage);
      globalError = errorMessage;
      setEntriesEnabledState(true);
      setAmountLimitsState(defaultAmountLimits);
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
      globalSettings = { entriesEnabled: newValue, amountLimits: amountLimits };
      
      // Save to database
      await db.setSystemSettings({ entriesEnabled: newValue });
    } catch (e) {
      console.error('❌ Error toggling settings:', e);
      setError(e instanceof Error ? e.message : 'Failed to update settings');
      // Revert on error
      setEntriesEnabledState(entriesEnabled);
      globalSettings = { entriesEnabled, amountLimits };
      throw e;
    }
  }, [entriesEnabled, amountLimits]);

  const updateAmountLimits = useCallback(
    async (entryType: EntryType, limits: { first: number | null; second: number | null }) => {
      const sanitized: AmountLimitMap = {
        ...amountLimits,
        [entryType]: {
          first: limits.first ?? null,
          second: limits.second ?? null,
        },
      };

      try {
        setAmountLimitsState(sanitized);
        globalSettings = { entriesEnabled, amountLimits: sanitized };

        await db.setSystemSettings({ amountLimits: sanitized });
      } catch (e) {
        console.error('❌ Error updating amount limits:', e);
        setError(e instanceof Error ? e.message : 'Failed to update amount limits');
        // Revert to previous
        const current = globalSettings?.amountLimits ?? defaultAmountLimits;
        setAmountLimitsState(current);
        globalSettings = { entriesEnabled, amountLimits: current };
        throw e;
      }
    },
    [amountLimits, entriesEnabled, defaultAmountLimits],
  );

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
            const newAmountLimits = parseAmountLimits(payload.new.amount_limits);
            
            // Update local state instantly
            setEntriesEnabledState(newEntriesEnabled);
            setAmountLimitsState(newAmountLimits);
            globalSettings = { entriesEnabled: newEntriesEnabled, amountLimits: newAmountLimits };
            
            // Broadcast to other tabs/windows
            window.dispatchEvent(new CustomEvent('system-settings-updated', {
              detail: { entriesEnabled: newEntriesEnabled, amountLimits: newAmountLimits }
            }));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchSettings, parseAmountLimits, defaultAmountLimits]);

  // Listen for cross-tab updates
  useEffect(() => {
    const handleStorageUpdate = (event: any) => {
      const detail = event.detail;
      if (!detail) return;

      if (detail.entriesEnabled !== undefined) {
        setEntriesEnabledState(detail.entriesEnabled);
      }

      if (detail.amountLimits !== undefined) {
        setAmountLimitsState(parseAmountLimits(detail.amountLimits));
      }

      if (detail.entriesEnabled !== undefined || detail.amountLimits !== undefined) {
        globalSettings = {
          entriesEnabled: detail.entriesEnabled ?? globalSettings?.entriesEnabled ?? true,
          amountLimits: parseAmountLimits(detail.amountLimits ?? globalSettings?.amountLimits ?? defaultAmountLimits),
        };
      }
    };

    window.addEventListener('system-settings-updated', handleStorageUpdate as any);
    return () => window.removeEventListener('system-settings-updated', handleStorageUpdate as any);
  }, [parseAmountLimits, defaultAmountLimits]);

  return {
    entriesEnabled,
    amountLimits,
    loading,
    error,
    refresh: fetchSettings,
    toggleEntriesEnabled,
    updateAmountLimits,
  } as SystemSettingsState & { 
    refresh: () => Promise<void>;
    toggleEntriesEnabled: () => Promise<void>;
    updateAmountLimits: (entryType: EntryType, limits: { first: number | null; second: number | null }) => Promise<void>;
  };
};


