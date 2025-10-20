import React, { useState } from 'react';
import type { EntryType, Transaction } from '../types';
import { generateId, isValidNumber, formatCurrency } from '../utils/helpers';
import { useUserBalance } from '../hooks/useUserBalance';

interface StandardEntryProps {
  projectId: string;
  entryType: EntryType;
  onSuccess: () => void;
}

const StandardEntry: React.FC<StandardEntryProps> = ({
  projectId,
  entryType,
  onSuccess,
}) => {
  const { balance, hasSufficientBalance, deductBalance, refresh: refreshBalance } = useUserBalance();
  
  const [numbers, setNumbers] = useState('');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ numbers?: string; first?: string; second?: string; balance?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: { numbers?: string; first?: string; second?: string } = {};

    // Validate numbers
    if (!numbers.trim()) {
      newErrors.numbers = 'Please enter at least one number';
    } else {
      // Split by ANY non-digit characters to support symbols like = * + - ( ) ! ^ etc.
      const numberList = numbers.split(/[^0-9]+/).filter(n => n.length > 0);
      const invalidNumbers = numberList.filter(n => !isValidNumber(n, entryType));
      
      if (invalidNumbers.length > 0) {
        newErrors.numbers = `Invalid numbers: ${invalidNumbers.join(', ')}. Expected ${
          entryType === 'akra' ? '2-digit (00-99)' : '3-digit (000-999)'
        } format.`;
      }
    }

    // Validate amounts
    if (!first.trim() && !second.trim()) {
      newErrors.first = 'Enter at least one amount (FIRST or SECOND)';
    }

    if (first.trim() && isNaN(Number(first))) {
      newErrors.first = 'FIRST must be a valid number';
    }

    if (second.trim() && isNaN(Number(second))) {
      newErrors.second = 'SECOND must be a valid number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse numbers: split on any non-digit characters (all keyboard symbols)
      let numberList = numbers.split(/[^0-9]+/).filter(n => n.length > 0);
      // Normalize: keep leading zeros for 2/3-digit entries as typed
      numberList = numberList.map(n => n);
      const firstAmount = first.trim() ? Number(first) : 0;
      const secondAmount = second.trim() ? Number(second) : 0;
      
      // Calculate total amount per entry
      const totalPerEntry = firstAmount + secondAmount;
      // Total cost for all numbers (bulk uses shared amounts per number)
      const totalCost = totalPerEntry * numberList.length;

      // Check balance before proceeding
      if (!hasSufficientBalance(totalCost)) {
        setErrors(prev => ({
          ...prev,
          balance: `Insufficient balance. You need ${formatCurrency(totalCost)} but only have ${formatCurrency(balance)}.`,
        }));
        setIsSubmitting(false);
        return;
      }

      // Get existing transactions
      const storageKey = `gull-transactions-${projectId}`;
      const existingTransactions = JSON.parse(localStorage.getItem(storageKey) || '[]');

      // Create a SINGLE bulk transaction containing all numbers
      const bulkTransaction: Transaction = {
        id: generateId(),
        projectId,
        number: numberList.join(', '),
        entryType,
        first: firstAmount,
        second: secondAmount,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Deduct balance
      const success = await deductBalance(totalCost);
      if (!success) {
        setErrors(prev => ({
          ...prev,
          balance: 'Failed to deduct balance. Please try again.',
        }));
        setIsSubmitting(false);
        return;
      }

      // Save to localStorage
      localStorage.setItem(
        storageKey,
        JSON.stringify([...existingTransactions, bulkTransaction])
      );

      // Reset form
      setNumbers('');
      setFirst('');
      setSecond('');
      setNotes('');
      setErrors({});

      // Refresh balance display
      refreshBalance();

      // Success - no alert, silent success

      onSuccess();
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('An error occurred while adding the transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Balance Error */}
      {errors.balance && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Insufficient Balance</h4>
              <p className="text-sm text-red-600 dark:text-red-400">{errors.balance}</p>
            </div>
          </div>
        </div>
      )}

      {/* Numbers Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Numbers <span className="text-danger">*</span>
        </label>
        <textarea
          value={numbers}
          onChange={(e) => {
            setNumbers(e.target.value);
            if (errors.numbers) setErrors(prev => ({ ...prev, numbers: undefined }));
          }}
          placeholder={`Enter numbers (e.g., ${entryType === 'akra' ? '01, 23, 45' : '001, 234, 567'})\nSeparate with comma or space`}
          className={`input-field h-32 resize-none font-mono ${errors.numbers ? 'border-danger' : ''}`}
        />
        {errors.numbers && (
          <p className="mt-1 text-sm text-danger">{errors.numbers}</p>
        )}
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Separate multiple numbers with commas or spaces
        </p>
      </div>

      {/* FIRST Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          FIRST Amount
        </label>
        <input
          type="number"
          value={first}
          onChange={(e) => {
            setFirst(e.target.value);
            if (errors.first) setErrors(prev => ({ ...prev, first: undefined }));
          }}
          placeholder="Enter FIRST amount"
          className={`input-field ${errors.first ? 'border-danger' : ''}`}
          step="0.01"
        />
        {errors.first && (
          <p className="mt-1 text-sm text-danger">{errors.first}</p>
        )}
      </div>

      {/* SECOND Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          SECOND Amount
        </label>
        <input
          type="number"
          value={second}
          onChange={(e) => {
            setSecond(e.target.value);
            if (errors.second) setErrors(prev => ({ ...prev, second: undefined }));
          }}
          placeholder="Enter SECOND amount"
          className={`input-field ${errors.second ? 'border-danger' : ''}`}
          step="0.01"
        />
        {errors.second && (
          <p className="mt-1 text-sm text-danger">{errors.second}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes or comments..."
          className="input-field h-24 resize-none"
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Adding...' : 'Add Entry'}
        </button>
      </div>
    </form>
  );
};

export default StandardEntry;

