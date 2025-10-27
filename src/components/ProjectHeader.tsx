import React from 'react';
import { useNavigate } from 'react-router-dom';
import BalanceDisplay from './BalanceDisplay';
import ProfileDropdown from './ProfileDropdown';
import { useAuth } from '../contexts/AuthContext';

interface Tab {
  id: string;
  label: string;
  description: string;
}

interface ProjectHeaderProps {
  projectName: string;
  projectDate?: string;
  onRefresh?: () => void;
  projectId?: string;
  showTabs?: boolean;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  // Controls
  showBackButton?: boolean;
  variant?: 'user' | 'admin';
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  projectName,
  projectDate,
  onRefresh,
  // projectId,
  showTabs = false,
  tabs = [],
  activeTab,
  onTabChange,
  showBackButton = true,
  variant = 'user',
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 mobile-header">
        <div className="w-full px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            {/* Left: Menu Button and Project Info */}
            <div className="flex items-center space-x-3 sm:space-x-6">
              {/* Back Button */}
              {showBackButton && (
                <button
                  onClick={() => navigate('/')}
                  className="p-2 sm:p-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 hover:from-gray-300 hover:to-gray-400 dark:hover:from-gray-700 dark:hover:to-gray-800 text-gray-900 dark:text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-h-[48px] min-w-[48px] flex items-center justify-center"
                  title="Back"
                  aria-label="Back"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              )}
              
              {/* Sidebar button removed */}
              <div className={`${!showTabs ? 'border-l border-gray-300 dark:border-gray-600 pl-3 sm:pl-6' : ''} min-w-0 flex-1`}>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {projectName}
                </h1>
                {projectDate && (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-0.5 truncate">
                    {projectDate}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions - Compact on Mobile */}
            <div className="flex items-center justify-end space-x-2 sm:space-x-4">
              {/* Balance Display - Shown for users, less prominent for admin */}
              {!isAdmin && (
                <div className="block">
                  <BalanceDisplay />
                </div>
              )}
              
              {isAdmin && variant === 'admin' && (
                <div className="flex items-center space-x-2">
                  <span className="hidden sm:inline-block px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg">
                    ADMIN
                  </span>
                </div>
              )}

              {/* Refresh button for both admin and user */}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className={`p-2 sm:p-3 ${
                    variant === 'admin' 
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' 
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                  } text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-h-[48px] min-w-[48px] flex items-center justify-center`}
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}

              <ProfileDropdown />
            </div>
          </div>
        </div>
        
        {/* Tabs Section */}
        {showTabs && tabs.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="w-full px-4 py-2">
              <div className="flex space-x-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange?.(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title={tab.description}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar removed */}
    </>
  );
};

export default ProjectHeader;
