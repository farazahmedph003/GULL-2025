// Admin configuration

export const ADMIN_EMAILS = [
  'gullbaba@gmail.com'
];

export const DEFAULT_USER_PERMISSIONS = [
  'view_akra',
  'view_ring',
  'manage_entries',
] as const;

export const ADMIN_PERMISSIONS = [
  'view_dashboard',
  'view_akra',
  'view_ring',
  'view_filter_calculate',
  'view_advanced_filter',
  'manage_entries',
  'manage_projects',
  'export_data',
  'admin_panel',
  'manage_users',
  'view_reports',
  'manage_balance',
] as const;


export const DEFAULT_BALANCE = 1000; // New users start with 1000 balance

export const MIN_TOPUP_AMOUNT = 100; // Minimum 100 PKR
export const MAX_TOPUP_AMOUNT = 100000; // Maximum 100,000 PKR

export const isAdminEmail = (email: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

// Feature flags for admin control
export const FEATURE_FLAGS = {
  enableRegistration: true,
  enableEmailVerification: false,
  enableMaintenanceMode: false,
  enableAutoTopupApproval: false,
  enableAdvancedReports: true,
  enableBulkOperations: true,
  enableDataExport: true,
  enableDebugMode: false,
} as const;

// Admin roles
export const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
} as const;

// System settings interface
export interface SystemSettings {
  defaultBalance: number;
  minTopupAmount: number;
  maxTopupAmount: number;
  autoApproveTopups: boolean;
  maintenanceMode: boolean;
  featureFlags: typeof FEATURE_FLAGS;
}

// Default system settings
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  defaultBalance: DEFAULT_BALANCE,
  minTopupAmount: MIN_TOPUP_AMOUNT,
  maxTopupAmount: MAX_TOPUP_AMOUNT,
  autoApproveTopups: false,
  maintenanceMode: false,
  featureFlags: FEATURE_FLAGS,
};

// Utility functions to get current system settings
export const getCurrentSystemSettings = (): SystemSettings => {
  try {
    const saved = localStorage.getItem('admin-system-settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load system settings:', error);
  }
  return DEFAULT_SYSTEM_SETTINGS;
};


