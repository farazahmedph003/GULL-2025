import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdminEmail } from '../config/admin';
import { db } from '../services/database';
import { playNavigateSound } from '../utils/audioFeedback';

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  adminOnly: boolean;
  isDivider?: boolean;
}

const SidebarMenu: React.FC<SidebarMenuProps> = ({ isOpen, onClose, projectId: propProjectId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id: urlProjectId } = useParams<{ id: string }>();
  const isAdmin = user ? isAdminEmail(user.email) : false;
  const projectId = propProjectId || urlProjectId;
  const [project, setProject] = useState<any>(null);

  // Load project data when projectId changes
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        setProject(null);
        return;
      }

      try {
        const projectData = await db.getProject(projectId);
        setProject(projectData);
      } catch (error) {
        console.error('Error loading project:', error);
        setProject(null);
      }
    };

    loadProject();
  }, [projectId]);

  // Handle escape key to close sidebar
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Build menu items based on project entry types
  const buildMenuItems = (): MenuItem[] => {
    if (!projectId) {
      return [
        {
          id: 'projects',
          label: 'My Projects',
          path: '/',
          icon: '📁',
          adminOnly: false,
        },
        {
          id: 'admin',
          label: 'Admin Panel',
          path: '/admin',
          icon: '👑',
          adminOnly: true,
        },
        {
          id: 'profile',
          label: 'Profile',
          path: '/profile',
          icon: '👤',
          adminOnly: false,
        },
        {
          id: 'settings',
          label: 'Settings',
          path: '/settings',
          icon: '⚙️',
          adminOnly: false,
        },
      ];
    }

    const items = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: `/project/${projectId}`,
        icon: '📊',
        adminOnly: false,
      },
    ];

    // Add menu items in the correct sequence: Open → Akra → Ring → Packet
    
    // Add Open menu item first
    if (project?.entryTypes?.includes('open')) {
      items.push({
        id: 'open',
        label: 'Open (0)',
        path: `/project/${projectId}/open`,
        icon: '🔓',
        adminOnly: false,
      });
    }

    // Add Akra menu item
    if (project?.entryTypes?.includes('akra')) {
      items.push({
        id: 'akra',
        label: 'Akra (00)',
        path: `/project/${projectId}/akra`,
        icon: '🔢',
        adminOnly: false,
      });
    }

    // Add Ring menu item
    if (project?.entryTypes?.includes('ring')) {
      items.push({
        id: 'ring',
        label: 'Ring (000)',
        path: `/project/${projectId}/ring`,
        icon: '🎯',
        adminOnly: false,
      });
    }

    // Add Packet menu item last
    if (project?.entryTypes?.includes('packet')) {
      items.push({
        id: 'packet',
        label: 'Packet (0000)',
        path: `/project/${projectId}/packet`,
        icon: '📦',
        adminOnly: false,
      });
    }

    // Add other menu items
    items.push(
      {
        id: 'advanced-filter',
        label: 'Advanced Filter',
        path: `/project/${projectId}/advanced-filter`,
        icon: '🔍',
        adminOnly: false,
      },
      // History remains removed
      {
        id: 'divider',
        label: '',
        path: '',
        icon: '',
        adminOnly: false,
        isDivider: true,
      } as MenuItem,
      {
        id: 'projects',
        label: 'My Projects',
        path: '/',
        icon: '📁',
        adminOnly: false,
      },
      {
        id: 'admin',
        label: 'Admin Panel',
        path: '/admin',
        icon: '👑',
        adminOnly: true,
      },
      {
        id: 'profile',
        label: 'Profile',
        path: '/profile',
        icon: '👤',
        adminOnly: false,
      },
      {
        id: 'settings',
        label: 'Settings',
        path: '/settings',
        icon: '⚙️',
        adminOnly: false,
      }
    );

    return items;
  };

  const menuItems = buildMenuItems();

  const handleNavigation = (path: string) => {
    playNavigateSound();
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-64 sm:w-72 lg:w-80 bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-2xl transform transition-transform duration-300 ease-out z-50 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="relative p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-500 to-blue-600 overflow-hidden">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-700/20"></div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  NERO Menu
                </h2>
                <p className="text-sm text-blue-100">
                  {user?.displayName || user?.email || 'User'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 group"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="overflow-y-auto h-[calc(100vh-180px)] p-4">
          <div className="space-y-3">
            {menuItems
              .filter(item => !item.adminOnly || isAdmin)
              .map((item) => {
                if (item.isDivider) {
                  return (
                    <div key={item.id} className="relative my-6">
                      {/* Decorative divider with gradient */}
                      <div className="flex items-center justify-center">
                        <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                        <div className="relative mx-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          {/* Animated pulse effect */}
                          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-blue-600/30 rounded-full animate-pulse"></div>
                        </div>
                        <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                      </div>
                      
                    </div>
                  );
                }
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className="w-full group relative flex items-center space-x-3 p-4 bg-white dark:bg-slate-800 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 dark:hover:from-purple-900/20 dark:hover:to-blue-900/20 border border-gray-200 dark:border-slate-700 rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 text-left overflow-hidden"
                  >
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-blue-500/0 group-hover:from-purple-500/5 group-hover:to-blue-500/5 transition-all duration-300 rounded-xl"></div>
                    
                    <div className="relative z-10 flex items-center space-x-3">
                      <span className="text-2xl group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                      <span className="text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 font-semibold">{item.label}</span>
                    </div>
                  </button>
                );
              })}
          </div>

          {/* User Info Section */}
          <div className="mt-8 p-4 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {user?.email}
                </p>
              </div>
            </div>
            {isAdmin && (
              <div className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold rounded-full inline-block shadow-lg">
                👑 Administrator
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center space-x-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Press
            </p>
            <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">Esc</kbd>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SidebarMenu;
