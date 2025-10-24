import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AccountSwitcher from '../components/AccountSwitcher';
import { isOfflineMode } from '../lib/supabase';

const Welcome: React.FC = () => {
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();
  
  const { signIn, loading, error, clearError } = useAuth();

  // Check if switching to another account
  useEffect(() => {
    const state = location.state as { switchTo?: string } | null;
    if (state?.switchTo) {
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
      <div className="w-full max-w-2xl">
        {/* Logo/Header */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-3">GULL</h1>
          <p className="text-xl sm:text-2xl lg:text-3xl text-gray-700 dark:text-gray-300">Accounting Management System</p>
          {isOfflineMode() && (
            <div className="mt-4 sm:mt-5 inline-block px-4 sm:px-5 py-3 bg-yellow-500/20 border border-yellow-400 rounded-lg">
              <p className="text-sm sm:text-base text-yellow-200">
                🔒 Offline Mode - Data stored locally
              </p>
            </div>
          )}
        </div>

        {/* Main Card */}
        <div className="relative bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/20 via-blue-50/10 to-indigo-50/20 dark:from-purple-900/10 dark:via-blue-900/5 dark:to-indigo-900/10"></div>
          
          {/* Sign In Form */}
          <div className="relative z-10 p-8 sm:p-12 lg:p-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-6 sm:mb-8">
              Sign In
            </h2>

            <form onSubmit={handleSignIn} className="space-y-6 sm:space-y-8">
              <div>
                <label className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Username or Email
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-5 py-4 sm:px-6 sm:py-5 text-lg sm:text-xl border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                <label className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 sm:px-6 sm:py-5 text-lg sm:text-xl border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
              </div>

              {(formError || error) && (
                <div className="p-4 sm:p-5 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-base sm:text-lg text-red-600 dark:text-red-400">
                    {formError || error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full px-8 py-5 sm:py-6 text-lg sm:text-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[68px]"
                disabled={loading}
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Sign In'}
              </button>
            </form>

            {/* Show recent accounts */}
            <AccountSwitcher />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-base sm:text-lg text-white/70 mt-10 sm:mt-12">
          © 2025 GULL. Professional Accounting Management.
        </p>
      </div>
    </div>
  );
};

export default Welcome;

