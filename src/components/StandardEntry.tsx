import React, { useState, useRef } from 'react';
import type { EntryType, Transaction, AddedEntrySummary } from '../types';
import { formatCurrency } from '../utils/helpers';
import { useUserBalance } from '../hooks/useUserBalance';
import { useNotifications } from '../contexts/NotificationContext';
import { playSuccessSound } from '../utils/audioFeedback';
import { useAuth } from '../contexts/AuthContext';
import { useSystemSettings } from '../hooks/useSystemSettings';
import {
  getExistingTotalsForNumber,
  getLimitsForEntryType,
  padNumberForEntryType,
} from '../utils/amountLimits';

interface StandardEntryProps {
  projectId: string;
  onSuccess?: (summary: AddedEntrySummary[]) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>, skipBalanceDeduction?: boolean) => Promise<Transaction | null>;
  transactions: Transaction[];
}

const StandardEntry: React.FC<StandardEntryProps> = ({
  projectId,
  onSuccess: _onSuccess,
  addTransaction,
  transactions,
}) => {
  const { user } = useAuth();
  const { balance, hasSufficientBalance, deductBalance } = useUserBalance();
  const { showSuccess, showError } = useNotifications();
  const numbersInputRef = useRef<HTMLInputElement>(null);
  const { amountLimits } = useSystemSettings();
  
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
      // Split by ANY non-digit characters - supports ALL Unicode symbols, emojis, and multiple occurrences
      // Examples: "90-91-92--93---50/n" splits into [90, 91, 92, 93, 50]
      // The regex [^0-9]+ matches one or more consecutive non-digit characters (supports 10,000+ symbols)
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

    if (!validate() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse numbers and extract FIRST/SECOND keywords
      let numbersText = numbers.trim();
      let firstAmount = first.trim() ? Number(first) : 0;
      let secondAmount = second.trim() ? Number(second) : 0;

      // Check for inline FIRST/SECOND keywords in the numbers input
      const extractAmount = (
        regex: RegExp,
        setter: (value: number) => void,
      ) => {
        let match: RegExpExecArray | null;
        regex.lastIndex = 0;
        // Use while loop to find LAST occurrence, so the final inline value wins
        while ((match = regex.exec(numbersText)) !== null) {
          const value = Number(match[1]);
          if (!Number.isNaN(value)) {
            setter(value);
          }
        }
        numbersText = numbersText.replace(regex, ' ').trim();
      };

      extractAmount(/\bfirst\s+(\d+(?:\.\d+)?)\b/gi, (value) => {
        firstAmount = value;
      });

      extractAmount(/\bsecond\s+(\d+(?:\.\d+)?)\b/gi, (value) => {
        secondAmount = value;
      });

      // Support shorthand tokens like "f100" / "s50"
      extractAmount(/\bf(\d+(?:\.\d+)?)\b/gi, (value) => {
        firstAmount = value;
      });

      extractAmount(/\bs(\d+(?:\.\d+)?)\b/gi, (value) => {
        secondAmount = value;
      });

      // Parse numbers: split on any non-digit characters - supports ALL Unicode symbols and multiple occurrences
      // The regex [^0-9]+ matches one or more consecutive non-digit characters (supports 10,000+ symbols)
      let numberList = numbersText.split(/[^0-9]+/).filter(n => n.length > 0);
      
      // Categorize numbers based on digit length:
      const categorizedNumbers = {
        open: numberList.filter((n) => n.length === 1),
        akra: numberList.filter((n) => n.length === 2),
        ring: numberList.filter((n) => n.length === 3),
        packet: numberList.filter((n) => n.length === 4),
      };

      const additionByNumber = new Map<
        string,
        { entryType: EntryType; addFirst: number; addSecond: number }
      >();

      Object.entries(categorizedNumbers).forEach(([type, numbers]) => {
        const entryType = type as EntryType;
        numbers.forEach((rawNumber) => {
          const padded = padNumberForEntryType(rawNumber, entryType);
          const existing = additionByNumber.get(padded) || { entryType, addFirst: 0, addSecond: 0 };
          existing.addFirst += firstAmount;
          existing.addSecond += secondAmount;
          additionByNumber.set(padded, existing);
        });
      });

      for (const [paddedNumber, addition] of additionByNumber.entries()) {
        const { entryType } = addition;
        const limits = getLimitsForEntryType(amountLimits, entryType);
        const existingTotals = getExistingTotalsForNumber(transactions, entryType, paddedNumber);

        if (limits.first !== null && addition.addFirst > 0) {
          const totalFirst = existingTotals.first + addition.addFirst;
          if (totalFirst > limits.first) {
            setErrors({
              numbers: `Number ${paddedNumber} exceeds First limit (${limits.first}). Current total is ${existingTotals.first}.`,
            });
            setIsSubmitting(false);
            return;
          }
        }

        if (limits.second !== null && addition.addSecond > 0) {
          const totalSecond = existingTotals.second + addition.addSecond;
          if (totalSecond > limits.second) {
            setErrors({
              numbers: `Number ${paddedNumber} exceeds Second limit (${limits.second}). Current total is ${existingTotals.second}.`,
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

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
        return;
      }

      // Deduct total balance once upfront for better performance
      // IMPORTANT: Don't update total_spent here - let database trigger handle it to avoid doubling
      if (totalCost > 0) {
        const balanceSuccess = await deductBalance(totalCost, false); // adjustSpent=false to prevent doubling
        if (!balanceSuccess) {
          setErrors(prev => ({
            ...prev,
            balance: 'Failed to deduct balance. Please try again.',
          }));
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
            userId: user?.id,
            number: padNumberForEntryType(num, 'open'),
            entryType: 'open' as const,
            first: firstAmount,
            second: secondAmount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          transactionsToAdd.push(transaction);
        });
      }
      
      // Create separate transaction for each AKRA number
      if (categorizedNumbers.akra.length > 0) {
        categorizedNumbers.akra.forEach(num => {
          const transaction = {
            projectId,
            userId: user?.id,
            number: padNumberForEntryType(num, 'akra'),
            entryType: 'akra' as const,
            first: firstAmount,
            second: secondAmount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          transactionsToAdd.push(transaction);
        });
      }
      
      // Create separate transaction for each RING number
      if (categorizedNumbers.ring.length > 0) {
        categorizedNumbers.ring.forEach(num => {
          const transaction = {
            projectId,
            userId: user?.id,
            number: padNumberForEntryType(num, 'ring'),
            entryType: 'ring' as const,
            first: firstAmount,
            second: secondAmount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          transactionsToAdd.push(transaction);
        });
      }
      
      // Create separate transaction for each PACKET number
      if (categorizedNumbers.packet.length > 0) {
        categorizedNumbers.packet.forEach(num => {
          const transaction = {
            projectId,
            userId: user?.id,
            number: padNumberForEntryType(num, 'packet'),
            entryType: 'packet' as const,
            first: firstAmount,
            second: secondAmount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          transactionsToAdd.push(transaction);
        });
      }

      // Add all transactions in parallel with balance deduction skipped (already done above)
      const addPromises = transactionsToAdd.map(transaction => addTransaction(transaction, true));
      const results = await Promise.all(addPromises);
      const successfulResults = results.filter((result): result is Transaction => result !== null);
      const successCount = successfulResults.length;
      
      if (successCount === 0) {
        setErrors(prev => ({
          ...prev,
          balance: 'Failed to add transactions. Please try again.',
        }));
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

      // Focus back to number input for next entry (don't close panel)
      setTimeout(() => {
        numbersInputRef.current?.focus();
      }, 50);

      // Call onSuccess with transaction IDs and amounts
      _onSuccess?.(
        successfulResults.map<AddedEntrySummary>((transaction) => ({
          id: transaction.id,
          number: transaction.number,
          entryType: transaction.entryType,
          first: transaction.first,
          second: transaction.second,
        }))
      );
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

      {/* Vertical Stack Layout - Numbers, First, Second, Button */}
      <div className="flex flex-col gap-4">
        {/* Numbers Input - Full Width */}
        <div className="w-full">
          <textarea
            ref={numbersInputRef as any}
            value={numbers}
            onChange={(e) => {
              setNumbers(e.target.value);
              if (errors.numbers) setErrors(prev => ({ ...prev, numbers: undefined }));
            }}
            placeholder="e.g., 0 1 2 (open) OR 00 01 02 (akra) OR 000 001 (ring) OR 0000 0001 (packet)"
            className={`w-full min-h-[140px] px-6 py-4 text-lg font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 border-2 rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none ${errors.numbers ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            autoComplete="off"
            rows={5}
          />
          {errors.numbers && (
            <p className="mt-2 text-sm text-red-500">{errors.numbers}</p>
          )}
        </div>

        {/* FIRST Amount - Full Width */}
        <div className="w-full">
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
            <p className="mt-2 text-sm text-red-500">{errors.first}</p>
          )}
        </div>

        {/* SECOND Amount - Full Width */}
        <div className="w-full">
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
            <p className="mt-2 text-sm text-red-500">{errors.second}</p>
          )}
        </div>

        {/* Submit Button - Full Width */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-5 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-lg font-semibold rounded-3xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          Add Entry
        </button>
      </div>
    </form>
  );
};

export default StandardEntry;

