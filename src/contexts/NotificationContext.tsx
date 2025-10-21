import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { pushNotificationService } from '../services/pushNotifications';
import { playNotificationByType } from '../utils/audioFeedback';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // Auto dismiss after this many milliseconds (0 = no auto dismiss)
  position?: 'top' | 'bottom';
  actions?: Array<{
    label: string;
    onClick: () => void;
    style?: 'primary' | 'secondary';
  }>;
  showAsPushNotification?: boolean; // Whether to also show as browser push notification
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => Promise<string>;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  showSuccess: (title: string, message?: string, options?: Partial<Notification>) => Promise<string>;
  showError: (title: string, message?: string, options?: Partial<Notification>) => Promise<string>;
  showWarning: (title: string, message?: string, options?: Partial<Notification>) => Promise<string>;
  showInfo: (title: string, message?: string, options?: Partial<Notification>) => Promise<string>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const addNotification = useCallback(async (notification: Omit<Notification, 'id'>): Promise<string> => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      id,
      duration: 5000, // Default 5 seconds
      position: 'top', // Default to top
      showAsPushNotification: false, // Default to false
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Play sound based on notification type
    try {
      await playNotificationByType(newNotification.type);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }

    // Show as browser push notification if requested and app is not visible
    if (newNotification.showAsPushNotification) {
      const isVisible = pushNotificationService.isAppVisible();
      const permission = pushNotificationService.getPermissionState();
      
      if (!isVisible && permission === 'granted') {
        try {
          await pushNotificationService.showNotification({
            title: newNotification.title,
            body: newNotification.message,
            tag: id,
            data: { notificationType: newNotification.type },
          });
        } catch (error) {
          console.error('Error showing push notification:', error);
        }
      }
    }

    // Auto dismiss if duration is set
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, [removeNotification]);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const showSuccess = useCallback(async (title: string, message?: string, options?: Partial<Notification>) => {
    return await addNotification({
      type: 'success',
      title,
      message,
      ...options,
    });
  }, [addNotification]);

  const showError = useCallback(async (title: string, message?: string, options?: Partial<Notification>) => {
    return await addNotification({
      type: 'error',
      title,
      message,
      duration: 0, // Errors don't auto-dismiss by default
      ...options,
    });
  }, [addNotification]);

  const showWarning = useCallback(async (title: string, message?: string, options?: Partial<Notification>) => {
    return await addNotification({
      type: 'warning',
      title,
      message,
      ...options,
    });
  }, [addNotification]);

  const showInfo = useCallback(async (title: string, message?: string, options?: Partial<Notification>) => {
    return await addNotification({
      type: 'info',
      title,
      message,
      ...options,
    });
  }, [addNotification]);

  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
