import React, { useState, useRef } from 'react';
import type { Transaction } from '../types';
import { formatCurrency } from '../utils/helpers';
import { useUserBalance } from '../hooks/useUserBalance';
import { useTransactions } from '../hooks/useTransactions';
import { useNotifications } from '../contexts/NotificationContext';
import { playSuccessSound } from '../utils/audioFeedback';

interface StandardEntryProps {
  projectId: string;
  onSuccess: () => void;
}

const StandardEntry: React.FC<StandardEntryProps> = ({
  projectId,
  onSuccess: _onSuccess,
}) => {
  const { balance, hasSufficientBalance, deductBalance } = useUserBalance();
  const { addTransaction } = useTransactions(projectId);
  const { showSuccess, showError } = useNotifications();
  const numbersInputRef = useRef<HTMLInputElement>(null);
  
  const [numbers, setNumbers] = useState('');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
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
      
      if (numberList.length === 0) {
        newErrors.numbers = 'Please enter at least one valid number';
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
      // Parse numbers and extract FIRST/SECOND keywords
      let numbersText = numbers.trim();
      let firstAmount = first.trim() ? Number(first) : 0;
      let secondAmount = second.trim() ? Number(second) : 0;

      // Check for inline FIRST/SECOND keywords in the numbers input
      const firstMatch = numbersText.match(/\bfirst\s+(\d+(?:\.\d+)?)\b/i);
      const secondMatch = numbersText.match(/\bsecond\s+(\d+(?:\.\d+)?)\b/i);

      if (firstMatch) {
        firstAmount = Number(firstMatch[1]);
        // Remove the "first X" part from the numbers text
        numbersText = numbersText.replace(/\bfirst\s+\d+(?:\.\d+)?\b/i, '').trim();
      }

      if (secondMatch) {
        secondAmount = Number(secondMatch[1]);
        // Remove the "second X" part from the numbers text
        numbersText = numbersText.replace(/\bsecond\s+\d+(?:\.\d+)?\b/i, '').trim();
      }

      // Parse numbers: split on any non-digit characters (all keyboard symbols)
      let numberList = numbersText.split(/[^0-9]+/).filter(n => n.length > 0);
      
      console.log('🔍 Debug - Input numbers:', numbers);
      console.log('🔍 Debug - Parsed numberList:', numberList);
      
      // Helper function to pad numbers to correct length based on entry type
      const padNumber = (num: string, type: 'open' | 'akra' | 'ring' | 'packet'): string => {
        const lengths = { open: 1, akra: 2, ring: 3, packet: 4 };
        return num.padStart(lengths[type], '0');
      };
      
      // Categorize numbers based on your requirements:
      // 0-9 (single digits) → Open entries
      // 0000-9999 (4 digits) → Packet entries
      const categorizedNumbers = {
        open: numberList.filter(n => n.length === 1),
        akra: [], // Not used based on your requirements
        ring: [], // Not used based on your requirements  
        packet: numberList.filter(n => n.length === 4),
      };
      
      console.log('🔍 Debug - Categorized numbers:', categorizedNumbers);

      // Calculate total cost
      const totalNumbers = categorizedNumbers.open.length + categorizedNumbers.akra.length + 
                          categorizedNumbers.ring.length + categorizedNumbers.packet.length;
      const bettingAmountPerEntry = firstAmount + secondAmount;
      const totalCost = bettingAmountPerEntry * totalNumbers;

      // Check balance before proceeding (skip for admin users)
      if (!hasSufficientBalance(totalCost)) {
        setErrors(prev => ({
          ...prev,
          balance: `Insufficient balance. You need ${formatCurrency(totalCost)} but only have ${formatCurrency(balance)}.`,
        }));
        setIsSubmitting(false);
        return;
      }

      // Deduct total balance once upfront for better performance
      if (totalCost > 0) {
        const balanceSuccess = await deductBalance(totalCost);
        if (!balanceSuccess) {
          setErrors(prev => ({
            ...prev,
            balance: 'Failed to deduct balance. Please try again.',
          }));
          setIsSubmitting(false);
          return;
        }
      }

      // Create transactions for each entry type that has numbers
      const transactionsToAdd: Omit<Transaction, 'id'>[] = [];
      
      if (categorizedNumbers.open.length > 0) {
        const transaction = {
          projectId,
          number: categorizedNumbers.open.map(n => padNumber(n, 'open')).join(', '),
          entryType: 'open' as const,
          first: firstAmount,
          second: secondAmount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        transactionsToAdd.push(transaction);
        console.log('🔍 Debug - Added OPEN transaction:', transaction);
      }
      
      if (categorizedNumbers.akra.length > 0) {
        const transaction = {
          projectId,
          number: categorizedNumbers.akra.map(n => padNumber(n, 'akra')).join(', '),
          entryType: 'akra' as const,
          first: firstAmount,
          second: secondAmount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        transactionsToAdd.push(transaction);
        console.log('🔍 Debug - Added AKRA transaction:', transaction);
      }
      
      if (categorizedNumbers.ring.length > 0) {
        const transaction = {
          projectId,
          number: categorizedNumbers.ring.map(n => padNumber(n, 'ring')).join(', '),
          entryType: 'ring' as const,
          first: firstAmount,
          second: secondAmount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        transactionsToAdd.push(transaction);
        console.log('🔍 Debug - Added RING transaction:', transaction);
      }
      
      if (categorizedNumbers.packet.length > 0) {
        const transaction = {
          projectId,
          number: categorizedNumbers.packet.map(n => padNumber(n, 'packet')).join(', '),
          entryType: 'packet' as const,
          first: firstAmount,
          second: secondAmount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        transactionsToAdd.push(transaction);
        console.log('🔍 Debug - Added PACKET transaction:', transaction);
      }
      
      console.log('🔍 Debug - Total transactions to add:', transactionsToAdd.length);
      console.log('🔍 Debug - Transactions:', transactionsToAdd);

      // Add all transactions in parallel with balance deduction skipped (already done above)
      const addPromises = transactionsToAdd.map(transaction => addTransaction(transaction, true));
      const results = await Promise.all(addPromises);
      const successCount = results.filter(Boolean).length;
      
      console.log('🔍 Debug - Add transaction results:', results);
      console.log('🔍 Debug - Success count:', successCount);
      
      if (successCount === 0) {
        console.error('🔍 Debug - All transactions failed!');
        setErrors(prev => ({
          ...prev,
          balance: 'Failed to add transactions. Please try again.',
        }));
        setIsSubmitting(false);
        return;
      }

      // Reset form
      setNumbers('');
      setFirst('');
      setSecond('');
      setErrors({});

      // Play success sound
      playSuccessSound();

      // Success notification
      const entryTypesAdded = Object.entries(categorizedNumbers)
        .filter(([_, numbers]) => numbers.length > 0)
        .map(([type, numbers]) => `${numbers.length} ${type}`)
        .join(', ');
      
      await showSuccess(
        'Entries Added Successfully',
        `Added ${entryTypesAdded} for ${formatCurrency(totalCost)}`,
        { duration: 2000 }
      );

      console.log('Entries added successfully!');

      // Focus back to number input for next entry (don't close panel)
      setTimeout(() => {
        numbersInputRef.current?.focus();
      }, 100);

      // Call onSuccess to trigger silent refresh (form stays open)
      _onSuccess();
    } catch (error) {
      console.error('Error adding transaction:', error);
      await showError(
        'Error Adding Entry',
        'An error occurred while adding the transaction. Please try again.',
        { duration: 5000 }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Balance Error */}
      {errors.balance && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
          <div className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Insufficient Balance</h4>
              <p className="text-sm text-red-600 dark:text-red-400">{errors.balance}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-First Vertical Form */}
      <div className="space-y-4">
        {/* Numbers Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Numbers <span className="text-red-500">*</span>
          </label>
          <input
            ref={numbersInputRef}
            value={numbers}
            onChange={(e) => {
              setNumbers(e.target.value);
              if (errors.numbers) setErrors(prev => ({ ...prev, numbers: undefined }));
            }}
            placeholder="e.g., 0 1 2 3 OR 0000 0001 0002"
            className={`w-full px-4 py-3 text-base border rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${errors.numbers ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            autoComplete="off"
            inputMode="text"
          />
          {errors.numbers && (
            <p className="mt-2 text-sm text-red-500">{errors.numbers}</p>
          )}
        </div>

        {/* Amount Inputs Row */}
        <div className="grid grid-cols-2 gap-3">
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
              placeholder="0"
              className={`w-full px-4 py-3 text-base border rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${errors.first ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
              step="0.01"
              inputMode="decimal"
            />
            {errors.first && (
              <p className="mt-2 text-sm text-red-500">{errors.first}</p>
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
              placeholder="0"
              className={`w-full px-4 py-3 text-base border rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${errors.second ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
              step="0.01"
              inputMode="decimal"
            />
            {errors.second && (
              <p className="mt-2 text-sm text-red-500">{errors.second}</p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 min-h-[56px]"
        >
          {isSubmitting && (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          )}
          {isSubmitting ? 'Adding Entry...' : 'Add Entry'}
        </button>
      </div>
    </form>
  );
};

export default StandardEntry;

