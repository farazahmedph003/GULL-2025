import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRecentLogins, removeRecentLogin, type RecentLogin } from '../utils/recentLogins';
import { getCredential } from '../utils/savedCredentials';
import { useAuth } from '../contexts/AuthContext';

interface AccountSwitcherProps {
  onSwitch?: () => void;
}

const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ onSwitch }) => {
  const [recentLogins, setRecentLogins] = useState<RecentLogin[]>(getRecentLogins());
  const { user, signOut, signIn } = useAuth();
  const navigate = useNavigate();

  const handleRemove = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentLogin(email);
    setRecentLogins(getRecentLogins());
  };

  const handleSwitch = async (login: RecentLogin) => {
    if (login.email === user?.email) {
      return; // Already logged in as this user
    }

    // Check if we have saved credentials
    const emailKey = login.email || '';
    const usernameKey = emailKey.includes('@') ? emailKey.split('@')[0] : emailKey;
    const savedPassword = getCredential(emailKey) || getCredential(usernameKey);
    
    if (savedPassword && login.email) {
      try {
        // Auto-login with saved credentials
        await signOut();
        await signIn({ username: usernameKey || login.email, email: login.email, password: savedPassword });
        
        // Navigate to home
        navigate('/');
        onSwitch?.();
      } catch (error) {
        console.error('Auto-login failed:', error);
        alert(`Failed to switch to ${login.email}. Please try signing in manually.`);
      }
    } else {
      // No saved credentials, need to sign in manually
      alert(`Please sign in with ${login.email} to switch accounts.`);
      onSwitch?.();
    }
  };

  if (recentLogins.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Recent Accounts
        </h3>
        <span className="px-3 py-1 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full border border-blue-200 dark:border-blue-800">
          {recentLogins.length} saved
        </span>
      </div>

      <div className="space-y-3">
        {recentLogins.map((login) => (
          <div
            key={login.id}
            onClick={() => handleSwitch(login)}
            className={`
              group relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:shadow-lg hover:-translate-y-1 overflow-hidden
              ${
                login.email === user?.email
                  ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-700'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
              }
            `}
          >
            {/* Gradient overlay */}
            <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
              login.email === user?.email
                ? 'bg-gradient-to-r from-emerald-500/5 to-green-500/5'
                : 'bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5'
            }`}></div>
            
            {/* Avatar */}
            <div
              className={`
                relative z-10 flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg transition-transform duration-300 group-hover:scale-110
                ${
                  login.email === user?.email
                    ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white'
                    : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                }
              `}
            >
              {(login.displayName || login.email).charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="relative z-10 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {login.displayName || login.email.split('@')[0]}
                </p>
                {login.email === user?.email && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">
                {login.email}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {login.device}
              </p>
            </div>

            {/* Remove Button */}
            <button
              onClick={(e) => handleRemove(login.email, e)}
              className="relative z-10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:scale-110"
              title="Remove from recent"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Active Indicator */}
            {login.email === user?.email && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-green-600 rounded-l-xl" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center space-x-2">
        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Click any account to switch instantly
        </p>
      </div>
    </div>
  );
};

export default AccountSwitcher;

