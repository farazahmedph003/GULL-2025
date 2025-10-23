import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AccountSwitcher from '../components/AccountSwitcher';
import { isOfflineMode } from '../lib/supabase';

const Welcome: React.FC = () => {
  const location = useLocation();
  const [mode, setMode] = useState<'welcome' | 'signin'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();
  
  const { signIn, loading, error, clearError } = useAuth();

  // Check if switching to another account
  useEffect(() => {
    const state = location.state as { switchTo?: string } | null;
    if (state?.switchTo) {
      setMode('signin');
      setUsername(state.switchTo);
      // Clear the state
      navigate('/welcome', { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    clearError();

    if (!username || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    try {
      await signIn({ username, password });
      navigate('/');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign in failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-3 sm:p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-2">GULL</h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-700 dark:text-gray-300">Accounting Management System</p>
          {isOfflineMode() && (
            <div className="mt-3 sm:mt-4 inline-block px-3 sm:px-4 py-2 bg-yellow-500/20 border border-yellow-400 rounded-lg">
              <p className="text-xs sm:text-sm text-yellow-200">
                🔒 Offline Mode - Data stored locally
              </p>
            </div>
          )}
        </div>

        {/* Main Card */}
        <div className="relative bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/20 via-blue-50/10 to-indigo-50/20 dark:from-purple-900/10 dark:via-blue-900/5 dark:to-indigo-900/10"></div>
          
          {/* Sign In Form */}
          {mode === 'signin' && (
            <div className="relative z-10 p-6 sm:p-8">
              <div className="mb-4 sm:mb-6">
                <button
                  onClick={() => {
                    setMode('welcome');
                    setFormError('');
                    clearError();
                  }}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center text-sm sm:text-base"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">
                Sign In
              </h2>

              <form onSubmit={handleSignIn} className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username or Email
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="your_username or your@email.com"
                    disabled={loading}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="••••••••"
                    disabled={loading}
                    autoComplete="current-password"
                    required
                  />
                </div>

                {(formError || error) && (
                  <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {formError || error}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[56px]"
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner size="sm" /> : 'Sign In'}
                </button>
              </form>

              {/* Show recent accounts */}
              <AccountSwitcher />
            </div>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-sm text-white/70 mt-8">
          © 2025 GULL. Professional Accounting Management.
        </p>
      </div>
    </div>
  );
};

export default Welcome;

