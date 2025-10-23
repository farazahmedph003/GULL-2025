import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * AdminSidebar Component - Navigation for Admin Panel
 * 
 * Slide-in sidebar from left with admin-specific menu items
 */
const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  type MenuItem = {
    id: string;
    label: string;
    path: string;
    icon: React.ReactNode;
    isDivider?: never;
  } | {
    id: string;
    isDivider: true;
    label?: never;
    path?: never;
    icon?: never;
  };

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/admin',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'users',
      label: 'User Management',
      path: '/admin/users',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'open',
      label: 'Open',
      path: '/admin/open',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'akra',
      label: 'Akra (00)',
      path: '/admin/akra',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'ring',
      label: 'Ring (000)',
      path: '/admin/ring',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      ),
    },
    {
      id: 'packet',
      label: 'Packet',
      path: '/admin/packet',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      id: 'filter',
      label: 'Filter & Calculate',
      path: '/admin/filter',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      ),
    },
    {
      id: 'advanced-filter',
      label: 'Advanced Filter',
      path: '/admin/advanced-filter',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: 'divider-1',
      isDivider: true,
    },
    {
      id: 'profile',
      label: 'Profile',
      path: '/profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      path: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: isOpen ? 'blur(8px)' : 'none',
        }}
      />

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } bg-[#FFFFFF] dark:bg-[#252837] border-r border-[#E5E7EB] dark:border-[#2D3040]`}
        style={{
          boxShadow: isOpen
            ? '4px 0 24px rgba(0, 0, 0, 0.12)'
            : 'none',
        }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB] dark:border-[#2D3040]">
          <h2 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">
            Admin Panel
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#2D3040] transition-colors duration-200"
            aria-label="Close sidebar"
          >
            <svg
              className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
          {menuItems.map((item) => {
            // Render divider
            if ('isDivider' in item && item.isDivider) {
              return (
                <div key={item.id} className="my-3 border-t border-[#E5E7EB] dark:border-[#2D3040]" />
              );
            }

            // Render menu item
            return (
              <NavLink
                key={item.id}
                to={item.path!}
                onClick={onClose}
                className={({ isActive }) => {
                  // Special case: dashboard should be active only on exact match
                  const isExactMatch = location.pathname === item.path;
                  const shouldBeActive = item.id === 'dashboard' ? isExactMatch : isActive;
                  
                  return `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    shouldBeActive
                      ? 'bg-[#D1FAE5] dark:bg-[#2D3040] text-[#14B8A6] dark:text-[#2DD4BF] font-semibold border-l-4 border-[#14B8A6] dark:border-[#2DD4BF]'
                      : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F9FAFB] dark:hover:bg-[#2D3040] hover:text-[#111827] dark:hover:text-[#F9FAFB] font-medium'
                  }`;
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#E5E7EB] dark:border-[#2D3040]">
          <div className="text-xs text-[#9CA3AF] dark:text-[#6B7280] text-center font-medium">
            Admin Dashboard v1.0
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;

