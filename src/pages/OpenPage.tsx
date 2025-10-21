import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProjectHeader from '../components/ProjectHeader';
import EntryPanel from '../components/EntryPanel';
import FloatingActionButton from '../components/FloatingActionButton';
import NumberGrid from '../components/NumberGrid';
import FilterTab from '../components/FilterTab';
import TransactionModal from '../components/TransactionModal';
import LoadingSpinner from '../components/LoadingSpinner';
import PremiumStats from '../components/PremiumStats';
import StatisticsGrid from '../components/StatisticsGrid';
import { useTransactions } from '../hooks/useTransactions';
import { useHistory } from '../hooks/useHistory';
import { useUserBalance } from '../hooks/useUserBalance';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';
import { db } from '../services/database';
import { formatDate } from '../utils/helpers';
import { exportTransactionsToExcel, importTransactionsFromExcel } from '../utils/excelHandler';
import { customAlertSuccess, customAlertError, customAlertWarning } from '../utils/customPopups';
import type { Transaction } from '../types';

const OpenPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'entries' | 'filter'>('entries');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());
  const [modalNumber, setModalNumber] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entryPanelOpen, setEntryPanelOpen] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  
  // Load project from database
  useEffect(() => {
    const loadProject = async () => {
      if (!id) return;
      
      // Reset project and loading state when id changes
      setProject(null);
      setProjectLoading(true);
      
      try {
        const projectData = await db.getProject(id);
        setProject(projectData);
      } catch (error) {
        console.error('Error loading project:', error);
        setProject(null);
      } finally {
        setProjectLoading(false);
      }
    };

    loadProject();
  }, [id]);
  
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
      } else if (action.type === 'filter' && action.data?.transactionIds) {
        // Revert filter deductions by deleting the created deduction transactions
        for (const transactionId of action.data.transactionIds) {
          await deleteTransaction(transactionId);
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
      } else if (action.type === 'filter' && action.data?.transactions) {
        // Redo filter deductions by re-adding the deduction transactions
        for (const transaction of action.data.transactions) {
          await addTransaction(transaction);
        }
        refresh();
      }
    },
  });

  // Group transactions by number
  const summaries = useMemo(
    () => groupTransactionsByNumber(transactions, 'open'),
    [transactions]
  );

  // Calculate Open-specific statistics
  const openStats = useMemo(() => {
    const openTransactions = transactions.filter(t => t.entryType === 'open');
    const firstTotal = openTransactions.reduce((sum, t) => sum + t.first, 0);
    const secondTotal = openTransactions.reduce((sum, t) => sum + t.second, 0);
    
    // Calculate unique numbers properly handling bulk entries
    const uniqueNumbersSet = new Set<string>();
    openTransactions.forEach(t => {
      const isBulkEntry = t.number.includes(',') || t.number.includes(' ');
      if (isBulkEntry) {
        const numbers = t.number.split(/[,\s]+/).filter(n => n.trim().length > 0);
        numbers.forEach(num => uniqueNumbersSet.add(num.trim()));
      } else {
        uniqueNumbersSet.add(t.number);
      }
    });

    return {
      totalEntries: openTransactions.length,
      akraEntries: 0, // Not relevant for Open page
      ringEntries: 0, // Not relevant for Open page
      firstTotal,
      secondTotal,
      uniqueNumbers: uniqueNumbersSet.size,
    };
  }, [transactions]);

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
    // Store current transactions count to find new ones after adding
    const beforeCount = transactions.length;
    const affectedNumbers: string[] = [];
    const deductionTransactions: Omit<Transaction, 'id'>[] = [];
    
    for (const deduction of deductions) {
      const transactionData: Omit<Transaction, 'id'> = {
        projectId: id || '',
        number: deduction.number,
        entryType: 'open',
        first: -deduction.firstAmount, // Negative to deduct
        second: -deduction.secondAmount, // Negative to deduct
        notes: 'Filter deduction',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isFilterDeduction: true,
      };

      deductionTransactions.push(transactionData);
      affectedNumbers.push(deduction.number);

      const success = await addTransaction(transactionData);
      if (!success) {
        console.error('Failed to add filter transaction');
        return;
      }
    }
    
    refresh();
    
    // Get the newly created transactions for undo/redo
    setTimeout(() => {
      const newTransactions = transactions.slice(beforeCount);
      const filterTransactions = newTransactions.filter(t => 
        t.entryType === 'open' && 
        t.isFilterDeduction &&
        affectedNumbers.includes(t.number)
      );
      
      addAction('filter', `Applied filter deductions to ${deductions.length} number(s)`, affectedNumbers, {
        transactions: deductionTransactions as Transaction[],
        transactionIds: filterTransactions.map(t => t.id),
      });
    }, 50);
  };

  const handleEdit = async (transaction: Transaction) => {
    // Find the original transaction before updating
    const originalTransaction = transactions.find(t => t.id === transaction.id);
    if (!originalTransaction) {
      console.error('Original transaction not found');
      return;
    }

    // Update the transaction
    const success = await updateTransaction(transaction.id, transaction);
    if (success) {
      // Parse numbers for bulk entries
      const isBulkEntry = transaction.number.includes(',') || transaction.number.includes(' ');
      const affectedNumbers = isBulkEntry 
        ? transaction.number.split(/[,\s]+/).map(n => n.trim())
        : [transaction.number];

      // Add to history with proper data for undo/redo
      addAction('edit', `Edited transaction for ${transaction.number}`, affectedNumbers, {
        transactionId: transaction.id,
        originalTransaction,
        updatedTransaction: transaction,
      });
      
      refresh();
      // Refresh the modal by closing and reopening
      setModalNumber(null);
      setTimeout(() => setModalNumber(transaction.number), 100);
    }
  };

  const handleExport = () => {
    const openTransactions = transactions.filter(t => t.entryType === 'open');
    if (openTransactions.length === 0) {
      customAlertWarning('No Open transactions to export!');
      return;
    }
    exportTransactionsToExcel(openTransactions, `${project?.name || 'Project'}-Open`);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await importTransactionsFromExcel(file, id || '', 'open');

      if (result.success && result.transactions.length > 0) {
        for (const t of result.transactions) {
          await addTransaction(t);
        }
        customAlertSuccess(`Successfully imported ${result.transactions.length} Open transaction(s)!`);
        refresh();
      }

      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors);
        customAlertWarning(`Import completed with ${result.errors.length} error(s). Check console for details.`);
      }

      if (result.transactions.length === 0 && result.errors.length === 0) {
        customAlertWarning('No Open transactions found in the file.');
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

  // Show loading state while loading or when project is still loading
  if (loading || projectLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <ProjectHeader
          projectName={project?.name || 'Loading...'}
          projectDate={project ? formatDate(project.date) : ''}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner text="Loading Open data..." />
        </div>
      </div>
    );
  }

  // Show not found only after loading is complete and project is still null
  if (!projectLoading && !project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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

  // Redirect if project doesn't support Open
  if (!project.entryTypes?.includes('open')) {
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

      {/* Page Header */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Open (1-digit Numbers)
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage entries for numbers 0-9
          </p>
        </div>

        {/* Open Statistics */}
        <div className="mb-8">
          <StatisticsGrid
            statistics={openStats}
            entryType="open"
          />
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

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search numbers (e.g., 1, 3, 7)"
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
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Tab Content - Full Width */}
      {activeTab === 'entries' ? (
        <div className="w-full">
          {/* Premium Statistics */}
          <div className="px-4 sm:px-6 lg:px-8 mb-6">
            <PremiumStats 
              summaries={summaries}
              selectedNumbers={selectedNumbers}
              showSelected={selectionMode && selectedNumbers.size > 0}
            />
          </div>

          {/* Number Grid - Full Width with proper padding */}
          <div className="px-4 sm:px-6 lg:px-8">
            <NumberGrid
              summaries={summaries}
              entryType="open"
              onNumberClick={handleNumberClick}
              searchQuery={searchQuery}
              selectedNumbers={selectedNumbers}
              onSelectionChange={setSelectedNumbers}
              selectionMode={selectionMode}
            />
          </div>
        </div>
      ) : (
        <div className="px-4 sm:px-6 lg:px-8">
          <FilterTab 
            summaries={summaries} 
            entryType="open" 
            projectId={id || ''}
            onSaveResults={handleSaveFilterResults}
          />
        </div>
      )}

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
        entryType={'open'}
        onEntryAdded={() => {
          refresh();
          setEntryPanelOpen(false);
        }}
      />

    </div>
  );
};

export default OpenPage;
