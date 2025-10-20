import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdminEmail } from '../config/admin';
import { db } from '../services/database';

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
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
  const buildMenuItems = () => {
    if (!projectId) {
      return [
        {
          id: 'projects',
          label: '📁 My Projects',
          path: '/',
          icon: '📁',
          adminOnly: false,
        },
        {
          id: 'admin',
          label: '👑 Admin Panel',
          path: '/admin',
          icon: '👑',
          adminOnly: true,
        },
        {
          id: 'profile',
          label: '👤 Profile',
          path: '/profile',
          icon: '👤',
          adminOnly: false,
        },
      ];
    }

    const items = [
      {
        id: 'dashboard',
        label: '📊 Dashboard',
        path: `/project/${projectId}`,
        icon: '📊',
        adminOnly: false,
      },
    ];

    // Add Akra menu item only if project supports akra entries
    if (project?.entryTypes?.includes('akra')) {
      items.push({
        id: 'akra',
        label: '🔢 Akra (00)',
        path: `/project/${projectId}/akra`,
        icon: '🔢',
        adminOnly: false,
      });
    }

    // Add Ring menu item only if project supports ring entries
    if (project?.entryTypes?.includes('ring')) {
      items.push({
        id: 'ring',
        label: '🎯 Ring (000)',
        path: `/project/${projectId}/ring`,
        icon: '🎯',
        adminOnly: false,
      });
    }

    // Add other menu items
    items.push(
      {
        id: 'advanced-filter',
        label: '🔍 Advanced Filter',
        path: `/project/${projectId}/advanced-filter`,
        icon: '🔍',
        adminOnly: false,
      },
      {
        id: 'history',
        label: '📚 History',
        path: `/project/${projectId}/history`,
        icon: '📚',
        adminOnly: false,
      },
      {
        id: 'divider',
        label: '',
        path: '',
        icon: '',
        adminOnly: false,
      },
      {
        id: 'projects',
        label: '📁 My Projects',
        path: '/',
        icon: '📁',
        adminOnly: false,
      },
      {
        id: 'admin',
        label: '👑 Admin Panel',
        path: '/admin',
        icon: '👑',
        adminOnly: true,
      },
      {
        id: 'profile',
        label: '👤 Profile',
        path: '/profile',
        icon: '👤',
        adminOnly: false,
      }
    );

    return items;
  };

  const menuItems = buildMenuItems();

  const handleNavigation = (path: string) => {
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
        className={`fixed top-0 left-0 h-full w-64 sm:w-72 lg:w-80 bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-out z-50 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gradient-to-r from-purple-900 to-blue-900">
          <div>
            <h2 className="text-2xl font-bold text-white">
              🎯 NERO Menu
            </h2>
            <p className="text-sm text-purple-200 mt-1">
              {user?.displayName || user?.email || 'User'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menu Items */}
        <div className="overflow-y-auto h-[calc(100vh-180px)] p-4">
          <div className="space-y-2">
            {menuItems
              .filter(item => !item.adminOnly || isAdmin)
              .map((item) => {
                if ((item as any).isDivider) {
                  return <div key={item.id} className="border-t border-gray-700 my-4" />;
                }
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className="w-full flex items-center space-x-3 p-4 bg-gray-800 hover:bg-gradient-to-r hover:from-purple-600 hover:to-blue-600 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg text-left group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{item.icon}</span>
                    <span className="text-gray-300 group-hover:text-white font-semibold">{item.label}</span>
                  </button>
                );
              })}
          </div>

          {/* User Info Section */}
          <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-gray-400 text-sm">
                  {user?.email}
                </p>
              </div>
            </div>
            {isAdmin && (
              <div className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold rounded-full inline-block">
                👑 Administrator
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-800 border-t border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            Press <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>
    </>
  );
};

export default SidebarMenu;
