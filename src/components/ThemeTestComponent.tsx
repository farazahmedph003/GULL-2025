import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';

const ThemeTestComponent: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();

  const testNotifications = async () => {
    await showSuccess('Light Mode Test', 'This is a success notification in light mode!');
    await showError('Error Test', 'This is an error notification in light mode!');
    await showWarning('Warning Test', 'This is a warning notification in light mode!');
    await showInfo('Info Test', 'This is an info notification in light mode!');
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Theme Test Component
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Current Theme:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              theme === 'light' 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}>
              {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </div>

          <button
            onClick={toggleTheme}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
          </button>

          <button
            onClick={testNotifications}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            Test Notifications
          </button>

          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Test Content
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              This is test content to verify that text is visible in both light and dark modes.
              The background should be white in light mode and dark in dark mode.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeTestComponent;
