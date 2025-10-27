import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY || '';
// Force online mode - only enable offline mode if explicitly set to true
const offlineMode = import.meta.env.VITE_ENABLE_OFFLINE_MODE === 'true';

console.log('🔧 Supabase configuration:', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  hasServiceKey: !!supabaseServiceKey,
  serviceKeyLength: supabaseServiceKey.length,
  serviceKeyPreview: supabaseServiceKey ? supabaseServiceKey.substring(0, 20) + '...' : 'NOT SET',
  offlineMode,
  allEnvVars: {
    VITE_SUPABASE_URL: !!import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_SERVICE_KEY: !!import.meta.env.VITE_SUPABASE_SERVICE_KEY,
  }
});

// Create Supabase client with better error handling and connection testing
let supabase: any = null;
let supabaseAdmin: any = null;

try {
  // Only create client if we have the required configuration
  if (supabaseUrl && supabaseAnonKey && !offlineMode) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
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
    
    // Create admin client with service role key (bypasses RLS)
    if (supabaseServiceKey) {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'X-Client-Info': 'gull-accounting-system-admin',
          },
        },
      });
      console.log('Supabase admin client initialized with service role');
    } else {
      console.warn('Supabase service key not provided - admin operations may be limited');
    }
    
    // Test the connection
    console.log('Supabase client initialized:', {
      url: supabaseUrl,
      hasKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceKey,
      offlineMode,
    });
  } else {
    console.warn('Supabase configuration missing:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceKey,
      offlineMode,
    });
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  supabase = null;
  supabaseAdmin = null;
}

export { supabase, supabaseAdmin };

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

