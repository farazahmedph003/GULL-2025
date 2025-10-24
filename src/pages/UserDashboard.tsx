import React, { useState, useEffect, useRef } from 'react';
import ProjectHeader from '../components/ProjectHeader';
import StandardEntry from '../components/StandardEntry';
import IntelligentEntry from '../components/IntelligentEntry';
import UserHistoryPanel from '../components/UserHistoryPanel';
import AggregatedNumbersPanel from '../components/AggregatedNumbersPanel';
import EntryFormsBar from '../components/EntryFormsBar';
import LoadingSpinner from '../components/LoadingSpinner';
import EditTransactionModal from '../components/EditTransactionModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { useTransactions } from '../hooks/useTransactions';
import { useUserBalance } from '../hooks/useUserBalance';
import { useNotifications } from '../contexts/NotificationContext';
import { formatDate } from '../utils/helpers';
import { playReloadSound } from '../utils/audioFeedback';
import { importFromCSV } from '../utils/importExport';
import { exportUserTransactionsToPDF } from '../utils/pdfExport';
import type { Project, EntryType, Transaction } from '../types';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';
import { useSystemSettings } from '../hooks/useSystemSettings';

type TabType = 'all' | 'open' | 'akra' | 'ring' | 'packet';

const UserDashboard: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [entryTab] = useState<'standard' | 'intelligent'>('standard');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
    updateTransaction,
  } = useTransactions('user-scope');
  
  const { refresh: refreshBalance } = useUserBalance();
  const { entriesEnabled, refresh: refreshSettings } = useSystemSettings();
  
  // Comprehensive refresh function
  const refresh = () => {
    console.log('🔄 Refreshing transactions and balance...');
    console.log('📊 Current transactions count:', transactions.length);
    playReloadSound();
    refreshTransactions();
    refreshBalance();
  };
  
  // Silent refresh without sound for background updates
  const silentRefresh = () => {
    refreshTransactions();
    refreshBalance();
  };

  // const statistics = getStatistics();

  // Filter tab entry type state removed; not used in this view
  // Removed unused filter summaries to satisfy strict unused checks

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

  // Removed unused handleFilterSaveForType to satisfy strict unused checks

  // Projectless: set a virtual project for UI titles only
  useEffect(() => {
    setProject({ id: 'virtual', name: 'User Dashboard', date: new Date().toISOString(), entryTypes: ['open','akra','ring','packet'], createdAt: '', updatedAt: '' });
    setLoading(false);
  }, []);

  // Keyboard shortcuts removed for regular users

  const handleEntryAdded = () => {
    console.log('🔄 Entry added, refreshing...');
    refresh();
  };

  const handleEditSave = async (updatedTransaction: Transaction) => {
    if (!editingTransaction) return;

    try {
      // Update transaction (updateTransaction will handle balance adjustments automatically)
      await updateTransaction(editingTransaction.id, updatedTransaction);
      
      setEditingTransaction(null);
      silentRefresh();
      showSuccess('Success', 'Transaction updated successfully');
    } catch (error) {
      console.error('Edit error:', error);
      showError('Error', 'Failed to update transaction');
    }
  };

  const handleDelete = async () => {
    if (!deletingTransaction) return;

    try {
      setIsDeleting(true);

      // Delete the transaction (deleteTransaction will handle balance refund automatically)
      await deleteTransaction(deletingTransaction.id);
      
      setDeletingTransaction(null);
      silentRefresh();
      showSuccess('Success', 'Transaction deleted successfully and balance refunded');
    } catch (error) {
      console.error('Delete error:', error);
      showError('Error', 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export handlers
  const handleExportPDF = async () => {
    if (!project) return;
    try {
      await exportUserTransactionsToPDF(transactions, project.name);
      showSuccess('Export Successful', `Exported ${transactions.length} transactions to PDF`);
    } catch (error) {
      console.error('PDF export error:', error);
      showError('Export Failed', 'Failed to export transactions to PDF');
    }
  };

  // Import handlers
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        
        // Check if it's an aggregated export (has 'data' array) or regular transaction export (has 'transactions' array)
        if (jsonData.data && Array.isArray(jsonData.data)) {
          // Aggregated JSON format
          const entryType = jsonData.entryType || 'akra';
          let importedCount = 0;
          
          for (const item of jsonData.data) {
            if (item.first > 0 || item.second > 0) {
              await addTransaction({
                number: item.number,
                entryType: entryType,
                first: item.first || 0,
                second: item.second || 0,
                projectId: 'user-scope',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              importedCount++;
            }
          }
          
          await showSuccess('Import Successful', `Imported ${importedCount} aggregated numbers from JSON`);
          refresh();
        } else if (jsonData.transactions && Array.isArray(jsonData.transactions)) {
          // Regular transaction format
          for (const transaction of jsonData.transactions) {
            await addTransaction({
              ...transaction,
              projectId: 'user-scope',
            });
          }
          await showSuccess('Import Successful', `Imported ${jsonData.transactions.length} transactions from JSON`);
          refresh();
        } else {
          showError('Invalid Format', 'JSON file format not recognized');
        }
      } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        // Check if it's aggregated CSV (has headers: Number, Entry Type, First Amount, etc.)
        if (lines[0].includes('Entry Type') && lines[0].includes('First Amount')) {
          // Aggregated CSV format from Excel export
          let importedCount = 0;
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('TOTAL')) break; // Skip TOTAL row
            
            const parts = line.split(',');
            if (parts.length >= 4) {
              const number = parts[0].trim();
              const entryType = parts[1].trim().toLowerCase();
              const first = parseFloat(parts[2]) || 0;
              const second = parseFloat(parts[3]) || 0;
              
              if (first > 0 || second > 0) {
                await addTransaction({
                  number,
                  entryType: entryType as any,
                  first,
                  second,
                  projectId: 'user-scope',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                importedCount++;
              }
            }
          }
          
          await showSuccess('Import Successful', `Imported ${importedCount} numbers from Excel CSV`);
          refresh();
        } else {
          // Regular CSV format
          const importedTransactions = await importFromCSV(file, 'user-scope');
          for (const transaction of importedTransactions) {
            await addTransaction(transaction);
          }
          await showSuccess('Import Successful', `Imported ${importedTransactions.length} transactions from CSV`);
          refresh();
        }
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
  ];

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
        showTabs={true}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as TabType)}
        showBackButton={false}
        variant="user"
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20 sm:pb-0">
        <div className="w-full px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
          
          {/* Page Header */}
          <div className="mb-6 sm:mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                📊 {project.name}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Track your entries with real-time calculations</p>
            </div>
            <button
              onClick={() => {
                refresh();
              }}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg text-sm sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>


          {/* Statistics Summary - only for entry-specific tabs (open/akra/ring/packet). None on ALL or FILTER */}
          {(['open','akra','ring','packet'] as EntryType[]).includes(activeTab as EntryType) && (
            (() => {
              const s = computeTypeStats(activeTab as EntryType);
              return (
                <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-700 dark:text-gray-100">FIRST PKR TOTAL</h3>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-300">PKR {s.firstTotal.toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-700 dark:text-gray-100">SECOND PKR TOTAL</h3>
                    <p className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-300">PKR {s.secondTotal.toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-700 dark:text-gray-100">TOTAL PKR</h3>
                    <p className="text-lg sm:text-2xl font-bold text-cyan-600 dark:text-cyan-300">PKR {(s.totalPkr).toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-700 dark:text-gray-100">UNIQUE NUMBER</h3>
                    <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-300">{s.uniqueNumbers}</p>
                  </div>
                </div>
              );
            })()
          )}

          {/* Content Panels */}
          {
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Left Panel - Aggregated Numbers */}
              <AggregatedNumbersPanel
                transactions={transactions}
                activeTab={(activeTab as any) as 'all' | 'open' | 'akra' | 'ring' | 'packet'}
                projectEntryTypes={project.entryTypes}
                onImport={handleImportClick}
                onExportPDF={handleExportPDF}
              />

              {/* Right Panel - Complete History (Entries + Top-ups + Admin Actions) */}
              <UserHistoryPanel 
                transactions={transactions}
                activeTab={activeTab}
                onEdit={(t) => setEditingTransaction(t)}
                onDelete={(transactionId) => {
                  const transaction = transactions.find(t => t.id === transactionId);
                  if (transaction) {
                    setDeletingTransaction(transaction);
                  }
                }}
              />
            </div>
          }

          {/* Entry Panel - hidden on Filter tab */}
          {
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
                    {!entriesEnabled ? (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-yellow-800 dark:text-yellow-200">
                        <div className="flex items-center justify-between">
                          <span>Entries are temporarily disabled by admin.</span>
                          <button
                            onClick={() => {
                              console.log('🔄 Force refreshing system settings...');
                              refreshSettings();
                            }}
                            className="ml-4 px-3 py-1 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded text-sm hover:bg-yellow-300 dark:hover:bg-yellow-700"
                          >
                            Refresh
                          </button>
                        </div>
                      </div>
                    ) : entryTab === 'standard' ? (
                      <StandardEntry
                        projectId={'user-scope'}
                        addTransaction={addTransaction}
                        onSuccess={() => {
                          console.log('✅ StandardEntry onSuccess called');
                          // Parent state is already updated via addTransaction. Keep a light refresh to sync balances.
                          refreshBalance();
                        }}
                      />
                    ) : (
                      <IntelligentEntry
                        projectId={'user-scope'}
                        entryType={project.entryTypes[0] || 'akra'}
                        onSuccess={() => {
                          console.log('✅ IntelligentEntry onSuccess called');
                          refresh();
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      {/* Entry Forms Bar - Mobile Only */}
      <div className="sm:hidden">
        <EntryFormsBar
          projectId={'user-scope'}
          entryType={project?.entryTypes?.[0] || 'akra'}
          addTransaction={addTransaction}
          onEntryAdded={handleEntryAdded}
        />
      </div>

      {/* Edit Modal */}
      {editingTransaction && (
        <EditTransactionModal
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          transaction={editingTransaction}
          onSave={handleEditSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTransaction && (
        <DeleteConfirmationModal
          isOpen={!!deletingTransaction}
          onClose={() => setDeletingTransaction(null)}
          onConfirm={handleDelete}
          title="Delete Transaction"
          message="Are you sure you want to delete this transaction?"
          itemName={`Number: ${deletingTransaction.number} (${deletingTransaction.entryType})`}
          isLoading={isDeleting}
        />
      )}

    </>
  );
};

export default UserDashboard;
