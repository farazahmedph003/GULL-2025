import React, { createContext, useContext, useRef, useCallback } from 'react';

interface AdminRefreshContextType {
  setRefreshCallback: (callback: () => void | Promise<void>) => void;
  triggerRefresh: () => void;
}

const AdminRefreshContext = createContext<AdminRefreshContextType | null>(null);

export const AdminRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const refreshCallbackRef = useRef<(() => void | Promise<void>) | null>(null);

  const setRefreshCallback = useCallback((callback: () => void | Promise<void>) => {
    console.log('📝 Registering refresh callback');
    refreshCallbackRef.current = callback;
  }, []);

  const triggerRefresh = useCallback(() => {
    if (refreshCallbackRef.current) {
      console.log('🔄 Triggering silent refresh...');
      const result = refreshCallbackRef.current();
      if (result instanceof Promise) {
        result.catch(error => {
          console.error('Error during refresh:', error);
        });
      }
    } else {
      console.warn('⚠️ No refresh callback registered');
    }
  }, []);

  return (
    <AdminRefreshContext.Provider value={{ setRefreshCallback, triggerRefresh }}>
      {children}
    </AdminRefreshContext.Provider>
  );
};

export const useAdminRefresh = () => {
  const context = useContext(AdminRefreshContext);
  if (!context) {
    throw new Error('useAdminRefresh must be used within AdminRefreshProvider');
  }
  return context;
};

