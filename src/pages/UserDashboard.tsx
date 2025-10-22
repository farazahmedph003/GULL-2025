import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProjectHeader from '../components/ProjectHeader';
import StandardEntry from '../components/StandardEntry';
import IntelligentEntry from '../components/IntelligentEntry';
import EntryHistoryPanel from '../components/EntryHistoryPanel';
import AggregatedNumbersPanel from '../components/AggregatedNumbersPanel';
import EntryFormsBar from '../components/EntryFormsBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTransactions } from '../hooks/useTransactions';
import { useHistory } from '../hooks/useHistory';
import { useUserBalance } from '../hooks/useUserBalance';
import { db } from '../services/database';
import { formatDate } from '../utils/helpers';
import { playReloadSound, playUndoSound, playRedoSound } from '../utils/audioFeedback';
import type { Project } from '../types';

type TabType = 'all' | 'open' | 'akra' | 'ring' | 'packet';

const UserDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [entryTab, setEntryTab] = useState<'standard' | 'intelligent'>('standard');

  const { 
    transactions,
    refresh: refreshTransactions, 
    getStatistics, 
    addTransaction, 
    deleteTransaction,
    bulkDeleteTransactions,
    updateTransaction,
  } = useTransactions(id || '');
  
  const { refresh: refreshBalance } = useUserBalance();
  
  // Comprehensive refresh function
  const refresh = () => {
    playReloadSound();
    refreshTransactions();
    refreshBalance();
  };
  
  const {
    canUndo,
    canRedo,
    undo,
    redo,
  } = useHistory(id || '', {
    onRevert: async (action) => {
      // Undo the action
      if (action.type === 'add' && action.data?.transactionId) {
        // Revert add by deleting
        await deleteTransaction(action.data.transactionId);
        refresh();
      } else if (action.type === 'delete' && action.data?.transaction) {
        // Revert delete by re-adding
        await addTransaction(action.data.transaction);
        refresh();
      } else if (action.type === 'edit' && action.data?.originalTransaction) {
        // Revert edit by restoring original
        await updateTransaction(action.data.transactionId, action.data.originalTransaction);
        refresh();
      } else if (action.type === 'batch' && action.data?.transactionIds) {
        // Revert batch delete by re-adding
        if (action.data.transactions) {
          for (const t of action.data.transactions) {
            await addTransaction(t);
          }
          refresh();
        }
      } else if (action.type === 'filter' && action.data?.transactionIds) {
        // Revert filter deductions by deleting the created deduction transactions
        for (const transactionId of action.data.transactionIds) {
          await deleteTransaction(transactionId);
        }
        refresh();
      }
    },
    onApply: async (action) => {
      // Redo the action
      if (action.type === 'add' && action.data?.transaction) {
        // Redo add
        await addTransaction(action.data.transaction);
        refresh();
      } else if (action.type === 'delete' && action.data?.transactionId) {
        // Redo delete
        await deleteTransaction(action.data.transactionId);
        refresh();
      } else if (action.type === 'edit' && action.data?.updatedTransaction) {
        // Redo edit
        await updateTransaction(action.data.transactionId, action.data.updatedTransaction);
        refresh();
      } else if (action.type === 'batch' && action.data?.transactionIds) {
        // Redo batch delete
        await bulkDeleteTransactions(action.data.transactionIds);
        refresh();
      } else if (action.type === 'filter' && action.data?.transactions) {
        // Redo filter deductions by re-adding the deduction transactions
        for (const transaction of action.data.transactions) {
          await addTransaction(transaction);
        }
        refresh();
      }
    },
  });

  const statistics = getStatistics();

  // Load project
  useEffect(() => {
    const loadProject = async () => {
      if (!id) {
        navigate('/');
        return;
      }

      try {
        const projectData = await db.getProject(id);
        if (!projectData) {
          navigate('/404');
          return;
        }

        setProject(projectData);
      } catch (error) {
        console.error('Error loading project:', error);
        navigate('/404');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [id, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          playUndoSound();
          undo();
        }
      }
      
      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) {
          playRedoSound();
          redo();
        }
      }
      
      // Ctrl/Cmd + / to toggle entry panel
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setEntryPanelOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handleEntryAdded = () => {
    refresh();
  };

  const tabs = [
    { id: 'all' as TabType, label: 'ALL', description: 'All entries' },
    { id: 'open' as TabType, label: 'OPEN', description: 'Open entries' },
    { id: 'akra' as TabType, label: 'AKRA', description: '2-digit entries' },
    { id: 'ring' as TabType, label: 'RING', description: '3-digit entries' },
    { id: 'packet' as TabType, label: 'PACKET', description: 'Packet entries' },
  ].filter(tab => {
    // Only show tabs for entry types that exist in the project
    if (tab.id === 'all' || tab.id === 'open') return true;
    return project?.entryTypes?.includes(tab.id);
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner text="Loading project..." />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Project not found
          </h2>
        </div>
      </div>
    );
  }

  return (
    <>
      <ProjectHeader
        projectName={project.name}
        projectDate={formatDate(project.date)}
        onRefresh={refresh}
        projectId={id}
        showTabs={true}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20 sm:pb-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
          
          {/* Page Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">
              📊 {project.name}
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Track your {project.entryTypes.join(' and ')} entries with real-time calculations
            </p>
          </div>

          {/* Statistics Summary */}
          <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg sm:rounded-xl shadow-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-lg font-bold text-gray-100">Total Entries</h3>
                  <p className="text-lg sm:text-2xl font-bold text-cyan-300">{statistics.totalEntries}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-lg sm:rounded-xl shadow-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-lg font-bold text-gray-100">First Total</h3>
                  <p className="text-lg sm:text-2xl font-bold text-cyan-300">PKR {statistics.firstTotal.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-lg sm:rounded-xl shadow-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-lg font-bold text-gray-100">Second Total</h3>
                  <p className="text-lg sm:text-2xl font-bold text-cyan-300">PKR {statistics.secondTotal.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dual Panel Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Left Panel - Entry History */}
            <EntryHistoryPanel
              transactions={transactions}
              activeTab={activeTab}
              projectEntryTypes={project.entryTypes}
            />

            {/* Right Panel - Aggregated Numbers */}
            <AggregatedNumbersPanel
              transactions={transactions}
              activeTab={activeTab}
              projectEntryTypes={project.entryTypes}
            />
          </div>

          {/* Entry Panel - Fixed Position Below Panels */}
          <div className="w-full px-0 sm:px-4 py-4 sm:py-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Add Entry
                  </h3>
                  <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setEntryTab('standard')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                        entryTab === 'standard'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => setEntryTab('intelligent')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                        entryTab === 'intelligent'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      Intelligent
                    </button>
                  </div>
                </div>
                

                <div>
                  {entryTab === 'standard' ? (
                    <StandardEntry
                      projectId={id || ''}
                      onSuccess={() => {
                        silentRefresh();
                      }}
                    />
                  ) : (
                    <IntelligentEntry
                      projectId={id || ''}
                      entryType={project.entryTypes[0] || 'akra'}
                      onSuccess={() => {
                        silentRefresh();
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Entry Forms Bar - Mobile Only */}
      <div className="sm:hidden">
        <EntryFormsBar
          projectId={id || ''}
          entryType={project?.entryTypes?.[0] || 'akra'}
          onEntryAdded={handleEntryAdded}
        />
      </div>

    </>
  );
};

export default UserDashboard;
