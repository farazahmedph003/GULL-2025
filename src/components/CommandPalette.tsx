import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  category?: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CommandPalette Component - Cmd+K Quick Actions
 * 
 * Fuzzy search through all available actions
 * Keyboard-first navigation with arrow keys
 * Recent actions tracking
 * Glassmorphism design
 */
const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent commands from localStorage
  useEffect(() => {
    const recent = localStorage.getItem('recent-commands');
    if (recent) {
      setRecentCommands(JSON.parse(recent));
    }
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex]);

  // Define all available commands
  const commands: Command[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      description: 'View project overview',
      category: 'Navigation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      action: () => navigate('/'),
      keywords: ['home', 'overview'],
    },
    {
      id: 'nav-projects',
      label: 'View All Projects',
      description: 'See all your projects',
      category: 'Navigation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      action: () => navigate('/'),
      keywords: ['list', 'all'],
    },
    {
      id: 'nav-history',
      label: 'View History',
      description: 'See transaction history',
      category: 'Navigation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      action: () => {
        const projectId = localStorage.getItem('last-project-id');
        if (projectId) navigate(`/project/${projectId}/history`);
      },
      keywords: ['transactions', 'log', 'past'],
    },
    
    // Actions
    {
      id: 'action-new-project',
      label: 'Create New Project',
      description: 'Start a new project',
      category: 'Actions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      ),
      action: () => {
        navigate('/');
        setTimeout(() => {
          const createBtn = document.querySelector('[data-action="create-project"]') as HTMLElement;
          if (createBtn) createBtn.click();
        }, 100);
      },
      keywords: ['new', 'add', 'create'],
    },
    {
      id: 'action-add-entry',
      label: 'Add New Entry',
      description: 'Quick add transaction',
      category: 'Actions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      action: () => {
        // Trigger FAB click if available
        const fab = document.querySelector('[data-action="add-entry"]') as HTMLElement;
        if (fab) fab.click();
      },
      keywords: ['add', 'new', 'create', 'transaction'],
    },
    
    // Settings
    {
      id: 'settings-theme',
      label: 'Toggle Theme',
      description: 'Switch between light and dark mode',
      category: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
      action: () => {
        const themeBtn = document.querySelector('[aria-label="Toggle theme"]') as HTMLElement;
        if (themeBtn) themeBtn.click();
      },
      keywords: ['dark', 'light', 'mode', 'appearance'],
    },
    {
      id: 'settings-open',
      label: 'Open Settings',
      description: 'Access app settings and preferences',
      category: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      action: () => navigate('/settings'),
      keywords: ['preferences', 'configuration', 'customize'],
    },
    {
      id: 'settings-profile',
      label: 'View Profile',
      description: 'Manage your account',
      category: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      action: () => navigate('/profile'),
      keywords: ['account', 'user', 'settings'],
    },
    {
      id: 'settings-export',
      label: 'Export Data',
      description: 'Export all projects and data',
      category: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      action: async () => {
        try {
          const { exportAllProjects } = await import('../utils/dataManagement');
          await exportAllProjects();
        } catch (error) {
          console.error('Export failed:', error);
        }
      },
      keywords: ['backup', 'download', 'save'],
    },
    {
      id: 'settings-import',
      label: 'Import Data',
      description: 'Import projects from file',
      category: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      ),
      action: () => {
        navigate('/settings');
        // Trigger file input after navigation
        setTimeout(() => {
          const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLElement;
          if (fileInput) fileInput.click();
        }, 100);
      },
      keywords: ['restore', 'upload', 'load'],
    },
  ];

  // Fuzzy search filter
  const filteredCommands = commands.filter((cmd) => {
    if (!search) return true;
    
    const searchLower = search.toLowerCase();
    const labelMatch = cmd.label.toLowerCase().includes(searchLower);
    const descMatch = cmd.description?.toLowerCase().includes(searchLower);
    const keywordMatch = cmd.keywords?.some(k => k.includes(searchLower));
    const categoryMatch = cmd.category?.toLowerCase().includes(searchLower);
    
    return labelMatch || descMatch || keywordMatch || categoryMatch;
  });

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const executeCommand = (command: Command) => {
    // Track recent commands
    const updated = [command.id, ...recentCommands.filter(id => id !== command.id)].slice(0, 5);
    setRecentCommands(updated);
    localStorage.setItem('recent-commands', JSON.stringify(updated));
    
    // Execute action
    command.action();
    
    // Close palette
    onClose();
    setSearch('');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 glass-backdrop"
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4 pointer-events-none">
        <div
          className="w-full max-w-2xl bg-[#FFFFFF] dark:bg-[#252837] rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
          style={{
            animation: 'slideInDown 0.2s ease-out',
            border: '1px solid rgba(99, 102, 241, 0.2)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-[#E5E7EB] dark:border-[#2D3040]">
            <svg
              className="w-5 h-5 text-[#9CA3AF] dark:text-[#6B7280]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent border-none outline-none text-[#111827] dark:text-[#F9FAFB] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] text-lg"
            />
            <kbd className="px-2 py-1 text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] bg-[#F3F4F6] dark:bg-[#2D3040] rounded border border-[#E5E7EB] dark:border-[#3D4254]">
              ESC
            </kbd>
          </div>

          {/* Commands List */}
          <div className="max-h-96 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-[#9CA3AF] dark:text-[#6B7280]">No commands found</p>
              </div>
            ) : (
              <>
                {/* Group by category */}
                {['Navigation', 'Actions', 'Settings'].map((category) => {
                  const categoryCommands = filteredCommands.filter(cmd => cmd.category === category);
                  if (categoryCommands.length === 0) return null;

                  return (
                    <div key={category}>
                      <div className="px-4 py-2 text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">
                        {category}
                      </div>
                      {categoryCommands.map((cmd) => {
                        const globalIndex = filteredCommands.indexOf(cmd);
                        const isSelected = globalIndex === selectedIndex;
                        
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => executeCommand(cmd)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                              isSelected
                                ? 'bg-[#EEF2FF] dark:bg-[#2D3040]'
                                : 'hover:bg-[#F9FAFB] dark:hover:bg-[#2D3040]'
                            }`}
                          >
                            <div className={`${isSelected ? 'text-[#6366F1] dark:text-[#818CF8]' : 'text-[#9CA3AF] dark:text-[#6B7280]'}`}>
                              {cmd.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium ${isSelected ? 'text-[#6366F1] dark:text-[#818CF8]' : 'text-[#111827] dark:text-[#F9FAFB]'}`}>
                                {cmd.label}
                              </div>
                              {cmd.description && (
                                <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF] truncate">
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <kbd className="px-2 py-1 text-xs font-semibold text-[#6366F1] dark:text-[#818CF8] bg-[#EEF2FF] dark:bg-[#2D3040] rounded">
                                ↵
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#E5E7EB] dark:border-[#2D3040] bg-[#F9FAFB] dark:bg-[#1F2235]">
            <div className="flex items-center gap-4 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#252837] rounded border border-[#E5E7EB] dark:border-[#2D3040]">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#252837] rounded border border-[#E5E7EB] dark:border-[#2D3040]">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#252837] rounded border border-[#E5E7EB] dark:border-[#2D3040]">ESC</kbd>
                Close
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;

