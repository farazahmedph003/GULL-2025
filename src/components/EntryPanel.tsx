import React, { useState, useEffect } from 'react';
import StandardEntry from './StandardEntry';
import IntelligentEntry from './IntelligentEntry';
import type { EntryType, Transaction, AddedEntrySummary } from '../types';

interface EntryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  entryType: EntryType;
  transactions: Transaction[];
  onEntryAdded?: (summary?: AddedEntrySummary[]) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>, skipBalanceDeduction?: boolean) => Promise<Transaction | null>;
  addTransactionsBatch?: (transactions: Array<Omit<Transaction, 'id'>>, skipBalanceDeduction?: boolean) => Promise<Transaction[]>;
}

const EntryPanel: React.FC<EntryPanelProps> = ({
  isOpen,
  onClose,
  projectId,
  entryType,
  transactions,
  onEntryAdded,
  addTransaction,
  addTransactionsBatch,
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
      {/* Mobile Bottom Sheet / Desktop Modal */}
      <div
        className={`fixed inset-0 z-50 ${
          isOpen ? 'block' : 'hidden'
        }`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Bottom Sheet Content */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl transform transition-all duration-300 ease-out max-h-[85vh] overflow-hidden ${
            isOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </div>
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add Entry
              </h2>
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('standard')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'standard'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Standard
                </button>
                <button
                  onClick={() => setActiveTab('intelligent')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'intelligent'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Intelligent
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form Content */}
          <div className="px-4 py-4 overflow-y-auto max-h-[calc(85vh-120px)]">
            {activeTab === 'standard' ? (
              <StandardEntry
                projectId={projectId}
                addTransaction={addTransaction}
                addTransactionsBatch={addTransactionsBatch}
                transactions={transactions}
                onSuccess={(added) => {
                  onEntryAdded?.(added);
                  // Don't close panel automatically - let user continue entering
                }}
              />
            ) : (
              <IntelligentEntry
                projectId={projectId}
                entryType={entryType}
                addTransaction={addTransaction}
                addTransactionsBatch={addTransactionsBatch}
                transactions={transactions}
                onSuccess={(added) => {
                  onEntryAdded?.(added);
                  // Don't close panel automatically - let user continue entering
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default EntryPanel;

