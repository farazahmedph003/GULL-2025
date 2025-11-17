import { useState, useEffect } from 'react';

/**
 * Debounce hook for optimizing search inputs and expensive operations
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms for fast response)
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

