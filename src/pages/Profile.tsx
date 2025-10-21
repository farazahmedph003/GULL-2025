import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';
import LoadingSpinner from '../components/LoadingSpinner';
import AccountSwitcher from '../components/AccountSwitcher';
import { formatDate } from '../utils/helpers';
import { isOfflineMode } from '../lib/supabase';

const Profile: React.FC = () => {
  const { user, updateProfile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError('');
    setUpdateSuccess(false);

    if (!displayName.trim()) {
      setUpdateError('Display name cannot be empty');
      return;
    }

    try {
      await updateProfile(displayName.trim());
      setIsEditing(false);
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      try {
        await signOut();
        navigate('/welcome');
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }
  };


  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BackButton />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                User Profile
              </h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                Profile Information
              </h2>

              {updateSuccess && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    ✓ Profile updated successfully!
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Display Name
                  </label>
                  {isEditing ? (
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="input-field"
                        placeholder="Enter display name"
                        disabled={loading}
                      />
                      {updateError && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {updateError}
                        </p>
                      )}
                      <div className="flex space-x-3">
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={loading}
                        >
                          {loading ? <LoadingSpinner size="sm" /> : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditing(false);
                            setDisplayName(user.displayName || '');
                            setUpdateError('');
                          }}
                          className="btn-secondary"
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-lg text-gray-900 dark:text-gray-100">
                        {user.displayName || '(Not set)'}
                      </p>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="btn-secondary text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <p className="text-lg text-gray-900 dark:text-gray-100">
                    {user.email || '(Anonymous User)'}
                  </p>
                </div>

                {/* Account Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account Type
                  </label>
                  <div className="flex items-center space-x-2">
                    {user.isAnonymous ? (
                      <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-sm font-medium">
                        👤 Guest Account
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
                        ✓ Registered Account
                      </span>
                    )}
                    {isOfflineMode() && (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                        🔒 Offline Mode
                      </span>
                    )}
                  </div>
                </div>

                {/* Account Created */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account Created
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {formatDate(user.createdAt)}
                  </p>
                </div>

                {/* Last Login */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last Login
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {formatDate(user.lastLoginAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Settings Link */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    App Settings
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Customize theme, sounds, notifications, and more
                  </p>
                </div>
                <button
                  onClick={() => navigate('/settings')}
                  className="btn-primary"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Open Settings
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="card border-2 border-red-200 dark:border-red-800">
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
                Danger Zone
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Signing out will log you out of your account. Your projects will remain saved.
              </p>
              <button
                onClick={handleSignOut}
                className="btn-danger"
                disabled={loading}
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Sign Out'}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Accounts Switcher */}
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Saved Accounts
              </h3>
              <AccountSwitcher />
            </div>

            {/* Account Stats */}
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Account Info
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">User ID</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                    {user.id.substring(0, 8)}...
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Info Card */}
            {user.isAnonymous && (
              <div className="card bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-3">
                  ⚠️ Guest Account
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                  Your data is stored locally on this device only.
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  To sync across devices, create a registered account.
                </p>
              </div>
            )}

            {isOfflineMode() && (
              <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-3">
                  🔒 Offline Mode
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Running in offline mode. All data is stored locally on your device.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

