import React, { useState } from 'react';
import BalanceDisplay from './BalanceDisplay';
import ProfileDropdown from './ProfileDropdown';
import SidebarMenu from './SidebarMenu';

interface ProjectHeaderProps {
  projectName: string;
  projectDate?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onRefresh?: () => void;
  projectId?: string;
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  projectName,
  projectDate,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onRefresh,
  projectId,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <div className="bg-gray-800 shadow-sm border-b border-gray-700 sticky top-0 z-40">
        <div className="w-full px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            {/* Left: Menu Button and Project Info */}
            <div className="flex items-center space-x-4 sm:space-x-6">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="border-l border-gray-600 pl-4 sm:pl-6">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                  {projectName}
                </h1>
                {projectDate && (
                  <p className="text-sm sm:text-base text-gray-300 mt-1">
                    {projectDate}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-4">
              {/* Balance Display for All Users */}
              <BalanceDisplay />

              {/* Refresh Button */}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  title="Refresh Data"
                  aria-label="Refresh"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}

              {/* Undo/Redo Buttons */}
              {(onUndo || onRedo) && (
                <div className="flex items-center space-x-2 bg-gray-700 rounded-lg p-2">
                  <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className={`p-2.5 rounded transition-colors ${
                      canUndo
                        ? 'hover:bg-gray-600 text-white'
                        : 'text-gray-500 cursor-not-allowed'
                    }`}
                    title="Undo (Ctrl+Z)"
                    aria-label="Undo"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className={`p-2.5 rounded transition-colors ${
                      canRedo
                        ? 'hover:bg-gray-600 text-white'
                        : 'text-gray-500 cursor-not-allowed'
                    }`}
                    title="Redo (Ctrl+Y)"
                    aria-label="Redo"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                    </svg>
                  </button>
                </div>
              )}

              <ProfileDropdown />
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Menu */}
      <SidebarMenu isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} projectId={projectId} />
    </>
  );
};

export default ProjectHeader;
