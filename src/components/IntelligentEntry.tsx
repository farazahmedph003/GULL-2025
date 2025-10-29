import React, { useState } from 'react';
import type { EntryType } from '../types';
import { isValidNumber, formatCurrency } from '../utils/helpers';
import { useUserBalance } from '../hooks/useUserBalance';
import { useTransactions } from '../hooks/useTransactions';
import { useAuth } from '../contexts/AuthContext';
import { isAdminEmail } from '../config/admin';
import { useNotifications } from '../contexts/NotificationContext';

interface IntelligentEntryProps {
  projectId: string;
  entryType: EntryType;
  onSuccess: () => void;
}

interface ParsedEntry {
  number: string;
  first: number;
  second: number;
}

const IntelligentEntry: React.FC<IntelligentEntryProps> = ({
  projectId,
  entryType,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { balance, hasSufficientBalance } = useUserBalance();
  const { addTransaction } = useTransactions(projectId);
  const { showSuccess, showError } = useNotifications();
  const isAdmin = user ? isAdminEmail(user.email) : false;
  
  const [inputText, setInputText] = useState('');
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseIntelligentInput = (text: string): { entries: ParsedEntry[]; errors: string[] } => {
    const entries: ParsedEntry[] = [];
    const parseErrors: string[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    // Helper function to pad numbers to correct length based on entry type
    const padNumber = (num: string, type: EntryType): string => {
      const lengths = { open: 1, akra: 2, ring: 3, packet: 4 };
      return num.padStart(lengths[type], '0');
    };

    // Get the digit pattern based on entry type
    const getDigitPattern = () => {
      switch (entryType) {
        case 'open':
          return '\\d{1}';
        case 'akra':
          return '\\d{1,2}'; // Allow 1-2 digits, we'll pad later
        case 'ring':
          return '\\d{1,3}'; // Allow 1-3 digits, we'll pad later
        case 'packet':
          return '\\d{1,4}'; // Allow 1-4 digits, we'll pad later
        default:
          return '\\d{2,3}';
      }
    };

    const digitPattern = getDigitPattern(); void digitPattern;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Try multiple patterns:
      // Pattern 1: "01 100 200" or "001 100 200" (number first second)
      // Pattern 2: "01:100:200" or "001-100-200" (with separators)
      // Pattern 3: "01 F:100 S:200" (with labels)
      // Pattern 4: "01 first:100 second:200"
      
      // Remove extra spaces and normalize
      const normalized = line.trim().replace(/\s+/g, ' ');
      
      // Try pattern with separators (: or -)
      const separatorRegex = new RegExp(`^(\\d{1,4})[\\s:-]+(\\d+(?:\\.\\d+)?)[\\s:-]+(\\d+(?:\\.\\d+)?)$`);
      let match = normalized.match(separatorRegex);
      
      if (!match) {
        // Try pattern with labels
        const labelRegex = new RegExp(`^(\\d{1,4})\\s+(?:F|first):?(\\d+(?:\\.\\d+)?)\\s+(?:S|second):?(\\d+(?:\\.\\d+)?)$`, 'i');
        match = normalized.match(labelRegex);
      }
      
      if (!match) {
        // Try simple space-separated pattern
        const parts = normalized.split(/\s+/);
        const numberRegex = new RegExp(`^\\d{1,4}$`); // More flexible pattern
        if (parts.length === 3 && numberRegex.test(parts[0]) && !isNaN(Number(parts[1])) && !isNaN(Number(parts[2]))) {
          match = [normalized, parts[0], parts[1], parts[2]];
        }
      }

      if (match) {
        const [, number, first, second] = match;
        
        // Pad the number to the correct format for the entry type
        const paddedNumber = padNumber(number, entryType);
        
        if (!isValidNumber(paddedNumber, entryType)) {
          parseErrors.push(`Line ${lineNum}: Invalid number "${number}" for ${entryType} type`);
        } else {
          entries.push({
            number: paddedNumber,
            first: Number(first),
            second: Number(second),
          });
        }
      } else {
        parseErrors.push(`Line ${lineNum}: Could not parse "${line}"`);
      }
    });

    return { entries, errors: parseErrors };
  };

  const handleProcess = () => {
    if (!inputText.trim()) {
      setErrors(['Please enter some text to process']);
      return;
    }

    setErrors([]);
    setParsedEntries([]);

    // Parse immediately without delay for instant feedback
    const result = parseIntelligentInput(inputText);
    setParsedEntries(result.entries);
    setErrors(result.errors);
    setShowPreview(true);
  };

  const handleSubmit = async () => {
    if (parsedEntries.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setBalanceError(null);

    // Calculate total cost (betting amounts only)
    const totalCost = parsedEntries.reduce(
      (sum, entry) => sum + entry.first + entry.second,
      0
    );

    // Check balance for non-admin users
    if (!isAdmin && !hasSufficientBalance(totalCost)) {
      setBalanceError(
        `Insufficient balance. You need ${formatCurrency(totalCost)} but only have ${formatCurrency(balance)}.`
      );
      return;
    }

    try {
      // Add all transactions in parallel for better performance
      const transactionsToAdd = parsedEntries.map(entry => ({
        projectId,
        number: entry.number,
        entryType,
        first: entry.first,
        second: entry.second,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const addPromises = transactionsToAdd.map(transaction => addTransaction(transaction));
      const results = await Promise.all(addPromises);
      const successCount = results.filter(Boolean).length;

      if (successCount === 0) {
        setBalanceError('Failed to add transactions. Please try again.');
        return;
      }

      // Reset form
      setInputText('');
      setParsedEntries([]);
      setErrors([]);
      setShowPreview(false);
      setBalanceError(null);

      // Success notification
      await showSuccess(
        'Entries Added Successfully',
        `Added ${successCount} ${entryType} ${successCount === 1 ? 'entry' : 'entries'} for ${formatCurrency(totalCost)}`,
        { duration: 2000 }
      );

      // Focus back to input for next entry (don't close panel)
      setTimeout(() => {
        const textarea = document.querySelector('textarea');
        if (textarea) textarea.focus();
      }, 50); // Reduced for instant feel

      onSuccess();
    } catch (error) {
      console.error('Error adding transactions:', error);
      await showError(
        'Error Adding Entries',
        'An error occurred while adding transactions. Please try again.',
        { duration: 5000 }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3">
        <div className="text-sm text-blue-800 dark:text-blue-400">
          <span className="font-semibold">Format:</span> Number FIRST SECOND
          <div className="mt-2 font-mono bg-white dark:bg-gray-800 px-3 py-2 rounded-lg text-sm border">
            {entryType === 'akra' ? '01 100 200' : entryType === 'ring' ? '001 100 200' : entryType === 'open' ? '1 100 200' : '0001 100 200'}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Paste your data here
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Paste data here...\n${entryType === 'akra' ? '01 100 200\n23 150 250' : entryType === 'ring' ? '001 100 200\n234 150 250' : entryType === 'open' ? '1 100 200\n2 150 250' : '0001 100 200\n2345 150 250'}`}
          className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono resize-none transition-all duration-200"
          rows={4}
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {inputText.split('\n').filter(l => l.trim()).length} lines
          </p>
          <button
            type="button"
            onClick={handleProcess}
            disabled={!inputText.trim()}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            Process Data
          </button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3">
          <h4 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-2">
            Errors ({errors.length})
          </h4>
          <div className="text-sm text-red-800 dark:text-red-400 max-h-24 overflow-y-auto space-y-1">
            {errors.slice(0, 3).map((error, idx) => (
              <div key={idx} className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                <span>{error}</span>
              </div>
            ))}
            {errors.length > 3 && <div className="text-red-600 font-medium">... and {errors.length - 3} more errors</div>}
          </div>
        </div>
      )}

      {/* Balance Error */}
      {balanceError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Insufficient Balance</h4>
              <p className="text-sm text-red-600 dark:text-red-400">{balanceError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {showPreview && parsedEntries.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-green-900 dark:text-green-300">
              {parsedEntries.length} entries ready to add
            </h4>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => {
                  setParsedEntries([]);
                  setShowPreview(false);
                }}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 min-h-[40px] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                Add {parsedEntries.length}
              </button>
            </div>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-2">
            {parsedEntries.slice(0, 5).map((entry, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-lg p-3 flex justify-between items-center border border-gray-200 dark:border-gray-600"
              >
                <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-sm">
                  {entry.number}
                </span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  F:{entry.first} S:{entry.second}
                </span>
              </div>
            ))}
            {parsedEntries.length > 5 && (
              <div className="text-sm text-gray-500 text-center py-2">... and {parsedEntries.length - 5} more entries</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligentEntry;

