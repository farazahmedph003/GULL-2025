import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { pushNotificationService } from '../services/pushNotifications';
import { db } from '../services/database';
import type { PushNotificationState, NotificationPermission, PushNotificationEvent } from '../types';
import { useNotifications } from './NotificationContext';

interface PushNotificationContextType {
  state: PushNotificationState;
  requestPermission: () => Promise<NotificationPermission>;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<void>;
  showNotification: (event: PushNotificationEvent) => Promise<void>;
}

export const PushNotificationContext = createContext<PushNotificationContextType | undefined>(undefined);

export const usePushNotifications = () => {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error('usePushNotifications must be used within a PushNotificationProvider');
  }
  return context;
};

interface PushNotificationProviderProps {
  children: ReactNode;
}

export const PushNotificationProvider: React.FC<PushNotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    enabled: false,
    supported: false,
  });

  const [subscriptions, setSubscriptions] = useState<(() => void)[]>([]);

  // Initialize push notification state
  useEffect(() => {
    const supported = pushNotificationService.isNotificationSupported();
    const permission = pushNotificationService.getPermissionState();
    
    setState(prev => ({
      ...prev,
      supported,
      permission,
    }));

    // Register service worker
    pushNotificationService.registerServiceWorker();
  }, []);

  // Load user notification preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;

      try {
        const preferences = await db.getUserPreferences(user.id);
        const enabled = preferences.notificationsEnabled as boolean ?? false;
        
        setState(prev => ({
          ...prev,
          enabled: enabled && prev.permission === 'granted',
        }));
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    };

    loadPreferences();
  }, [user]);

  const handleRealtimeEvent = useCallback(async (event: PushNotificationEvent) => {
    // Map push notification event type to in-app notification type
    const getNotificationType = (eventType: string) => {
      switch (eventType) {
        case 'balance_change':
          return 'info';
        case 'transaction_update':
          return 'info';
        case 'admin_action':
          return 'warning';
        case 'system_event':
          return 'info';
        default:
          return 'info';
      }
    };

    // Always show in-app notification first
    await addNotification({
      type: getNotificationType(event.type),
      title: event.title,
      message: event.message,
      duration: event.type === 'admin_action' || event.type === 'system_event' ? 0 : 5000, // Admin/system events don't auto-dismiss
    });

    // Also show browser notification if app is not visible and permissions are granted
    if (!pushNotificationService.isAppVisible() && state.permission === 'granted') {
      const notificationOptions = {
        title: event.title,
        body: event.message,
        tag: event.type,
        data: {
          route: event.data?.route || '/',
          type: event.type,
          timestamp: event.timestamp,
        },
        requireInteraction: event.type === 'admin_action' || event.type === 'system_event',
      };

      await pushNotificationService.showNotification(notificationOptions);
    }
  }, [addNotification, state.permission]);

  // Set up realtime subscriptions when user is authenticated and notifications are enabled
  useEffect(() => {
    if (!user || state.permission !== 'granted' || !state.enabled) {
      // Clean up existing subscriptions
      subscriptions.forEach(unsubscribe => unsubscribe());
      setSubscriptions([]);
      return;
    }

    const newSubscriptions: (() => void)[] = [];

    // Subscribe to balance changes
    const balanceUnsubscribe = db.subscribeToUserBalance(user.id, (_payload) => {
      handleRealtimeEvent({
        type: 'balance_change',
        title: 'Balance Updated',
        message: 'Your balance has been updated',
        data: { userId: user.id },
        timestamp: new Date().toISOString(),
      });
    });
    newSubscriptions.push(balanceUnsubscribe);

    // Subscribe to transaction updates from other devices
    const transactionsUnsubscribe = db.subscribeToUserTransactions(user.id, (payload) => {
      const event = payload as any;
      let title = 'Transaction Updated';
      let message = 'Your transactions have been updated';

      if (event.eventType) {
        switch (event.eventType) {
          case 'INSERT':
            title = 'New Transaction';
            message = 'A new transaction has been added';
            break;
          case 'UPDATE':
            title = 'Transaction Modified';
            message = 'A transaction has been updated';
            break;
          case 'DELETE':
            title = 'Transaction Removed';
            message = 'A transaction has been deleted';
            break;
        }
      }

      handleRealtimeEvent({
        type: 'transaction_update',
        title,
        message,
        data: { userId: user.id, payload: event },
        timestamp: new Date().toISOString(),
      });
    });
    newSubscriptions.push(transactionsUnsubscribe);

    // Subscribe to system events
    const systemUnsubscribe = db.subscribeToSystemEvents(user.id, (payload) => {
      const event = payload as any;
      handleRealtimeEvent({
        type: 'system_event',
        title: event.title || 'System Notification',
        message: event.message || 'You have a new system notification',
        data: { userId: user.id, payload: event },
        timestamp: new Date().toISOString(),
      });
    });
    newSubscriptions.push(systemUnsubscribe);

    setSubscriptions(newSubscriptions);

    // Cleanup function
    return () => {
      newSubscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [user, state.permission, state.enabled, handleRealtimeEvent]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    try {
      const permission = await pushNotificationService.requestPermission();
      
      setState(prev => ({
        ...prev,
        permission,
        enabled: permission === 'granted' && prev.enabled,
      }));

      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, []);

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      // Request permission first
      const permission = await requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      // Save preference to database
      const preferences = await db.getUserPreferences(user.id);
      await db.setUserPreferences(user.id, {
        ...preferences,
        notificationsEnabled: true,
      });

      setState(prev => ({
        ...prev,
        enabled: true,
      }));

      return true;
    } catch (error) {
      console.error('Error enabling notifications:', error);
      return false;
    }
  }, [user, requestPermission]);

  const disableNotifications = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      // Save preference to database
      const preferences = await db.getUserPreferences(user.id);
      await db.setUserPreferences(user.id, {
        ...preferences,
        notificationsEnabled: false,
      });

      setState(prev => ({
        ...prev,
        enabled: false,
      }));
    } catch (error) {
      console.error('Error disabling notifications:', error);
    }
  }, [user]);

  const showNotification = useCallback(async (event: PushNotificationEvent): Promise<void> => {
    await handleRealtimeEvent(event);
  }, [handleRealtimeEvent]);

  const value: PushNotificationContextType = {
    state,
    requestPermission,
    enableNotifications,
    disableNotifications,
    showNotification,
  };

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
};
