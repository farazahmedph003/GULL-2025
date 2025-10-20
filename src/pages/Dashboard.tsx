import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProjectHeader from '../components/ProjectHeader';
import StatisticsGrid from '../components/StatisticsGrid';
import EntryPanel from '../components/EntryPanel';
import FloatingActionButton from '../components/FloatingActionButton';
import LoadingSpinner from '../components/LoadingSpinner';
import ProgressBar from '../components/ProgressBar';
import { useTransactions } from '../hooks/useTransactions';
import { useHistory } from '../hooks/useHistory';
import { useUserBalance } from '../hooks/useUserBalance';
import { db } from '../services/database';
import { formatDate } from '../utils/helpers';
import type { EntryType, Project } from '../types';

const Dashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryPanelOpen, setEntryPanelOpen] = useState(false);
  const [selectedEntryType, setSelectedEntryType] = useState<EntryType>('akra');

  const { 
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
        setSelectedEntryType(projectData.entryTypes[0] || 'akra');
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
          undo();
        }
      }
      
      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
      }
      
      // Ctrl/Cmd + / to toggle entry panel
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setEntryPanelOpen(prev => !prev);
      }
      
      // Ctrl/Cmd + H to toggle history panel
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  // Tabs moved to sidebar menu

  const handleEntryAdded = () => {
    refresh();
  };

  const handleCardClick = (type: 'first' | 'second' | 'entries' | 'unique') => {
    console.log('Card clicked:', type);
    // Navigate to appropriate view
  };

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner text="Loading project..." />
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Project not found
          </h2>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <ProjectHeader
        projectName={project.name}
        projectDate={formatDate(project.date)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onRefresh={refresh}
        projectId={id}
      />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="px-4 py-4">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Project Overview
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Track your {project.entryTypes.join(' and ')} entries with real-time calculations
            </p>
          </div>

          {/* Statistics Grid */}
          <div className="mb-8">
            <StatisticsGrid
              statistics={statistics}
              onCardClick={handleCardClick}
            />
          </div>

          {/* Progress Section */}
          <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Akra Progress */}
          {project.entryTypes.includes('akra') && (
            <div className="relative bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50/20 via-blue-50/10 to-indigo-50/20 dark:from-purple-900/10 dark:via-blue-900/5 dark:to-indigo-900/10 rounded-2xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 text-white rounded-xl shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Akra (2-digit) Progress
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Track your 2-digit entries</p>
                  </div>
                </div>
                
                <ProgressBar
                  value={statistics.akraEntries}
                  max={100}
                  label="Entries"
                  color="secondary"
                  size="lg"
                />
                <div className="mt-4 flex justify-between items-center text-sm bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-100 dark:border-purple-800/30">
                  <span className="font-medium text-purple-700 dark:text-purple-300">
                    {statistics.akraEntries} entries
                  </span>
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">
                    Max: 100
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Ring Progress */}
          {project.entryTypes.includes('ring') && (
            <div className="relative bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-teal-50/20 via-cyan-50/10 to-blue-50/20 dark:from-teal-900/10 dark:via-cyan-900/5 dark:to-blue-900/10 rounded-2xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-xl shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Ring (3-digit) Progress
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Track your 3-digit entries</p>
                  </div>
                </div>
                
                <ProgressBar
                  value={statistics.ringEntries}
                  max={1000}
                  label="Entries"
                  color="accent"
                  size="lg"
                />
                <div className="mt-4 flex justify-between items-center text-sm bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 border border-teal-100 dark:border-teal-800/30">
                  <span className="font-medium text-teal-700 dark:text-teal-300">
                    {statistics.ringEntries} entries
                  </span>
                  <span className="text-teal-600 dark:text-teal-400 font-semibold">
                    Max: 1000
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>


          {/* Quick Actions */}
          <div className="relative bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-purple-50/10 to-indigo-50/20 dark:from-blue-900/10 dark:via-purple-900/5 dark:to-indigo-900/10 rounded-2xl"></div>
            
            <div className="relative z-10">
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-xl shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Quick Actions</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manage your entries efficiently</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
              {project.entryTypes?.includes('akra') && (
                <button
                  onClick={() => {
                    setSelectedEntryType('akra');
                    setEntryPanelOpen(true);
                  }}
                  className="group p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700 rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-white">Add Akra</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">2-digit entry</p>
                    </div>
                  </div>
                </button>
              )}

              {project.entryTypes?.includes('ring') && (
                <button
                  onClick={() => {
                    setSelectedEntryType('ring');
                    setEntryPanelOpen(true);
                  }}
                  className="group p-6 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border border-teal-200 dark:border-teal-700 rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-white">Add Ring</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">3-digit entry</p>
                    </div>
                  </div>
                </button>
              )}

              {project.entryTypes?.includes('akra') && (
                <button
                  onClick={() => navigate(`/project/${id}/akra`)}
                  className="group p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-white">View Akra</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">See all numbers</p>
                    </div>
                  </div>
                </button>
              )}

              {project.entryTypes?.includes('ring') && (
                <button
                  onClick={() => navigate(`/project/${id}/ring`)}
                  className="group p-6 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-700 rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-white">View Ring</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">See all numbers</p>
                    </div>
                  </div>
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <FloatingActionButton
        onClick={() => setEntryPanelOpen(true)}
        position="bottom-right"
        color="secondary"
        label="Add Entry (Ctrl+/)"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        }
      />


      {/* Entry Panel */}
      <EntryPanel
        isOpen={entryPanelOpen}
        onClose={() => setEntryPanelOpen(false)}
        projectId={id || ''}
        entryType={selectedEntryType === 'akra' ? 'akra' : selectedEntryType === 'ring' ? 'ring' : 'akra'}
        onEntryAdded={handleEntryAdded}
      />

    </>
  );
};

export default Dashboard;
