import React, { useState } from 'react';
import { db } from '../services/database';
import { useNotifications } from '../contexts/NotificationContext';

interface SyncAuthUserModalProps {
  userId: string;
  username: string;
  email: string;
  onClose: () => void;
  onSuccess: () => void;
}

const SyncAuthUserModal: React.FC<SyncAuthUserModalProps> = ({
  userId,
  username,
  email,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useNotifications();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showError('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      showError('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      
      // Call a new database service function to sync the auth user
      await (db as any).syncAuthUser(userId, email, password);
      
      await showSuccess('Success', `Auth account created for ${username}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error syncing auth user:', error);
      showError('Error', error.message || 'Failed to create auth account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          🔐 Create Auth Account
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Create a Supabase Auth account for <strong>{username}</strong> ({email}).
          This will allow them to save transactions to the database.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Enter new password"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Confirm password"
              required
              minLength={6}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Auth Account'}
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          ⚠️ This will create a Supabase Auth account with the specified password.
          The user can then sign in and their transactions will be saved to the database.
        </p>
      </div>
    </div>
  );
};

export default SyncAuthUserModal;

