export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'inactive';

export interface NeroUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  balance: number;
  spendingLimit: number;
  isOnline: boolean;
  status: UserStatus;
  isPartner?: boolean;
  avatar?: string;
  phone?: string;
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface UserStats {
  totalProjects: number;
  totalTransactions: number;
  totalSpent: number;
  lastActivity: string;
}

