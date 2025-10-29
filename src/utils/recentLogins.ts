import type { User } from '../types/auth';

const RECENT_LOGINS_KEY = 'gull-recent-logins';
const MAX_RECENT_LOGINS = 5;

export interface RecentLogin {
  id: string;
  email: string;
  username?: string; // Added to support credential lookup
  displayName: string | null;
  lastLoginAt: string;
  device: string;
}

export const saveRecentLogin = (user: User): void => {
  try {
    const recent = getRecentLogins();
    
    // Check if user already exists
    const existingIndex = recent.findIndex(r => r.email === user.email);
    
    const device = `${navigator.platform} - ${navigator.userAgent.split('(')[1]?.split(')')[0] || 'Unknown'}`;
    
    const loginEntry: RecentLogin = {
      id: user.id,
      email: user.email || 'unknown',
      username: user.username || (user.email?.split('@')[0]), // Store username for credential lookup
      displayName: user.displayName,
      lastLoginAt: new Date().toISOString(),
      device,
    };
    
    if (existingIndex >= 0) {
      // Update existing entry
      recent[existingIndex] = loginEntry;
    } else {
      // Add new entry
      recent.unshift(loginEntry);
    }
    
    // Keep only MAX_RECENT_LOGINS
    const trimmed = recent.slice(0, MAX_RECENT_LOGINS);
    
    localStorage.setItem(RECENT_LOGINS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save recent login:', error);
  }
};

export const getRecentLogins = (): RecentLogin[] => {
  try {
    const stored = localStorage.getItem(RECENT_LOGINS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to get recent logins:', error);
    return [];
  }
};

export const removeRecentLogin = (email: string): void => {
  try {
    const recent = getRecentLogins();
    const filtered = recent.filter(r => r.email !== email);
    localStorage.setItem(RECENT_LOGINS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove recent login:', error);
  }
};

export const clearRecentLogins = (): void => {
  try {
    localStorage.removeItem(RECENT_LOGINS_KEY);
  } catch (error) {
    console.error('Failed to clear recent logins:', error);
  }
};

