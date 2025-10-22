import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProjectHeader from '../components/ProjectHeader';
import StandardEntry from '../components/StandardEntry';
import IntelligentEntry from '../components/IntelligentEntry';
import FilterTab from '../components/FilterTab';
import EntryHistoryPanel from '../components/EntryHistoryPanel';
import AggregatedNumbersPanel from '../components/AggregatedNumbersPanel';
import EntryFormsBar from '../components/EntryFormsBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTransactions } from '../hooks/useTransactions';
import { useHistory } from '../hooks/useHistory';
import { useUserBalance } from '../hooks/useUserBalance';
import { useNotifications } from '../contexts/NotificationContext';
// import { useAuth } from '../contexts/AuthContext';
// import { isAdminEmail } from '../config/admin';
import { db } from '../services/database';
import { formatDate } from '../utils/helpers';
import { playReloadSound, playUndoSound, playRedoSound } from '../utils/audioFeedback';
import { exportToJSON, exportToCSV, importFromJSON, importFromCSV } from '../utils/importExport';
import type { Project, EntryType } from '../types';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';

type TabType = 'all' | 'open' | 'akra' | 'ring' | 'packet' | 'filter';

const UserDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [entryTab] = useState<'standard' | 'intelligent'>('standard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useNotifications();
  // const { user } = useAuth();
  // const isActualAdmin = user ? isAdminEmail(user.email) : false;

  const { 
    transactions,
    refresh: refreshTransactions, 
    getStatistics: _getStatistics, 
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
  
  // Silent refresh without sound for background updates
  const silentRefresh = () => {
    refreshTransactions();
    refreshBalance();
  };
  
  const {
    canUndo,
    canRedo,
    undo,
    redo,
    addAction,
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

  // const statistics = getStatistics();

  // Filter tab entry type state and summaries
  const [filterEntryType, setFilterEntryType] = useState<EntryType>('akra');
  useEffect(() => {
    if (project?.entryTypes?.length) {
      setFilterEntryType((project.entryTypes[0] as EntryType) || 'open');
    }
  }, [project]);
  const filterSummaries = React.useMemo(() => groupTransactionsByNumber(transactions, filterEntryType), [transactions, filterEntryType]);

  // Compute per-type stats for header boxes
  const computeTypeStats = (type: EntryType) => {
    const filtered = transactions.filter(t => t.entryType === type);
    const firstTotal = filtered.reduce((sum, t) => sum + (t.first || 0), 0);
    const secondTotal = filtered.reduce((sum, t) => sum + (t.second || 0), 0);
    // Unique numbers leveraging grouping (handles bulk entries correctly)
    const summaries = groupTransactionsByNumber(transactions, type);
    const uniqueNumbers = summaries.size;
    return {
      firstTotal,
      secondTotal,
      totalPkr: firstTotal + secondTotal,
      uniqueNumbers,
    };
  };

  const handleFilterSaveForType = async (entryType: EntryType, deductions: Array<{ number: string; firstAmount: number; secondAmount: number }>) => {
    // Store current transactions count to find new ones after adding
    const beforeCount = transactions.length;
    const affectedNumbers: string[] = [];
    const created: any[] = [];

    for (const d of deductions) {
      const tx = {
        projectId: id || '',
        number: d.number,
        entryType,
        first: d.firstAmount ? -d.firstAmount : 0,
        second: d.secondAmount ? -d.secondAmount : 0,
        notes: 'Filter deduction',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isFilterDeduction: true,
      } as any;
      const ok = await addTransaction(tx);
      if (!ok) throw new Error('Failed to save some deductions');
      created.push(tx);
      affectedNumbers.push(d.number);
    }

    // Refresh and capture IDs for history
    await refresh();
    setTimeout(() => {
      const newTransactions = transactions.slice(beforeCount);
      const filterTransactions = newTransactions.filter(t => t.entryType === entryType && t.isFilterDeduction && affectedNumbers.includes(t.number));
      addAction('filter', `Applied filter deductions to ${deductions.length} number(s)`, affectedNumbers, {
        transactions: created as any,
        transactionIds: filterTransactions.map(t => t.id),
      });
    }, 50);
  };

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
      
      // Removed: entry panel toggle (not needed in this layout)
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handleEntryAdded = () => {
    refresh();
  };

  // Export handlers
  const handleExportJSON = () => {
    if (!project) return;
    exportToJSON(project, transactions);
    showSuccess('Export Successful', `Exported ${transactions.length} transactions to JSON`);
  };

  const handleExportCSV = () => {
    if (!project) return;
    exportToCSV(project, transactions);
    showSuccess('Export Successful', `Exported ${transactions.length} transactions to CSV`);
  };

  // Import handlers
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    try {
      if (file.name.endsWith('.json')) {
        const data = await importFromJSON(file);
        // Import all transactions
        for (const transaction of data.transactions) {
          await addTransaction({
            ...transaction,
            projectId: id,
          });
        }
        await showSuccess('Import Successful', `Imported ${data.transactions.length} transactions from JSON`);
        refresh();
      } else if (file.name.endsWith('.csv')) {
        const importedTransactions = await importFromCSV(file, id);
        // Import all transactions
        for (const transaction of importedTransactions) {
          await addTransaction(transaction);
        }
        await showSuccess('Import Successful', `Imported ${importedTransactions.length} transactions from CSV`);
        refresh();
      } else {
        showError('Invalid File', 'Please select a JSON or CSV file');
      }
    } catch (error) {
      console.error('Import error:', error);
      showError('Import Failed', 'Failed to import transactions. Please check the file format.');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const tabs = [
    { id: 'all' as TabType, label: 'ALL', description: 'All entries' },
    { id: 'open' as TabType, label: 'OPEN', description: 'Open entries' },
    { id: 'akra' as TabType, label: 'AKRA', description: '2-digit entries' },
    { id: 'ring' as TabType, label: 'RING', description: '3-digit entries' },
    { id: 'packet' as TabType, label: 'PACKET', description: 'Packet entries' },
    { id: 'filter' as TabType, label: '🔍 FILTER', description: 'Advanced Filter' },
    { id: 'advanced' as TabType, label: 'ADVANCED', description: 'Advanced Filter & Calculate' },
  ].filter(tab => {
    // Only show tabs for entry types that exist in the project
    if (tab.id === 'all' || tab.id === 'open' || (tab.id as any) === 'filter' || (tab.id as any) === 'advanced') return true;
    return (project?.entryTypes as EntryType[] | undefined)?.includes(tab.id as EntryType);
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
        onTabChange={(tabId) => {
          setActiveTab(tabId as TabType);
        }}
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

          {/* Statistics Summary - only for entry-specific tabs (open/akra/ring/packet). None on ALL or FILTER */}
          {(['open','akra','ring','packet'] as EntryType[]).includes(activeTab as EntryType) && (
            (() => {
              const s = computeTypeStats(activeTab as EntryType);
              return (
                <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <div className="bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-100">FIRST PKR TOTAL</h3>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-300">PKR {s.firstTotal.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-100">SECOND PKR TOTAL</h3>
                    <p className="text-lg sm:text-2xl font-bold text-amber-300">PKR {s.secondTotal.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-100">TOTAL PKR</h3>
                    <p className="text-lg sm:text-2xl font-bold text-cyan-300">PKR {(s.totalPkr).toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-100">UNIQUE NUMBER</h3>
                    <p className="text-lg sm:text-2xl font-bold text-purple-300">{s.uniqueNumbers}</p>
                  </div>
                </div>
              );
            })()
          )}

          {/* Content Panels */}
          {activeTab === ('filter' as TabType) ? (
            <div className="mb-6 sm:mb-8">
              <FilterTab
                summaries={filterSummaries}
                entryType={filterEntryType}
                projectId={id || ''}
                onSaveResults={async () => {}}
                availableEntryTypes={[...(new Set<EntryType>(['open' as EntryType, ...(project.entryTypes as EntryType[])]))]}
                onEntryTypeChange={(t) => setFilterEntryType(t)}
                onSaveResultsForType={handleFilterSaveForType}
              />
            </div>
          ) : activeTab === ('advanced' as TabType) ? (
            <div className="mb-6 sm:mb-8">
              {/* Inline AdvancedFilter: two panels side-by-side via existing component */}
              {/* Prefer navigation-like behavior through tabs; using component keeps layout consistent */}
              {/* We render the separate AdvancedFilter page content is heavy; for now, just link */}
              <div className="text-gray-300">
                Use the dedicated Advanced Filter page from the sidebar previously; now open via this tab.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Left Panel - Entry History */}
              <EntryHistoryPanel
                transactions={transactions}
                activeTab={(activeTab as any) as 'all' | 'open' | 'akra' | 'ring' | 'packet'}
                projectEntryTypes={project.entryTypes}
                onEdit={async (t) => {
                  const firstStr = prompt('Update FIRST amount', String(t.first));
                  const secondStr = prompt('Update SECOND amount', String(t.second));
                  if (firstStr === null || secondStr === null) return;
                  const updated = { ...t, first: Number(firstStr), second: Number(secondStr) };
                  await updateTransaction(t.id, updated);
                  silentRefresh();
                }}
                onDelete={async (idToDelete) => {
                  if (!confirm('Delete this transaction?')) return;
                  await deleteTransaction(idToDelete);
                  silentRefresh();
                }}
              />

              {/* Right Panel - Aggregated Numbers */}
              <AggregatedNumbersPanel
                transactions={transactions}
                activeTab={(activeTab as any) as 'all' | 'open' | 'akra' | 'ring' | 'packet'}
                projectEntryTypes={project.entryTypes}
                onImport={handleImportClick}
                onExportJSON={handleExportJSON}
                onExportCSV={handleExportCSV}
              />
            </div>
          )}

          {/* Entry Panel - hidden on Filter tab */}
          {activeTab !== ('filter' as TabType) && (
            <div className="w-full px-0 sm:px-4 py-4 sm:py-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Add Entry
                    </h3>
                  </div>
                  {/* Hidden file input for imports (buttons moved to Aggregated panel) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv"
                    onChange={handleFileImport}
                    className="hidden"
                  />
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
          )}
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
