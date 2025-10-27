import type { NeroUser, NeroProject, UserActivity, DashboardMetrics } from '../types';

// Mock Users
export const mockUsers: NeroUser[] = [
  {
    id: 'admin-1',
    email: 'gmpfaraz@gmail.com',
    displayName: 'Admin Faraz',
    role: 'admin',
    balance: 999999,
    spendingLimit: 999999,
    isOnline: true,
    status: 'active',
    phone: '+92 300 1234567',
    lastLoginAt: new Date().toISOString(),
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-1',
    email: 'ali.khan@example.com',
    displayName: 'Ali Khan',
    role: 'user',
    balance: 5000,
    spendingLimit: 10000,
    isOnline: true,
    status: 'active',
    isPartner: true,
    phone: '+92 301 1234567',
    lastLoginAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-2',
    email: 'sara.ahmed@example.com',
    displayName: 'Sara Ahmed',
    role: 'user',
    balance: 1200,
    spendingLimit: 5000,
    isOnline: false,
    status: 'active',
    phone: '+92 302 1234567',
    lastLoginAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-3',
    email: 'ahmed.raza@example.com',
    displayName: 'Ahmed Raza',
    role: 'user',
    balance: 0,
    spendingLimit: 3000,
    isOnline: false,
    status: 'inactive',
    phone: '+92 303 1234567',
    lastLoginAt: new Date(Date.now() - 259200000).toISOString(),
    createdAt: '2024-02-20T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-4',
    email: 'fatima.malik@example.com',
    displayName: 'Fatima Malik',
    role: 'user',
    balance: 7500,
    spendingLimit: 15000,
    isOnline: true,
    status: 'active',
    phone: '+92 304 1234567',
    lastLoginAt: new Date(Date.now() - 1800000).toISOString(),
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
];

// Mock Projects
export const mockProjects: NeroProject[] = [
  {
    id: 'proj-1',
    userId: 'user-1',
    name: 'Morning Akra Session',
    type: 'akra',
    status: 'active',
    date: '2024-03-15',
    totalFirst: 15000,
    totalSecond: 8500,
    entryCount: 45,
    uniqueNumbers: 32,
    description: 'Morning session calculations',
    createdAt: '2024-03-15T08:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'proj-2',
    userId: 'user-1',
    name: 'Evening Ring Game',
    type: 'ring',
    status: 'active',
    date: '2024-03-15',
    totalFirst: 25000,
    totalSecond: 12000,
    entryCount: 78,
    uniqueNumbers: 65,
    description: 'Evening ring calculations',
    createdAt: '2024-03-15T18:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'proj-3',
    userId: 'user-2',
    name: 'Weekly Akra',
    type: 'akra',
    status: 'completed',
    date: '2024-03-10',
    totalFirst: 8000,
    totalSecond: 4500,
    entryCount: 28,
    uniqueNumbers: 22,
    description: 'Weekly calculations',
    createdAt: '2024-03-10T10:00:00Z',
    updatedAt: '2024-03-11T10:00:00Z',
  },
  {
    id: 'proj-4',
    userId: 'user-4',
    name: 'Special Ring Event',
    type: 'ring',
    status: 'active',
    date: '2024-03-14',
    totalFirst: 45000,
    totalSecond: 28000,
    entryCount: 120,
    uniqueNumbers: 98,
    description: 'Special event calculations',
    createdAt: '2024-03-14T15:00:00Z',
    updatedAt: new Date().toISOString(),
  },
];

// Mock Activities
export const mockActivities: UserActivity[] = [
  {
    id: 'act-1',
    userId: 'user-1',
    action: 'project_created',
    description: 'Created new Akra project "Morning Akra Session"',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'act-2',
    userId: 'user-4',
    action: 'transaction_added',
    description: 'Added 15 new entries to Ring project',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'act-3',
    userId: 'admin-1',
    action: 'user_top_up',
    description: 'Topped up PKR 5000 for Ali Khan',
    timestamp: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: 'act-4',
    userId: 'user-2',
    action: 'project_exported',
    description: 'Exported project data to Excel',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'act-5',
    userId: 'user-1',
    action: 'login',
    description: 'User logged in',
    timestamp: new Date(Date.now() - 18000000).toISOString(),
  },
];

// Mock Dashboard Metrics
export const mockDashboardMetrics: DashboardMetrics = {
  users: {
    total: 5,
    active: 4,
    inactive: 1,
    online: 3,
  },
  projects: {
    total: 4,
    akra: 2,
    ring: 2,
    activeToday: 3,
  },
  financial: {
    totalRevenue: 125000,
    todayRevenue: 23500,
    averagePerUser: 25000,
  },
  activity: {
    transactionsToday: 145,
    newUsersToday: 2,
    topUpsToday: 3,
  },
};

// Helper functions
export const getUserById = (id: string): NeroUser | undefined => {
  return mockUsers.find(user => user.id === id);
};

export const getUserProjects = (userId: string): NeroProject[] => {
  return mockProjects.filter(project => project.userId === userId);
};

export const getOnlineUsers = (): NeroUser[] => {
  return mockUsers.filter(user => user.isOnline);
};

export const getActiveUsers = (): NeroUser[] => {
  return mockUsers.filter(user => user.status === 'active');
};

export const getUserActivities = (userId: string): UserActivity[] => {
  return mockActivities.filter(activity => activity.userId === userId);
};

export const getRecentActivities = (limit: number = 10): UserActivity[] => {
  return mockActivities.slice(0, limit);
};

