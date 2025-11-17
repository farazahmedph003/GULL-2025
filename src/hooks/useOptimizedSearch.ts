import { useMemo, useState, useCallback } from 'react';
import { useDebounce } from './useDebounce';

/**
 * Optimized search hook with debouncing and memoization
 * Perfect for slow connections - reduces unnecessary filtering
 */
export function useOptimizedSearch<T>(
  items: T[],
  searchFn: (item: T, searchTerm: string) => boolean,
  debounceMs: number = 200
) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, debounceMs);

  const filteredItems = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return items;
    }
    return items.filter(item => searchFn(item, debouncedSearchTerm.toLowerCase()));
  }, [items, debouncedSearchTerm, searchFn]);

  const updateSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    searchTerm,
    debouncedSearchTerm,
    filteredItems,
    updateSearch,
    clearSearch,
  };
}

