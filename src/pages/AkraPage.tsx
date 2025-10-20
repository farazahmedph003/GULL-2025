import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProjectHeader from '../components/ProjectHeader';
import EntryPanel from '../components/EntryPanel';
import FloatingActionButton from '../components/FloatingActionButton';
import NumberGrid from '../components/NumberGrid';
import FilterTab from '../components/FilterTab';
import TransactionModal from '../components/TransactionModal';
import LoadingSpinner from '../components/LoadingSpinner';
import PremiumStats from '../components/PremiumStats';
import { useTransactions } from '../hooks/useTransactions';
import { useHistory } from '../hooks/useHistory';
import { useUserBalance } from '../hooks/useUserBalance';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';
import { getProject } from '../utils/storage';
import { formatDate } from '../utils/helpers';
import { exportTransactionsToExcel, importTransactionsFromExcel } from '../utils/excelHandler';
import { customAlertSuccess, customAlertError, customAlertWarning } from '../utils/customPopups';
import type { Transaction } from '../types';

const AkraPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'entries' | 'filter'>('entries');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());
  const [modalNumber, setModalNumber] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entryPanelOpen, setEntryPanelOpen] = useState(false);
  
  const project = getProject(id || '');
  const { 
    transactions, 
    loading, 
    refresh: refreshTransactions, 
    deleteTransaction,
    bulkDeleteTransactions,
    updateTransaction, 
    addTransaction,
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
    addAction 
  } = useHistory(id || '', {
    onRevert: async (action) => {
      if (action.type === 'add' && action.data?.transactionId) {
        await deleteTransaction(action.data.transactionId);
        refresh();
      } else if (action.type === 'delete' && action.data?.transaction) {
        await addTransaction(action.data.transaction);
        refresh();
      } else if (action.type === 'edit' && action.data?.originalTransaction) {
        await updateTransaction(action.data.transactionId, action.data.originalTransaction);
        refresh();
      } else if (action.type === 'batch' && action.data?.transactions) {
        for (const t of action.data.transactions) {
          await addTransaction(t);
        }
        refresh();
      }
    },
    onApply: async (action) => {
      if (action.type === 'add' && action.data?.transaction) {
        await addTransaction(action.data.transaction);
        refresh();
      } else if (action.type === 'delete' && action.data?.transactionId) {
        await deleteTransaction(action.data.transactionId);
        refresh();
      } else if (action.type === 'edit' && action.data?.updatedTransaction) {
        await updateTransaction(action.data.transactionId, action.data.updatedTransaction);
        refresh();
      } else if (action.type === 'batch' && action.data?.transactionIds) {
        await bulkDeleteTransactions(action.data.transactionIds);
        refresh();
      }
    },
  });

  // Group transactions by number
  const summaries = useMemo(
    () => groupTransactionsByNumber(transactions, 'akra'),
    [transactions]
  );

  // Tabs moved to sidebar menu

  const handleNumberClick = (number: string) => {
    setModalNumber(number);
  };

  const handleDelete = async (transactionId: string) => {
    if (await deleteTransaction(transactionId)) {
      addAction('delete', `Deleted transaction`, []);
      refresh();
    }
  };

  const handleSaveFilterResults = async (deductions: Array<{ number: string; firstAmount: number; secondAmount: number }>) => {
    // Create negative transactions for each deduction
    const transactionIds: string[] = [];
    const affectedNumbers: string[] = [];
    
    for (const deduction of deductions) {
      const success = await addTransaction({
        projectId: id || '',
        number: deduction.number,
        entryType: 'akra',
        first: -deduction.firstAmount, // Negative to deduct
        second: -deduction.secondAmount, // Negative to deduct
        notes: 'Filter deduction',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isFilterDeduction: true,
      });
      if (success) {
        transactionIds.push(`deduction-${Date.now()}-${Math.random()}`);
      }
      affectedNumbers.push(deduction.number);
    }
    
    addAction('filter', `Applied filter deductions to ${deductions.length} number(s)`, affectedNumbers);
    refresh();
  };

  const handleEdit = (transaction: Transaction) => {
    if (updateTransaction(transaction.id, transaction)) {
      addAction('edit', `Edited transaction for ${transaction.number}`, [transaction.number]);
      refresh();
      // Refresh the modal by closing and reopening
      setModalNumber(null);
      setTimeout(() => setModalNumber(transaction.number), 100);
    }
  };


  const handleExport = () => {
    const akraTransactions = transactions.filter(t => t.entryType === 'akra');
    if (akraTransactions.length === 0) {
      customAlertWarning('No Akra transactions to export!');
      return;
    }
    exportTransactionsToExcel(akraTransactions, `${project?.name || 'Project'}-Akra`);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await importTransactionsFromExcel(file, id || '', 'akra');

      if (result.success && result.transactions.length > 0) {
        for (const t of result.transactions) {
          await addTransaction(t);
        }
        customAlertSuccess(`Successfully imported ${result.transactions.length} Akra transaction(s)!`);
        refresh();
      }

      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors);
        customAlertWarning(`Import completed with ${result.errors.length} error(s). Check console for details.`);
      }

      if (result.transactions.length === 0 && result.errors.length === 0) {
        customAlertWarning('No Akra transactions found in the file.');
      }
    } catch (error) {
      console.error('Error importing file:', error);
      customAlertError('Failed to import file. Please make sure it\'s a valid Excel file.');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const modalSummary = modalNumber ? summaries.get(modalNumber) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <ProjectHeader
          projectName={project?.name || 'Loading...'}
          projectDate={project ? formatDate(project.date) : ''}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner text="Loading Akra data..." />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Project not found
            </h2>
          </div>
        </div>
      </div>
    );
  }

  // Redirect if project doesn't support Akra
  if (!project.entryTypes?.includes('akra')) {
    navigate(`/project/${id}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Akra (2-digit Numbers)
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage entries for numbers 00-99
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('entries')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'entries'
                ? 'text-secondary border-b-2 border-secondary'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Entries & Totals
          </button>
          <button
            onClick={() => setActiveTab('filter')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'filter'
                ? 'text-secondary border-b-2 border-secondary'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Filter & Calculate
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'entries' ? (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search numbers (e.g., 01, 1*, *5)"
                  className="input-field"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleImport}
                  className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <svg
                    className="w-5 h-5 inline mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  📥 Import CSV
                </button>

                <button
                  onClick={handleExport}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <svg
                    className="w-5 h-5 inline mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  📤 Export CSV
                </button>
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Premium Statistics */}
            <PremiumStats 
              summaries={summaries}
              selectedNumbers={selectedNumbers}
              showSelected={selectionMode && selectedNumbers.size > 0}
            />

            {/* Number Grid */}
            <NumberGrid
              summaries={summaries}
              entryType="akra"
              onNumberClick={handleNumberClick}
              searchQuery={searchQuery}
              selectedNumbers={selectedNumbers}
              onSelectionChange={setSelectedNumbers}
              selectionMode={selectionMode}
            />
          </div>
        ) : (
          <FilterTab 
            summaries={summaries} 
            entryType="akra" 
            projectId={id || ''}
            onSaveResults={handleSaveFilterResults}
          />
        )}
      </div>

      {/* Transaction Modal */}
      {modalSummary && (
        <TransactionModal
          isOpen={!!modalNumber}
          onClose={() => setModalNumber(null)}
          summary={modalSummary}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      {/* Floating Add Entry Button */}
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
        entryType={'akra'}
        onEntryAdded={() => {
          refresh();
          setEntryPanelOpen(false);
        }}
      />

    </div>
  );
};

export default AkraPage;
