import React, { useState, useRef } from 'react';
import type { Transaction } from '../types';
import { formatCurrency } from '../utils/helpers';
import { useUserBalance } from '../hooks/useUserBalance';
import { useNotifications } from '../contexts/NotificationContext';
import { playSuccessSound } from '../utils/audioFeedback';

interface StandardEntryProps {
  projectId: string;
  onSuccess: () => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>, skipBalanceDeduction?: boolean) => Promise<boolean>;
}

const StandardEntry: React.FC<StandardEntryProps> = ({
  projectId,
  onSuccess: _onSuccess,
  addTransaction,
}) => {
  const { balance, hasSufficientBalance, deductBalance } = useUserBalance();
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
      
      // Categorize numbers based on digit length:
      // 1 digit (0-9) → Open entries
      // 2 digits (00-99) → Akra entries
      // 3 digits (000-999) → Ring entries
      // 4 digits (0000-9999) → Packet entries
      const categorizedNumbers = {
        open: numberList.filter(n => n.length === 1),
        akra: numberList.filter(n => n.length === 2),
        ring: numberList.filter(n => n.length === 3),
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

      // Create SEPARATE transactions for EACH number
      const transactionsToAdd: Omit<Transaction, 'id'>[] = [];
      
      // Create separate transaction for each OPEN number
      if (categorizedNumbers.open.length > 0) {
        categorizedNumbers.open.forEach(num => {
          const transaction = {
            projectId,
            number: padNumber(num, 'open'),
            entryType: 'open' as const,
            first: firstAmount,
            second: secondAmount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          transactionsToAdd.push(transaction);
          console.log('🔍 Debug - Added OPEN transaction:', transaction);
        });
      }
      
      // Create separate transaction for each AKRA number
      if (categorizedNumbers.akra.length > 0) {
        categorizedNumbers.akra.forEach(num => {
          const transaction = {
            projectId,
            number: padNumber(num, 'akra'),
            entryType: 'akra' as const,
            first: firstAmount,
            second: secondAmount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          transactionsToAdd.push(transaction);
          console.log('🔍 Debug - Added AKRA transaction:', transaction);
        });
      }
      
      // Create separate transaction for each RING number
      if (categorizedNumbers.ring.length > 0) {
        categorizedNumbers.ring.forEach(num => {
          const transaction = {
            projectId,
            number: padNumber(num, 'ring'),
            entryType: 'ring' as const,
            first: firstAmount,
            second: secondAmount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          transactionsToAdd.push(transaction);
          console.log('🔍 Debug - Added RING transaction:', transaction);
        });
      }
      
      // Create separate transaction for each PACKET number
      if (categorizedNumbers.packet.length > 0) {
        categorizedNumbers.packet.forEach(num => {
          const transaction = {
            projectId,
            number: padNumber(num, 'packet'),
            entryType: 'packet' as const,
            first: firstAmount,
            second: secondAmount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          transactionsToAdd.push(transaction);
          console.log('🔍 Debug - Added PACKET transaction:', transaction);
        });
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

      {/* Horizontal Layout Form - No Labels */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Left Side - Large Number Textarea */}
        <div className="flex-1">
          <textarea
            ref={numbersInputRef as any}
            value={numbers}
            onChange={(e) => {
              setNumbers(e.target.value);
              if (errors.numbers) setErrors(prev => ({ ...prev, numbers: undefined }));
            }}
            placeholder="e.g., 0 1 2 (open) OR 00 01 02 (akra) OR 000 001 (ring) OR 0000 0001 (packet)"
            className={`w-full h-full min-h-[200px] px-6 py-6 text-xl font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 border-2 rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none ${errors.numbers ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            autoComplete="off"
            rows={8}
          />
          {errors.numbers && (
            <p className="mt-2 text-sm text-red-500">{errors.numbers}</p>
          )}
        </div>

        {/* Right Side - Stacked Inputs and Button */}
        <div className="flex flex-col gap-3 sm:w-64">
          {/* FIRST Amount */}
          <input
            type="number"
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              if (errors.first) setErrors(prev => ({ ...prev, first: undefined }));
            }}
            placeholder="0"
            className={`w-full px-5 py-4 text-lg font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 border-2 rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${errors.first ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            step="0.01"
            inputMode="decimal"
          />
          {errors.first && (
            <p className="text-xs text-red-500">{errors.first}</p>
          )}

          {/* SECOND Amount */}
          <input
            type="number"
            value={second}
            onChange={(e) => {
              setSecond(e.target.value);
              if (errors.second) setErrors(prev => ({ ...prev, second: undefined }));
            }}
            placeholder="0"
            className={`w-full px-5 py-4 text-lg font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 border-2 rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${errors.second ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            step="0.01"
            inputMode="decimal"
          />
          {errors.second && (
            <p className="text-xs text-red-500">{errors.second}</p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-5 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-lg font-semibold rounded-3xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            )}
            {isSubmitting ? 'Adding Entry...' : 'Add Entry'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default StandardEntry;

