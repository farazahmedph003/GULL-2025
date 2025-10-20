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

export const ENTRY_COST = {
  akra: 10, // 10 PKR per Akra entry
  ring: 20, // 20 PKR per Ring entry
};

export const DEFAULT_BALANCE = 0; // New users start with 0 balance

export const MIN_TOPUP_AMOUNT = 100; // Minimum 100 PKR
export const MAX_TOPUP_AMOUNT = 100000; // Maximum 100,000 PKR

export const isAdminEmail = (email: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

