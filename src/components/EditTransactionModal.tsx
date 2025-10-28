import React, { useState, useEffect } from 'react';
import type { Transaction } from '../types';
import { useUserBalance } from '../hooks/useUserBalance';
import { formatCurrency } from '../utils/helpers';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSave: (transaction: Transaction) => void;
  userBalance?: number; // Optional: use specific user's balance (for admin editing)
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSave,
  userBalance,
}) => {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ first?: string; second?: string; balance?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { balance: currentUserBalance } = useUserBalance();
  
  // Use provided userBalance for admin editing, otherwise use current user's balance
  const balance = userBalance !== undefined ? userBalance : currentUserBalance;

  useEffect(() => {
    if (transaction) {
      setFirst(transaction.first.toString());
      setSecond(transaction.second.toString());
      setNotes(transaction.notes || '');
    }
  }, [transaction]);

  const validate = (): boolean => {
    const newErrors: { first?: string; second?: string; balance?: string } = {};

    if (!first.trim() && !second.trim()) {
      newErrors.first = 'Enter at least one amount';
    }

    if (first.trim() && isNaN(Number(first))) {
      newErrors.first = 'FIRST must be a valid number';
    }

    if (second.trim() && isNaN(Number(second))) {
      newErrors.second = 'SECOND must be a valid number';
    }

    // Balance validation - check if increasing amounts beyond available balance
    if (transaction) {
      const oldTotal = transaction.first + transaction.second;
      const newFirst = first.trim() ? Number(first) : 0;
      const newSecond = second.trim() ? Number(second) : 0;
      const newTotal = newFirst + newSecond;
      const difference = newTotal - oldTotal;

      // If user is increasing the amounts, check if they have enough balance
      if (difference > 0 && difference > balance) {
        newErrors.balance = `Insufficient balance. You need ${formatCurrency(difference)} more but only have ${formatCurrency(balance)} available.`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || !transaction || !validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const updated: Transaction = {
        ...transaction,
        first: first.trim() ? Number(first) : 0,
        second: second.trim() ? Number(second) : 0,
        notes: notes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };

      onSave(updated);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[60] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[60] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-purple-50/10 to-indigo-50/20 dark:from-blue-900/10 dark:via-purple-900/5 dark:to-indigo-900/10 rounded-2xl"></div>
            
            {/* Header */}
            <div className="relative z-10 p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Edit Transaction</h2>
                    <p className="text-sm text-blue-100">Single Entry: {transaction.number}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 group"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="relative z-10 p-6 space-y-6">
              {/* Balance Error */}
              {errors.balance && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Insufficient Balance</h4>
                      <p className="text-sm text-red-600 dark:text-red-400">{errors.balance}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Number (readonly) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={transaction.number}
                    disabled
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white cursor-not-allowed"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* FIRST Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  First Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={first}
                    onChange={(e) => {
                      setFirst(e.target.value);
                      if (errors.first || errors.balance) setErrors(prev => ({ ...prev, first: undefined, balance: undefined }));
                    }}
                    placeholder="Enter FIRST amount"
                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${errors.first ? 'border-red-500 focus:ring-red-500' : ''}`}
                    step="0.01"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                {errors.first && (
                  <p className="mt-2 text-sm text-red-500 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.first}
                  </p>
                )}
              </div>

              {/* SECOND Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Second Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={second}
                    onChange={(e) => {
                      setSecond(e.target.value);
                      if (errors.second || errors.balance) setErrors(prev => ({ ...prev, second: undefined, balance: undefined }));
                    }}
                    placeholder="Enter SECOND amount"
                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${errors.second ? 'border-red-500 focus:ring-red-500' : ''}`}
                    step="0.01"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                {errors.second && (
                  <p className="mt-2 text-sm text-red-500 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.second}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes or comments..."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 h-24 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100 dark:border-gray-700">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-all duration-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel</span>
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-blue-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditTransactionModal;

