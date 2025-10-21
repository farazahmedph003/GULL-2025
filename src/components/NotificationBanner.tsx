import React, { useState, useEffect, useContext } from 'react';
import { PushNotificationContext } from '../contexts/PushNotificationContext';

const NotificationBanner: React.FC = () => {
  // Use useContext directly instead of the hook to handle potential missing context
  const pushNotificationContext = useContext(PushNotificationContext);
  
  // If context is not available, don't render anything
  if (!pushNotificationContext) {
    return null;
  }

  const { state, enableNotifications } = pushNotificationContext;
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if user has previously dismissed this banner
  useEffect(() => {
    const dismissed = localStorage.getItem('notification-banner-dismissed');
    setIsDismissed(dismissed === 'true');
  }, []);

  // Don't show banner if:
  // - Not supported
  // - Permission already granted
  // - User dismissed it
  // - User explicitly denied (show elsewhere)
  if (!state.supported || 
      state.permission === 'granted' || 
      isDismissed || 
      state.permission === 'denied') {
    return null;
  }

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      const success = await enableNotifications();
      if (success) {
        setIsDismissed(true);
        localStorage.setItem('notification-banner-dismissed', 'true');
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('notification-banner-dismissed', 'true');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 dark:bg-blue-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Enable notifications to stay updated on balance changes and transactions
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={handleEnableNotifications}
              disabled={isLoading}
              className="bg-white text-blue-600 hover:bg-gray-100 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Enabling...' : 'Enable'}
            </button>
            <button
              onClick={handleDismiss}
              className="text-white hover:text-gray-200 p-1"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationBanner;
