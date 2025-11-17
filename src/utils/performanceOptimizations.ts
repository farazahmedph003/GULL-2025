/**
 * Performance optimization utilities for fast rendering even on slow connections
 */

/**
 * Request cancellation utility for slow connections
 */
export class RequestCanceller {
  private controllers = new Map<string, AbortController>();

  cancel(key: string) {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort();
      this.controllers.delete(key);
    }
  }

  create(key: string): AbortSignal | undefined {
    // Cancel previous request with same key
    this.cancel(key);
    
    const controller = new AbortController();
    this.controllers.set(key, controller);
    return controller.signal;
  }

  cancelAll() {
    this.controllers.forEach(controller => controller.abort());
    this.controllers.clear();
  }
}

/**
 * Optimize component props comparison for React.memo
 */
export function arePropsEqual<T extends Record<string, any>>(
  prevProps: T,
  nextProps: T,
  keysToCompare: (keyof T)[]
): boolean {
  return keysToCompare.every(key => {
    const prev = prevProps[key];
    const next = nextProps[key];
    
    // Handle arrays
    if (Array.isArray(prev) && Array.isArray(next)) {
      if (prev.length !== next.length) return false;
      return prev.every((item, idx) => item === next[idx]);
    }
    
    // Handle objects
    if (typeof prev === 'object' && typeof next === 'object' && prev !== null && next !== null) {
      return JSON.stringify(prev) === JSON.stringify(next);
    }
    
    return prev === next;
  });
}

/**
 * Throttle function calls - ensures function is called at most once per interval
 * Optimized for fast UI response
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Optimize list rendering - only render visible items
 */
export function getVisibleItems<T>(
  items: T[],
  scrollTop: number,
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
): { startIndex: number; endIndex: number; visibleItems: T[] } {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);
  
  return {
    startIndex,
    endIndex,
    visibleItems: items.slice(startIndex, endIndex),
  };
}

