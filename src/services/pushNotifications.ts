import type { NotificationPermission } from '../types';

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

class PushNotificationService {
  private permission: NotificationPermission = 'default';
  private isSupported: boolean = false;

  constructor() {
    this.checkSupport();
    this.updatePermissionState();
  }

  private checkSupport(): void {
    this.isSupported = 
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
  }

  private updatePermissionState(): void {
    if (!this.isSupported || !('Notification' in window)) {
      this.permission = 'denied';
      return;
    }

    this.permission = Notification.permission as NotificationPermission;
  }

  /**
   * Check if push notifications are supported by the browser
   */
  isNotificationSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Get current permission state
   */
  getPermissionState(): NotificationPermission {
    this.updatePermissionState();
    return this.permission;
  }

  /**
   * Request notification permission from the user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported in this browser');
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    try {
      this.permission = await Notification.requestPermission() as NotificationPermission;
      return this.permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      this.permission = 'denied';
      return 'denied';
    }
  }

  /**
   * Show a browser notification
   */
  async showNotification(options: NotificationOptions): Promise<void> {
    if (!this.isSupported) {
      console.warn('Push notifications not supported');
      return;
    }

    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      const notificationOptions: any = {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
      };

      // Only add actions if supported (not all browsers support this)
      if (options.actions && options.actions.length > 0) {
        notificationOptions.actions = options.actions;
      }

      const notification = new Notification(options.title, notificationOptions);

      // Handle notification click
      notification.onclick = (event) => {
        event.preventDefault();
        notification.close();

        // Focus the window if it exists
        if (window.parent !== window) {
          // In iframe
          window.parent.focus();
        } else {
          // In main window
          window.focus();
        }

        // Navigate to the app if we have route data
        if (options.data?.route) {
          window.location.href = options.data.route;
        }
      };

      // Auto close after 5 seconds for non-interactive notifications
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Register service worker for push notifications
   */
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  /**
   * Check if the app is currently visible using Page Visibility API
   */
  isAppVisible(): boolean {
    return document.visibilityState === 'visible';
  }

  /**
   * Set up visibility change listener
   */
  onVisibilityChange(callback: (isVisible: boolean) => void): () => void {
    const handleVisibilityChange = () => {
      callback(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
