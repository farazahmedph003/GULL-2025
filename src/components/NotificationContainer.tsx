import React from 'react';
import type { Notification } from '../contexts/NotificationContext';

interface NotificationItemProps {
  notification: Notification;
  onClose: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return (
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };


  const getTextColor = () => {
    switch (notification.type) {
      case 'success':
        return 'text-green-800 dark:text-green-200';
      case 'error':
        return 'text-red-800 dark:text-red-200';
      case 'warning':
        return 'text-yellow-800 dark:text-yellow-200';
      case 'info':
        return 'text-blue-800 dark:text-blue-200';
      default:
        return 'text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className={`relative w-full backdrop-blur-lg bg-white/90 dark:bg-gray-800/90 border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-2xl p-4 sm:p-5 transform transition-all duration-500 ease-out`}
         style={{
           animation: 'slideDownFromTop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
           boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(255, 255, 255, 0.05)'
         }}>
      {/* Premium gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl pointer-events-none"></div>
      
      <div className="relative flex items-start">
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
            notification.type === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
            notification.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
            'bg-blue-100 dark:bg-blue-900/30'
          }`}>
            <div className="w-5 h-5">
              {getIcon()}
            </div>
          </div>
        </div>
        <div className="ml-3 sm:ml-4 flex-1 min-w-0">
          <h3 className={`text-sm sm:text-base font-bold ${getTextColor()} break-words leading-tight`}>
            {notification.title}
          </h3>
          {notification.message && (
            <p className={`mt-2 text-xs sm:text-sm ${getTextColor()} opacity-80 break-words leading-relaxed`}>
              {notification.message}
            </p>
          )}
          {notification.actions && notification.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                    action.style === 'primary'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-2 sm:ml-4 flex-shrink-0">
          <button
            onClick={() => onClose(notification.id)}
            className={`inline-flex w-7 h-7 rounded-full items-center justify-center ${getTextColor()} hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 hover:scale-110`}
          >
            <span className="sr-only">Close</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

interface NotificationContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({ notifications, onClose }) => {
  const topNotifications = notifications.filter(n => n.position === 'top' || !n.position);
  const bottomNotifications = notifications.filter(n => n.position === 'bottom');

  return (
    <>
      {/* Top Notifications - Dropdown from top */}
      {topNotifications.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 space-y-3 max-w-md mx-auto">
          <style>
            {`
              @keyframes slideDownFromTop {
                0% {
                  opacity: 0;
                  transform: translateY(-100%);
                }
                100% {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}
          </style>
          {topNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClose={onClose}
            />
          ))}
        </div>
      )}

      {/* Bottom Notifications - Mobile & Desktop Responsive */}
      {bottomNotifications.length > 0 && (
        <div className="fixed bottom-2 right-2 left-2 sm:bottom-4 sm:right-4 sm:left-auto z-50 space-y-2 max-w-sm sm:max-w-md">
          {bottomNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClose={onClose}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default NotificationContainer;
