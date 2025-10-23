import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getRecentLogins, removeRecentLogin, type RecentLogin } from '../utils/recentLogins';
import { getCredential } from '../utils/savedCredentials';

const ProfileDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentLogins, setRecentLogins] = useState<RecentLogin[]>(getRecentLogins());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, signOut, signIn } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter out current user from recent logins
  const otherAccounts = recentLogins.filter(login => login.email !== user?.email);

  const handleSwitchAccount = async (login: RecentLogin) => {
    setIsOpen(false);
    
    // Ask for confirmation
    if (!confirm(`Switch to account: ${login.email}?`)) {
      return;
    }
    
    // Check if we have saved credentials
    // Try retrieving by email or username alias (left side of email)
    const emailKey = login.email || '';
    const usernameKey = emailKey.includes('@') ? emailKey.split('@')[0] : emailKey;
    const savedPassword = getCredential(emailKey) || getCredential(usernameKey);
    
    if (savedPassword && login.email) {
      try {
        // Auto-login with saved credentials
        await signOut();
        // Support username or email sign-in
        await signIn({ username: usernameKey || login.email, email: login.email, password: savedPassword });
        
        // Navigate to home
        navigate('/');
      } catch (error) {
        console.error('Auto-login failed:', error);
        // Fall back to manual login
        await signOut();
        navigate('/welcome', { state: { switchTo: login.email } });
        setTimeout(() => {
          alert(`Please enter your password to sign in as ${login.email}`);
        }, 300);
      }
    } else {
      // No saved credentials, ask for password
      await signOut();
      navigate('/welcome', { state: { switchTo: login.email } });
      setTimeout(() => {
        alert(`Please enter your password to sign in as ${login.email}`);
      }, 300);
    }
  };

  const handleRemoveAccount = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentLogin(email);
    setRecentLogins(getRecentLogins());
  };

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      await signOut();
      navigate('/welcome');
    }
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all hover:shadow-md"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
          {(user.displayName || user.email || 'A').charAt(0).toUpperCase()}
        </div>
        <div className="hidden md:block text-left">
          <div className="text-sm font-semibold leading-tight">
            {user.displayName || user.email?.split('@')[0] || 'User'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
            {user.email || 'Guest'}
          </div>
        </div>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden z-50 transform transition-all duration-300 ease-out"
             style={{
               animation: 'dropdownSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
               transformOrigin: 'top right'
             }}>
          <style>
            {`
              @keyframes dropdownSlide {
                0% {
                  opacity: 0;
                  transform: translateY(-10px) scale(0.95);
                }
                100% {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
            `}
          </style>
          {/* Current Account */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {(user.displayName || user.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                  {user.displayName || user.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {user.email || 'Guest Account'}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* My Profile Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              navigate('/profile');
            }}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">My Profile</span>
          </button>

          {/* Theme controls removed as requested */}

          {/* Other Accounts */}
          {otherAccounts.length > 0 && (
            <>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-b border-gray-200 dark:border-gray-700">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Switch Account
                </div>
              </div>
              
              <div className="max-h-48 overflow-y-auto">
                {otherAccounts.map((login) => (
                  <button
                    key={login.id}
                    onClick={() => handleSwitchAccount(login)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow">
                        {(login.displayName || login.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {login.displayName || login.email.split('@')[0]}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {login.email}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleRemoveAccount(login.email, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3 border-t border-gray-200 dark:border-gray-700"
          >
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;

