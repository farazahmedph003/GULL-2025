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

      <Layout>

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Akra Progress */}
          {project.entryTypes.includes('akra') && (
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Akra (2-digit) Progress
              </h3>
              <ProgressBar
                value={statistics.akraEntries}
                max={100}
                label="Entries"
                color="secondary"
                size="lg"
              />
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {statistics.akraEntries} entries
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  Max: 100
                </span>
              </div>
            </div>
          )}

          {/* Ring Progress */}
          {project.entryTypes.includes('ring') && (
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Ring (3-digit) Progress
              </h3>
              <ProgressBar
                value={statistics.ringEntries}
                max={1000}
                label="Entries"
                color="accent"
                size="lg"
              />
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {statistics.ringEntries} entries
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  Max: 1000
                </span>
              </div>
            </div>
          )}
        </div>


        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {project.entryTypes?.includes('akra') && (
              <button
                onClick={() => {
                  setSelectedEntryType('akra');
                  setEntryPanelOpen(true);
                }}
                className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-secondary hover:bg-secondary hover:bg-opacity-5 transition-colors text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-secondary bg-opacity-10 rounded-lg">
                    <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Add Akra</p>
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
                className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-accent hover:bg-accent hover:bg-opacity-5 transition-colors text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-accent bg-opacity-10 rounded-lg">
                    <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Add Ring</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">3-digit entry</p>
                  </div>
                </div>
              </button>
            )}

            {project.entryTypes?.includes('akra') && (
              <button
                onClick={() => navigate(`/project/${id}/akra`)}
                className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-success hover:bg-success hover:bg-opacity-5 transition-colors text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-success bg-opacity-10 rounded-lg">
                    <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">View Akra</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">See all numbers</p>
                  </div>
                </div>
              </button>
            )}

            {project.entryTypes?.includes('ring') && (
              <button
                onClick={() => navigate(`/project/${id}/ring`)}
                className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-warning hover:bg-warning hover:bg-opacity-5 transition-colors text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-warning bg-opacity-10 rounded-lg">
                    <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">View Ring</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">See all numbers</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </Layout>

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
        entryType={selectedEntryType}
        onEntryAdded={handleEntryAdded}
      />

    </>
  );
};

export default Dashboard;
