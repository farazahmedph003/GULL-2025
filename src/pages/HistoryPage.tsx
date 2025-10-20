import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProjectHeader from '../components/ProjectHeader';
import { useTransactions } from '../hooks/useTransactions';
import { useHistory } from '../hooks/useHistory';
import { useUserBalance } from '../hooks/useUserBalance';
import { useNotifications } from '../contexts/NotificationContext';
import { useConfirmation } from '../hooks/useConfirmation.tsx';
import { db } from '../services/database';
import { formatDate, formatCurrency, formatTime } from '../utils/helpers';
import { exportTransactionsToExcel, importTransactionsFromExcel } from '../utils/excelHandler';
import type { Transaction } from '../types';

interface EditModalProps {
  transaction: Transaction;
  onSave: (transaction: Transaction) => void;
  onCancel: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ transaction, onSave, onCancel }) => {
  const [editedTransaction, setEditedTransaction] = useState(transaction);

  // Parse bulk entries if they exist (comma or space separated)
  const isBulkEntry = transaction.number.includes(',') || transaction.number.includes(' ');
  const numbers = isBulkEntry 
    ? transaction.number.split(/[,\s]+/).filter(n => n.trim()) 
    : [transaction.number];

  const [bulkAmounts, setBulkAmounts] = useState<{ [key: string]: { first: number; second: number } }>(
    numbers.reduce((acc, num) => {
      acc[num] = { 
        first: transaction.first || 0, 
        second: transaction.second || 0 
      };
      return acc;
    }, {} as { [key: string]: { first: number; second: number } })
  );

  const handleSave = () => {
    if (isBulkEntry) {
      // For bulk entries, we'll save the first number's amounts to the transaction
      // In a real scenario, you might want to create separate transactions
      const firstNum = numbers[0];
      onSave({
        ...editedTransaction,
        first: bulkAmounts[firstNum].first,
        second: bulkAmounts[firstNum].second,
      });
    } else {
      onSave(editedTransaction);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">Edit Transaction</h2>
          <p className="text-blue-100 text-sm mt-1">
            {isBulkEntry ? `Bulk Entry: ${numbers.length} numbers` : `Single Entry: ${transaction.number}`}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {isBulkEntry ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Edit amounts for each number in the bulk entry:
              </p>
              {numbers.map((num) => (
                <div key={num} className="card p-4 space-y-3">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                    Number: {num}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        First Amount
                      </label>
                      <input
                        type="number"
                        value={bulkAmounts[num].first}
                        onChange={(e) =>
                          setBulkAmounts({
                            ...bulkAmounts,
                            [num]: { ...bulkAmounts[num], first: Number(e.target.value) },
                          })
                        }
                        className="input w-full text-gray-900 dark:text-gray-100"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Second Amount
                      </label>
                      <input
                        type="number"
                        value={bulkAmounts[num].second}
                        onChange={(e) =>
                          setBulkAmounts({
                            ...bulkAmounts,
                            [num]: { ...bulkAmounts[num], second: Number(e.target.value) },
                          })
                        }
                        className="input w-full text-gray-900 dark:text-gray-100"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Number
                </label>
                <input
                  type="text"
                  value={editedTransaction.number}
                  disabled
                  className="input w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    First Amount
                  </label>
                  <input
                    type="number"
                    value={editedTransaction.first || 0}
                    onChange={(e) =>
                      setEditedTransaction({
                        ...editedTransaction,
                        first: Number(e.target.value),
                      })
                    }
                    className="input w-full text-gray-900 dark:text-gray-100"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Second Amount
                  </label>
                  <input
                    type="number"
                    value={editedTransaction.second || 0}
                    onChange={(e) =>
                      setEditedTransaction({
                        ...editedTransaction,
                        second: Number(e.target.value),
                      })
                    }
                    className="input w-full text-gray-900 dark:text-gray-100"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Entry Type
                </label>
                <input
                  type="text"
                  value={editedTransaction.entryType}
                  disabled
                  className="input w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed capitalize"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-b-2xl">
          <button 
            onClick={onCancel} 
            className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            ❌ Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            💾 Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const HistoryPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  
  // Load project from database
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        setProjectLoading(false);
        return;
      }

      try {
        const projectData = await db.getProject(projectId);
        setProject(projectData);
      } catch (error) {
        console.error('Error loading project:', error);
      } finally {
        setProjectLoading(false);
      }
    };

    loadProject();
  }, [projectId]);
  
  const { 
    transactions, 
    updateTransaction, 
    deleteTransaction,
    bulkDeleteTransactions,
    addTransaction,
    refresh: refreshTransactions 
  } = useTransactions(projectId || '');
  
  const { refresh: refreshBalance } = useUserBalance();
  const { showSuccess, showError, showWarning } = useNotifications();
  const { confirm, ConfirmationComponent } = useConfirmation();
  
  // Comprehensive refresh function
  const refresh = () => {
    refreshTransactions();
    refreshBalance();
  };
  
  const { 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    history: visibleHistory 
  } = useHistory(projectId || '', {
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

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'akra' | 'ring'>('all');
  const [filterEntry, setFilterEntry] = useState<'all' | 'first' | 'second' | 'both'>('all');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Create combined history view with current transactions and deleted transactions
  const combinedHistory = useMemo(() => {
    const historyItems: Array<{
      id: string;
      type: 'added' | 'deleted';
      isBulk: boolean;
      numbers: string[];
      first: number;
      second: number;
      timestamp: string;
      transactionId?: string;
      actionId?: string;
    }> = [];

    // Add current transactions as "added" entries
    transactions.forEach(transaction => {
      const isBulk = transaction.number.includes(',') || transaction.number.includes(' ');
      const numbers = isBulk 
        ? transaction.number.split(/[,\s]+/).filter(n => n.trim()) 
        : [transaction.number];

      historyItems.push({
        id: transaction.id,
        type: 'added',
        isBulk,
        numbers,
        first: transaction.first || 0,
        second: transaction.second || 0,
        timestamp: transaction.createdAt,
        transactionId: transaction.id,
      });
    });

    // Add deleted transactions from history as "deleted" entries
    visibleHistory.forEach(action => {
      if (action.type === 'delete' && action.data?.transaction) {
        const transaction = action.data.transaction;
        const isBulk = transaction.number.includes(',') || transaction.number.includes(' ');
        const numbers = isBulk 
          ? transaction.number.split(/[,\s]+/).filter((n: string) => n.trim()) 
          : [transaction.number];

        historyItems.push({
          id: `${action.id}-deleted`,
          type: 'deleted',
          isBulk,
          numbers,
          first: transaction.first || 0,
          second: transaction.second || 0,
          timestamp: action.timestamp,
          actionId: action.id,
        });
      }
    });

    // Sort by timestamp (newest first)
    return historyItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, visibleHistory]);

  // Filter combined history
  const filteredHistory = useMemo(() => {
    return combinedHistory.filter((item) => {
      // Filter by entry type (we need to determine this from the numbers)
      if (filterType !== 'all') {
        const isAkra = item.numbers.some(n => n.length === 2);
        const isRing = item.numbers.some(n => n.length === 3);
        
        if (filterType === 'akra' && !isAkra) return false;
        if (filterType === 'ring' && !isRing) return false;
      }

      // Filter by first/second/both
      if (filterEntry === 'first' && !item.first) return false;
      if (filterEntry === 'second' && !item.second) return false;
      if (filterEntry === 'both' && (!item.first || !item.second)) return false;

      // Search by number
      if (searchTerm && !item.numbers.some(n => n.includes(searchTerm))) return false;

      return true;
    });
  }, [combinedHistory, filterType, filterEntry, searchTerm]);

  const handleSelectTransaction = (transactionId: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const handleSelectAll = () => {
    const availableTransactions = filteredHistory.filter(item => item.type === 'added' && item.transactionId);
    if (selectedTransactions.size === availableTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(availableTransactions.map((item) => item.transactionId!)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) return;

    const confirmDelete = await confirm(
      `Are you sure you want to delete ${selectedTransactions.size} transaction(s)?`,
      {
        title: 'Delete Transactions',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
      }
    );

    if (confirmDelete) {
      try {
        let successCount = 0;
        let errorCount = 0;
        
        for (const id of selectedTransactions) {
          const success = await deleteTransaction(id);
          if (success) {
            successCount++;
          } else {
            errorCount++;
          }
        }
        
        setSelectedTransactions(new Set());
        
        if (successCount > 0) {
          showSuccess(
            'Bulk Delete Successful',
            `Successfully deleted ${successCount} transaction(s)`,
            { position: 'top' }
          );
        }
        
        if (errorCount > 0) {
          showError(
            'Delete Errors',
            `Failed to delete ${errorCount} transaction(s)`,
            { position: 'top' }
          );
        }
      } catch (error) {
        console.error('Bulk delete error:', error);
        showError(
          'Bulk Delete Failed',
          'An error occurred while deleting transactions',
          { position: 'top' }
        );
      }
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleSaveEdit = (updatedTransaction: Transaction) => {
    try {
      updateTransaction(updatedTransaction.id, updatedTransaction);
      setEditingTransaction(null);
      
      const isBulk = updatedTransaction.number.includes(',') || updatedTransaction.number.includes(' ');
      showSuccess(
        'Transaction Updated',
        `${isBulk ? 'Bulk' : 'Single'} entry updated successfully`,
        { position: 'top' }
      );
    } catch (error) {
      console.error('Update error:', error);
      showError(
        'Update Failed',
        'Failed to update transaction',
        { position: 'top' }
      );
    }
  };

  // Export handler
  const handleExport = () => {
    if (transactions.length === 0) {
      showWarning(
        'No Data to Export',
        'There are no transactions to export',
        { position: 'top' }
      );
      return;
    }
    
    try {
      exportTransactionsToExcel(transactions, project?.name || 'History');
      showSuccess(
        'Export Successful',
        `Exported ${transactions.length} transactions to Excel`,
        { position: 'top' }
      );
    } catch (error) {
      console.error('Export error:', error);
      showError(
        'Export Failed',
        'Failed to export transactions',
        { position: 'top' }
      );
    }
  };

  // Import handler
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Import from Excel - we'll handle both akra and ring
      const akraResult = await importTransactionsFromExcel(file, projectId || '', 'akra');
      const ringResult = await importTransactionsFromExcel(file, projectId || '', 'ring');

      let successCount = 0;
      const allErrors: string[] = [];

      // Process akra transactions
      if (akraResult.success && akraResult.transactions.length > 0) {
        for (const t of akraResult.transactions) {
          await addTransaction(t);
          successCount++;
        }
      }
      allErrors.push(...akraResult.errors);

      // Process ring transactions
      if (ringResult.success && ringResult.transactions.length > 0) {
        for (const t of ringResult.transactions) {
          await addTransaction(t);
          successCount++;
        }
      }
      allErrors.push(...ringResult.errors);

      // Show results
      if (successCount > 0) {
        showSuccess(
          'Import Successful',
          `Successfully imported ${successCount} transaction(s)`,
          { position: 'top' }
        );
        refresh();
      }

      if (allErrors.length > 0) {
        console.error('Import errors:', allErrors);
        showWarning(
          'Import Completed with Errors',
          `Import completed with ${allErrors.length} error(s). Check console for details.`,
          { position: 'top' }
        );
      }
    } catch (error) {
      console.error('Error importing file:', error);
      showError(
        'Import Failed',
        'Failed to import file. Please make sure it\'s a valid Excel file.',
        { position: 'top' }
      );
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!project || !projectId || projectLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Project not found</p>
      </div>
    );
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
        projectId={projectId}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            📊 Transaction History
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Complete history of all entries with full details and analytics
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex flex-wrap gap-3">
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

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Filters and Search */}
        <div className="card mb-6 bg-white dark:bg-gray-800 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Search Number
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g., 00, 123"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Entry Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Entry Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'akra' | 'ring')}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="akra">Akra (2-digit)</option>
                <option value="ring">Ring (3-digit)</option>
              </select>
            </div>

            {/* Amount Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Amount Type
              </label>
              <select
                value={filterEntry}
                onChange={(e) => setFilterEntry(e.target.value as 'all' | 'first' | 'second' | 'both')}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="first">First Only</option>
                <option value="second">Second Only</option>
                <option value="both">Both</option>
              </select>
            </div>

            {/* Bulk Actions */}
            <div className="flex items-end">
              <button
                onClick={handleBulkDelete}
                disabled={selectedTransactions.size === 0}
                className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-105 disabled:scale-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete {selectedTransactions.size > 0 ? `(${selectedTransactions.size})` : ''}
              </button>
      </div>

      
          </div>
        </div>

        {/* Statistics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card-premium hover-lift animate-slide-in-bottom bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Entries</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{filteredHistory.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center animate-float shadow-glow">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card-premium hover-lift animate-slide-in-bottom bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">First PKR</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                  {formatCurrency(
                    filteredHistory.reduce((sum, item) => sum + (item.first || 0), 0)
                  )}
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center animate-float shadow-glow" style={{ animationDelay: '0.5s' }}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card-premium hover-lift animate-slide-in-bottom bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Second PKR</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                  {formatCurrency(
                    filteredHistory.reduce((sum, item) => sum + (item.second || 0), 0)
                  )}
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center animate-float shadow-glow" style={{ animationDelay: '1s' }}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card-premium hover-lift animate-slide-in-bottom bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total PKR</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                  {formatCurrency(
                    filteredHistory.reduce(
                      (sum, item) => sum + (item.first || 0) + (item.second || 0),
                      0
                    )
                  )}
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center animate-float shadow-glow" style={{ animationDelay: '1.5s' }}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Select All Button */}
        {filteredHistory.filter(item => item.type === 'added' && item.transactionId).length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-sm"
            >
              {selectedTransactions.size === filteredHistory.filter(item => item.type === 'added' && item.transactionId).length ? '❌ Deselect All' : '✅ Select All'}
            </button>
            {selectedTransactions.size > 0 && (
              <div className="px-3 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 text-blue-800 dark:text-blue-200 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-sm font-semibold">
                  {selectedTransactions.size} selected
                </span>
              </div>
            )}
          </div>
        )}

        {/* Transaction History Log */}
        <div className="space-y-2">
          {filteredHistory.length === 0 ? (
            <div className="card text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">No transactions found</p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const numbersString = item.numbers.join(', ');
              
              return (
                <div
                  key={item.id}
                  className={`bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-750 dark:hover:bg-gray-850 transition-all duration-200 ${
                    item.transactionId && selectedTransactions.has(item.transactionId)
                      ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-900/20 dark:bg-blue-900/20'
                      : ''
                  }`}
                >
                  {/* Header: Title and Action */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <h3 className={`text-sm sm:text-base md:text-lg font-semibold truncate ${
                        item.type === 'added' ? 'text-teal-400' : 'text-red-400'
                      }`}>
                        {item.type === 'added' ? 'Entry Added' : 'Transaction Deleted'}: {numbersString}
                      </h3>
                      {item.transactionId && (
                        <input
                          type="checkbox"
                          checked={selectedTransactions.has(item.transactionId)}
                          onChange={() => handleSelectTransaction(item.transactionId!)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                        />
                      )}
                    </div>
                      {item.transactionId && (
                        <button
                          onClick={() => {
                            const transaction = transactions.find(t => t.id === item.transactionId);
                            if (transaction) {
                              handleEditTransaction(transaction);
                            }
                          }}
                          className={`px-3 py-1.5 sm:px-4 sm:py-2 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700`}
                        >
                          Manage
                        </button>
                      )}
                  </div>

                  {/* Body: FIRST / SECOND row */}
                  <div className="mt-2 flex items-center gap-6 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-500 font-medium">FIRST:</span>
                      <span className="text-white font-semibold">{item.first ? item.first.toLocaleString() : '0'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-500 font-medium">SECOND:</span>
                      <span className="text-white font-semibold">{item.second ? item.second.toLocaleString() : '0'}</span>
                    </div>
                  </div>

                  {/* Footer: timestamp aligned right */}
                  <div className="mt-2 flex justify-end">
                    <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">{formatTime(item.timestamp)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingTransaction && (
        <EditModal
          transaction={editingTransaction}
          onSave={handleSaveEdit}
          onCancel={() => setEditingTransaction(null)}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmationComponent />

    </div>
  );
};

export default HistoryPage;

