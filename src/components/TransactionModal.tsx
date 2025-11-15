import React, { useState, useRef, useEffect } from 'react';
import EditTransactionModal from './EditTransactionModal';
import type { Transaction, NumberSummary } from '../types';
import { formatTimestamp } from '../utils/helpers';
import { playDeleteSound } from '../utils/audioFeedback';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: NumberSummary;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  summary,
  onEdit,
  onDelete,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw bar chart
  useEffect(() => {
    if (!isOpen || !canvasRef.current || summary.transactions.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get data
    const transactions = summary.transactions.slice().reverse(); // Most recent first
    const maxAmount = Math.max(
      ...transactions.map(t => Math.max(t.first, t.second))
    );

    if (maxAmount === 0) return;

    // Calculate bar dimensions
    const barWidth = Math.max(30, Math.floor((width - 40) / transactions.length) - 4);
    const maxBarHeight = height - 60;
    const spacing = 4;

    // Draw bars for each transaction
    transactions.forEach((transaction, index) => {
      const x = 20 + (index * (barWidth + spacing));
      
      // FIRST bar (green)
      const firstHeight = (transaction.first / maxAmount) * maxBarHeight;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x, height - 40 - firstHeight, barWidth / 2 - 1, firstHeight);
      
      // SECOND bar (yellow)
      const secondHeight = (transaction.second / maxAmount) * maxBarHeight;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x + barWidth / 2 + 1, height - 40 - secondHeight, barWidth / 2 - 1, secondHeight);
      
      // Index label
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`#${transactions.length - index}`, x + barWidth / 2, height - 25);
    });

    // Draw legend
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(20, height - 15, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FIRST', 36, height - 5);

    ctx.fillStyle = '#facc15';
    ctx.fillRect(90, height - 15, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('SECOND', 106, height - 5);

  }, [isOpen, summary.transactions]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDelete = (transactionId: string) => {
    if (showDeleteConfirm === transactionId) {
      playDeleteSound();
      onDelete?.(transactionId);
      setShowDeleteConfirm(null);
    } else {
      setShowDeleteConfirm(transactionId);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Number <span className="font-mono text-secondary">{summary.number}</span>
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {summary.entryCount} {summary.entryCount === 1 ? 'transaction' : 'transactions'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="card p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">FIRST Total</p>
                  <p className="text-2xl font-bold font-mono text-success">
                    {summary.firstTotal.toLocaleString()}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">SECOND Total</p>
                  <p className="text-2xl font-bold font-mono text-warning">
                    {summary.secondTotal.toLocaleString()}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Grand Total</p>
                  <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
                    {(summary.firstTotal + summary.secondTotal).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Bar Chart */}
              {summary.transactions.length > 0 && (
                <div className="card p-4 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      Transaction History
                    </h3>
                    <button
                      onClick={() => {
                        if (canvasRef.current) {
                          const dataUrl = canvasRef.current.toDataURL('image/png');
                          const a = document.createElement('a');
                          a.href = dataUrl;
                          a.download = `chart-${summary.number}-${Date.now()}.png`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }
                      }}
                      className="text-sm btn-secondary"
                    >
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Save Chart
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={250}
                    className="w-full"
                  />
                </div>
              )}

              {/* Transaction List */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Transactions
                </h3>
                
                {summary.transactions.length === 0 ? (
                  <div className="text-center py-8 card">
                    <p className="text-gray-600 dark:text-gray-400">
                      No transactions for this number
                    </p>
                  </div>
                ) : (
                  summary.transactions.map((transaction, index) => (
                    <div
                      key={transaction.id}
                      className="card p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Transaction number */}
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xs font-medium px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                              #{index + 1}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {formatTimestamp(transaction.createdAt)}
                            </span>
                            {transaction.isFilterDeduction && (
                              <span className="text-xs font-medium px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                                Filter Deduction
                              </span>
                            )}
                          </div>

                          {/* Amounts */}
                          <div className="grid grid-cols-2 gap-4 mb-2">
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">FIRST</p>
                              <p className="text-lg font-bold font-mono text-success">
                                {transaction.first.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">SECOND</p>
                              <p className="text-lg font-bold font-mono text-warning">
                                {transaction.second.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Notes */}
                          {transaction.notes && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                              "{transaction.notes}"
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2 ml-4">
                          {onEdit && (
                            <button
                              onClick={() => setEditingTransaction(transaction)}
                              className="p-2 text-secondary hover:bg-secondary hover:bg-opacity-10 rounded transition-colors"
                              title="Edit transaction"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          
                          {onDelete && (
                            showDeleteConfirm === transaction.id ? (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => setShowDeleteConfirm(null)}
                                  className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleDelete(transaction.id)}
                                  className="text-xs px-2 py-1 bg-danger text-white rounded hover:bg-red-600"
                                >
                                  Confirm
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleDelete(transaction.id)}
                                className="p-2 text-danger hover:bg-danger hover:bg-opacity-10 rounded transition-colors"
                                title="Delete transaction"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={onClose} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
        onSave={(updated) => {
          onEdit?.(updated);
          setEditingTransaction(null);
        }}
        transactions={summary.transactions}
      />
    </>
  );
};

export default TransactionModal;

