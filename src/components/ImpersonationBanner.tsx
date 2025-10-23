import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const ImpersonationBanner: React.FC = () => {
  const { user, isImpersonating, impersonatedUser, originalAdminUser, exitImpersonation } = useAuth();

  if (!isImpersonating || !user || !originalAdminUser) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-gradient-to-r from-[#6D28D9] to-[#2563EB] text-white shadow-lg">
        <div className="px-4 py-3">
      <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">Admin Impersonation Active</p>
                <p className="text-xs text-white/80">
                  Viewing as: <span className="font-semibold">{user.displayName || user.email}</span>
                  {impersonatedUser && impersonatedUser.email !== user.email && (
                    <span className="ml-2 text-white/70">({impersonatedUser.email})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs text-white/80">Admin: <span className="font-semibold">{originalAdminUser.displayName || originalAdminUser.email}</span></span>
              <button
                onClick={exitImpersonation}
                className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Exit Impersonation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
