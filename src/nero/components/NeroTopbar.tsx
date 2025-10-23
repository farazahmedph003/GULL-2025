import React, { useState, useRef, useEffect } from 'react';
import { useNeroAuth } from '../contexts/NeroAuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface NeroTopbarProps {
  sidebarCollapsed: boolean;
}

const NeroTopbar: React.FC<NeroTopbarProps> = ({ sidebarCollapsed }) => {
  const { user, logout, isImpersonating, exitImpersonation, originalUser } = useNeroAuth();
  const { theme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-30 transition-all duration-300 ${
        sidebarCollapsed ? 'left-20' : 'left-64'
      }`}
    >
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left side - Search or breadcrumbs */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              className="w-64 px-4 py-2 pl-10 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-4">
          {/* Impersonation Banner */}
          {isImpersonating && (
            <div className="flex items-center gap-3 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <span className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                Viewing as: {user?.displayName}
              </span>
              <button
                onClick={exitImpersonation}
                className="text-xs font-semibold px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
              >
                Exit to {originalUser?.displayName}
              </button>
            </div>
          )}

          {/* Theme toggle removed */}

          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {user?.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {user?.displayName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.role === 'admin' ? 'Administrator' : 'User'}
                </p>
              </div>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 nero-animate-slide-in">
                <div className="p-4 border-b border-gray-200 dark:border-slate-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.displayName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                  {user?.role === 'user' && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Balance:</span>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        PKR {user?.balance.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    Profile Settings
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    Account Settings
                  </button>
                </div>
                <div className="p-2 border-t border-gray-200 dark:border-slate-700">
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default NeroTopbar;

