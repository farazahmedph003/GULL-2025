import { isAdminEmail } from '../config/admin';
import { useAuth } from '../contexts/AuthContext';

/**
 * Check if the current user is an admin
 * @returns boolean indicating if user is admin
 */
export const isAdmin = (): boolean => {
  const { user } = useAuth();
  if (!user?.email) return false;
  return isAdminEmail(user.email);
};

/**
 * Check if a given email belongs to an admin
 * @param email - email to check
 * @returns boolean indicating if email belongs to admin
 */
export const isAdminByEmail = (email: string | null): boolean => {
  if (!email) return false;
  return isAdminEmail(email);
};

/**
 * Get user role based on email
 * @param email - user email
 * @returns 'admin' | 'user'
 */
export const getUserRole = (email: string | null): 'admin' | 'user' => {
  return isAdminByEmail(email) ? 'admin' : 'user';
};
