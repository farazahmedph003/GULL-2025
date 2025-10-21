import React, { useState, useEffect } from 'react';
import StandardEntry from './StandardEntry';
import IntelligentEntry from './IntelligentEntry';
import type { EntryType } from '../types';

interface EntryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  entryType: EntryType;
  onEntryAdded?: () => void;
}

const EntryPanel: React.FC<EntryPanelProps> = ({
  isOpen,
  onClose,
  projectId,
  entryType,
  onEntryAdded,
}) => {
  const [activeTab, setActiveTab] = useState<'standard' | 'intelligent'>('standard');

  // Handle escape key to close panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // No body scroll locking to keep background content visible while panel is open
  useEffect(() => {
    return () => {};
  }, [isOpen]);

  return (
    <>
      {/* Sliding Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Add Entry
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {entryType === 'akra' 
                ? '2-digit numbers (00-99)' 
                : entryType === 'ring' 
                  ? '3-digit numbers (000-999)'
                  : entryType === 'open'
                    ? '1-digit numbers (0-9)'
                    : '4-digit numbers (0000-9999)'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          <button
            onClick={() => setActiveTab('standard')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'standard'
                ? 'border-secondary text-secondary'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => setActiveTab('intelligent')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'intelligent'
                ? 'border-secondary text-secondary'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Intelligent
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto h-[calc(100vh-180px)] p-6">
          {activeTab === 'standard' ? (
            <StandardEntry
              projectId={projectId}
              entryType={entryType}
              onSuccess={() => {
                onEntryAdded?.();
                onClose();
              }}
            />
          ) : (
            <IntelligentEntry
              projectId={projectId}
              entryType={entryType}
              onSuccess={() => {
                onEntryAdded?.();
                onClose();
              }}
            />
          )}
        </div>

        {/* Keyboard Shortcuts Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
            Press <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>
    </>
  );
};

export default EntryPanel;

