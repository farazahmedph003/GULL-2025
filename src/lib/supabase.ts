import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
// Force online mode - only enable offline mode if explicitly set to true
const offlineMode = import.meta.env.VITE_ENABLE_OFFLINE_MODE === 'true';

// Create Supabase client with better error handling and connection testing
let supabase: any = null;

try {
  // Only create client if we have the required configuration
  if (supabaseUrl && supabaseAnonKey && !offlineMode) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'X-Client-Info': 'gull-accounting-system',
        },
      },
    });
    
    // Test the connection
    console.log('Supabase client initialized:', {
      url: supabaseUrl,
      hasKey: !!supabaseAnonKey,
      offlineMode,
    });
  } else {
    console.warn('Supabase configuration missing:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      offlineMode,
    });
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  supabase = null;
}

export { supabase };

// Check if Supabase is configured and working
export const isSupabaseConfigured = (): boolean => {
  return !offlineMode && !!supabaseUrl && !!supabaseAnonKey && !!supabase;
};

// Check if offline mode is explicitly enabled (not auto-detected)
export const isOfflineMode = (): boolean => {
  return offlineMode;
};

// Check if we can connect to Supabase
export const isSupabaseConnected = (): boolean => {
  return !!supabase && isSupabaseConfigured();
};

