import React from 'react';
import { useNavigate } from 'react-router-dom';
import BalanceDisplay from './BalanceDisplay';
import ProfileDropdown from './ProfileDropdown';
// Sidebar removed

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
}) => {
  // Sidebar removed
  const navigate = useNavigate();

  return (
    <>
      <div className="bg-gray-800 shadow-sm border-b border-gray-700 mobile-header">
        <div className="w-full px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            {/* Left: Menu Button and Project Info */}
            <div className="flex items-center space-x-3 sm:space-x-6">
              {/* Back Button */}
              <button
                onClick={() => navigate('/')}
                className="p-2 sm:p-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-h-[48px] min-w-[48px] flex items-center justify-center"
                title="Back to Projects"
                aria-label="Back to Projects"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              
              {/* Sidebar button removed */}
              <div className={`${!showTabs ? 'border-l border-gray-600 pl-3 sm:pl-6' : ''} min-w-0 flex-1`}>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                  {projectName}
                </h1>
                {projectDate && (
                  <p className="text-xs sm:text-sm text-gray-300 mt-0.5 truncate">
                    {projectDate}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions - Compact on Mobile */}
            <div className="flex items-center justify-end space-x-2 sm:space-x-4">
              {/* Balance Display - Hidden on very small screens */}
              <div className="hidden sm:block">
                <BalanceDisplay />
              </div>

              {/* Top-up Request Button */}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-2 sm:p-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-h-[48px] min-w-[48px] flex items-center justify-center"
                  title="Request Top-up"
                  aria-label="Request Top-up"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}


              <ProfileDropdown />
            </div>
          </div>
        </div>
        
        {/* Tabs Section */}
        {showTabs && tabs.length > 0 && (
          <div className="border-t border-gray-700 bg-gray-800">
            <div className="w-full px-4 py-2">
              <div className="flex space-x-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange?.(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
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
