import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';

const NotificationDemo: React.FC = () => {
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();

  const handleSuccess = async () => {
    await showSuccess(
      'Operation Successful',
      'Your action was completed successfully!',
      { position: 'top', duration: 3000 }
    );
  };

  const handleError = async () => {
    await showError(
      'Operation Failed',
      'Something went wrong. Please try again.',
      { position: 'top' }
    );
  };

  const handleWarning = async () => {
    await showWarning(
      'Warning',
      'This action may have unintended consequences.',
      { position: 'bottom', duration: 5000 }
    );
  };

  const handleInfo = async () => {
    await showInfo(
      'Information',
      'Here is some useful information for you.',
      { position: 'bottom', duration: 4000 }
    );
  };

  const handleWithActions = async () => {
    await showSuccess(
      'Action Required',
      'Please confirm your action to proceed.',
      {
        position: 'top',
        duration: 0, // Don't auto-dismiss
        actions: [
          {
            label: 'Confirm',
            onClick: () => {
              console.log('Confirmed!');
            },
            style: 'primary'
          },
          {
            label: 'Cancel',
            onClick: () => {
              console.log('Cancelled!');
            },
            style: 'secondary'
          }
        ]
      }
    );
  };

  return (
    <div className="p-8 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Notification System Demo
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={handleSuccess}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
        >
          Success Notification
        </button>
        
        <button
          onClick={handleError}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Error Notification
        </button>
        
        <button
          onClick={handleWarning}
          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
        >
          Warning Notification
        </button>
        
        <button
          onClick={handleInfo}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          Info Notification
        </button>
      </div>
      
      <div className="mt-6">
        <button
          onClick={handleWithActions}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
        >
          Notification with Actions
        </button>
      </div>
      
      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Usage Examples:</h3>
        <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">
{`// Success notification
showSuccess('Success', 'Operation completed!');

// Error notification (no auto-dismiss)
showError('Error', 'Something went wrong!');

// Warning with custom position and duration
showWarning('Warning', 'Be careful!', { 
  position: 'bottom', 
  duration: 5000 
});

// Info with actions
showInfo('Action Required', 'Please confirm', {
  duration: 0,
  actions: [
    { label: 'Confirm', onClick: () => {}, style: 'primary' },
    { label: 'Cancel', onClick: () => {}, style: 'secondary' }
  ]
});`}
        </pre>
      </div>
    </div>
  );
};

export default NotificationDemo;
