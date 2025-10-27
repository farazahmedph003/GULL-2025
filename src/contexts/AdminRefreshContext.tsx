import React, { createContext, useContext, useState, useCallback } from 'react';

interface AdminRefreshContextType {
  setRefreshCallback: (callback: () => void) => void;
  triggerRefresh: () => void;
}

const AdminRefreshContext = createContext<AdminRefreshContextType | null>(null);

export const AdminRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshCallback, setRefreshCallbackState] = useState<(() => void) | null>(null);

  const setRefreshCallback = useCallback((callback: () => void) => {
    setRefreshCallbackState(() => callback);
  }, []);

  const triggerRefresh = useCallback(() => {
    if (refreshCallback) {
      console.log('🔄 Triggering silent refresh...');
      refreshCallback();
    } else {
      console.warn('⚠️ No refresh callback registered');
    }
  }, [refreshCallback]);

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

