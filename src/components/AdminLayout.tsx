import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import ProfileDropdown from './ProfileDropdown';
import { AdminRefreshProvider, useAdminRefresh } from '../contexts/AdminRefreshContext';

/**
 * Inner AdminLayout Component with access to AdminRefreshContext
 */
const AdminLayoutInner: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { triggerRefresh } = useAdminRefresh();

  const handleRefresh = () => {
    triggerRefresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Admin Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Hamburger Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Center: Title and Refresh Button */}
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Admin Panel
            </h1>
            <button
              onClick={handleRefresh}
              className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              aria-label="Refresh data"
              title="Refresh current page data"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Right: Profile Dropdown */}
          <ProfileDropdown />
        </div>
      </header>

      {/* Admin Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content - with top padding for fixed header */}
      <div className="w-full pt-16">
        <Outlet />
      </div>
    </div>
  );
};

/**
 * AdminLayout Component
 * 
 * Wrapper layout for admin pages that includes the sidebar and header
 * Provides hamburger button to toggle sidebar and refresh functionality
 */
const AdminLayout: React.FC = () => {
  return (
    <AdminRefreshProvider>
      <AdminLayoutInner />
    </AdminRefreshProvider>
  );
};

export default AdminLayout;



