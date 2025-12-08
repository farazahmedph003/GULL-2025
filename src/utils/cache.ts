/**
 * Universal Cache Utility for Stale-While-Revalidate Pattern
 * Provides instant loading from localStorage with background Supabase sync
 */

export interface CacheConfig<T> {
  key: string;
  ttl?: number; // Time to live in milliseconds (optional, defaults to no expiry)
  validator?: (data: any) => data is T; // Type guard for validation
}

export interface CacheResult<T> {
  data: T | null;
  isStale: boolean;
  timestamp: number | null;
}

/**
 * Get cached data from localStorage
 */
export function getCachedData<T>(config: CacheConfig<T>): CacheResult<T> {
  if (typeof window === 'undefined') {
    return { data: null, isStale: false, timestamp: null };
  }

  try {
    const cached = localStorage.getItem(config.key);
    if (!cached) {
      return { data: null, isStale: false, timestamp: null };
    }

    const parsed = JSON.parse(cached);
    const timestamp = parsed._timestamp || null;
    const data = parsed._data;

    // Validate data structure if validator provided
    if (config.validator && !config.validator(data)) {
      console.warn(`Cache validation failed for key: ${config.key}`);
      localStorage.removeItem(config.key);
      return { data: null, isStale: false, timestamp: null };
    }

    // Check TTL if provided
    if (config.ttl && timestamp) {
      const age = Date.now() - timestamp;
      if (age > config.ttl) {
        // Cache expired, but return stale data anyway (SWR pattern)
        return { data, isStale: true, timestamp };
      }
    }

    return { data, isStale: false, timestamp };
  } catch (error) {
    console.warn(`Failed to read cache for key: ${config.key}`, error);
    localStorage.removeItem(config.key);
    return { data: null, isStale: false, timestamp: null };
  }
}

/**
 * Save data to localStorage cache
 */
export function setCachedData<T>(config: CacheConfig<T>, data: T): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheObject = {
      _data: data,
      _timestamp: Date.now(),
    };
    localStorage.setItem(config.key, JSON.stringify(cacheObject));
  } catch (error) {
    console.warn(`Failed to write cache for key: ${config.key}`, error);
    // If storage is full, try to clear old caches
    try {
      clearOldCaches();
      localStorage.setItem(config.key, JSON.stringify({ _data: data, _timestamp: Date.now() }));
    } catch (retryError) {
      console.error('Failed to write cache even after cleanup', retryError);
    }
  }
}

/**
 * Clear specific cache entry
 */
export function clearCache(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

/**
 * Clear all caches (useful for logout or major updates)
 */
export function clearAllCaches(): void {
  if (typeof window === 'undefined') return;
  
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('cache-') || key.includes('-cache'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Clear old caches to free up space (keeps recent ones)
 */
function clearOldCaches(): void {
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || (!key.startsWith('cache-') && !key.includes('-cache'))) continue;
    
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        const timestamp = parsed._timestamp;
        if (timestamp && (now - timestamp) > maxAge) {
          keysToRemove.push(key);
        }
      }
    } catch {
      // Invalid cache entry, remove it
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Create a stale-while-revalidate loader function
 */
export async function swrLoad<T>(
  config: CacheConfig<T>,
  fetchFn: () => Promise<T>,
  options?: {
    onCacheHit?: (data: T) => void;
    onCacheMiss?: () => void;
    onFetchStart?: () => void;
    onFetchComplete?: (data: T) => void;
    onFetchError?: (error: any) => void;
  }
): Promise<T> {
  // 1. Check cache first
  const cached = getCachedData<T>(config);
  
  if (cached.data !== null) {
    // Cache hit - call callback immediately
    options?.onCacheHit?.(cached.data);
  } else {
    // Cache miss - show loading state
    options?.onCacheMiss?.();
  }

  // 2. Always fetch fresh data in background
  options?.onFetchStart?.();
  
  try {
    const freshData = await fetchFn();
    
    // 3. Update cache with fresh data
    setCachedData(config, freshData);
    
    // 4. Call completion callback
    options?.onFetchComplete?.(freshData);
    
    return freshData;
  } catch (error) {
    options?.onFetchError?.(error);
    
    // If we have stale cache, return it as fallback
    if (cached.data !== null) {
      console.warn(`Fetch failed, using stale cache for ${config.key}`, error);
      return cached.data;
    }
    
    // No cache available, re-throw error
    throw error;
  }
}

// Predefined cache keys for consistency
export const CACHE_KEYS = {
  ADMIN_DASHBOARD_USERS: 'cache-admin-dashboard-users',
  ADMIN_OPEN_ENTRIES: 'cache-admin-open-entries',
  ADMIN_AKRA_ENTRIES: 'cache-admin-akra-entries',
  ADMIN_RING_ENTRIES: 'cache-admin-ring-entries',
  ADMIN_PACKET_ENTRIES: 'cache-admin-packet-entries',
  ADMIN_DEDUCTIONS_OPEN: 'cache-admin-deductions-open',
  ADMIN_DEDUCTIONS_AKRA: 'cache-admin-deductions-akra',
  ADMIN_DEDUCTIONS_RING: 'cache-admin-deductions-ring',
  ADMIN_DEDUCTIONS_PACKET: 'cache-admin-deductions-packet',
  USER_TRANSACTIONS: 'cache-user-transactions',
  USER_BALANCE: 'cache-user-balance',
  ADMIN_DATA_USERS: 'cache-admin-data-users',
  ADMIN_DATA_REPORTS: 'cache-admin-data-reports',
  ADMIN_DATA_STATS: 'cache-admin-data-stats',
} as const;

/**
 * Invalidate cache for a specific entry type (useful when entries are added/updated/deleted)
 */
export function invalidateEntryCache(entryType: 'open' | 'akra' | 'ring' | 'packet'): void {
  const entryKeyMap = {
    open: CACHE_KEYS.ADMIN_OPEN_ENTRIES,
    akra: CACHE_KEYS.ADMIN_AKRA_ENTRIES,
    ring: CACHE_KEYS.ADMIN_RING_ENTRIES,
    packet: CACHE_KEYS.ADMIN_PACKET_ENTRIES,
  };
  
  const deductionKeyMap = {
    open: CACHE_KEYS.ADMIN_DEDUCTIONS_OPEN,
    akra: CACHE_KEYS.ADMIN_DEDUCTIONS_AKRA,
    ring: CACHE_KEYS.ADMIN_DEDUCTIONS_RING,
    packet: CACHE_KEYS.ADMIN_DEDUCTIONS_PACKET,
  };
  
  clearCache(entryKeyMap[entryType]);
  clearCache(deductionKeyMap[entryType]);
}

/**
 * Invalidate all entry caches (useful for bulk operations)
 */
export function invalidateAllEntryCaches(): void {
  Object.values(CACHE_KEYS).forEach(key => {
    if (key.includes('entries') || key.includes('deductions') || key.includes('transactions')) {
      clearCache(key);
    }
  });
}


