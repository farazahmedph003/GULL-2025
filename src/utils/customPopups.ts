import type { NotificationType } from '../contexts/NotificationContext';

// This utility provides custom alert and confirm functions that can be used
// throughout the application to replace browser popups

export interface CustomAlertOptions {
  type?: NotificationType;
  position?: 'top' | 'bottom';
  duration?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
    style?: 'primary' | 'secondary';
  }>;
}

export interface CustomConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

// Global notification functions (these will be set by the app)
// Note: These are now async functions but we maintain backward compatibility
let globalShowSuccess: (title: string, message?: string, options?: CustomAlertOptions) => string | Promise<string>;
let globalShowError: (title: string, message?: string, options?: CustomAlertOptions) => string | Promise<string>;
let globalShowWarning: (title: string, message?: string, options?: CustomAlertOptions) => string | Promise<string>;
let globalShowInfo: (title: string, message?: string, options?: CustomAlertOptions) => string | Promise<string>;
let globalConfirm: (message: string, options?: CustomConfirmOptions) => Promise<boolean>;

// Initialize the global functions
export const initializeCustomPopups = (notificationFunctions: {
  showSuccess: typeof globalShowSuccess;
  showError: typeof globalShowError;
  showWarning: typeof globalShowWarning;
  showInfo: typeof globalShowInfo;
  confirm: typeof globalConfirm;
}) => {
  globalShowSuccess = notificationFunctions.showSuccess;
  globalShowError = notificationFunctions.showError;
  globalShowWarning = notificationFunctions.showWarning;
  globalShowInfo = notificationFunctions.showInfo;
  globalConfirm = notificationFunctions.confirm;
};

// Custom alert function
export const customAlert = (message: string, options: CustomAlertOptions = {}) => {
  const { type = 'info', position = 'top', duration = 5000 } = options;
  
  switch (type) {
    case 'success':
      return globalShowSuccess('Success', message, { position, duration });
    case 'error':
      return globalShowError('Error', message, { position, duration });
    case 'warning':
      return globalShowWarning('Warning', message, { position, duration });
    case 'info':
    default:
      return globalShowInfo('Information', message, { position, duration });
  }
};

// Custom confirm function
export const customConfirm = (message: string, options: CustomConfirmOptions = {}) => {
  return globalConfirm(message, options);
};

// Convenience functions for different types of alerts
export const customAlertSuccess = (message: string, options?: CustomAlertOptions) => {
  return customAlert(message, { ...options, type: 'success' });
};

export const customAlertError = (message: string, options?: CustomAlertOptions) => {
  return customAlert(message, { ...options, type: 'error' });
};

export const customAlertWarning = (message: string, options?: CustomAlertOptions) => {
  return customAlert(message, { ...options, type: 'warning' });
};

export const customAlertInfo = (message: string, options?: CustomAlertOptions) => {
  return customAlert(message, { ...options, type: 'info' });
};

// Convenience functions for different types of confirms
export const customConfirmDanger = (message: string, options?: CustomConfirmOptions) => {
  return customConfirm(message, { ...options, type: 'danger' });
};

export const customConfirmWarning = (message: string, options?: CustomConfirmOptions) => {
  return customConfirm(message, { ...options, type: 'warning' });
};

export const customConfirmInfo = (message: string, options?: CustomConfirmOptions) => {
  return customConfirm(message, { ...options, type: 'info' });
};
