import React, { useState } from 'react';
import type { EntryType, Transaction } from '../types';
import { generateId, isValidNumber, formatCurrency } from '../utils/helpers';
import { useUserBalance } from '../hooks/useUserBalance';
import { useAuth } from '../contexts/AuthContext';
import { isAdminEmail } from '../config/admin';

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
  const { balance, hasSufficientBalance, deductBalance, refresh: refreshBalance } = useUserBalance();
  const isAdmin = user ? isAdminEmail(user.email) : false;
  
  const [inputText, setInputText] = useState('');
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const parseIntelligentInput = (text: string): { entries: ParsedEntry[]; errors: string[] } => {
    const entries: ParsedEntry[] = [];
    const parseErrors: string[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    // Get the digit pattern based on entry type
    const getDigitPattern = () => {
      switch (entryType) {
        case 'open':
          return '\\d{1}';
        case 'akra':
          return '\\d{2}';
        case 'ring':
          return '\\d{3}';
        case 'packet':
          return '\\d{4}';
        default:
          return '\\d{2,3}';
      }
    };

    const digitPattern = getDigitPattern();

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
        const numberRegex = new RegExp(`^${digitPattern}$`);
        if (parts.length === 3 && numberRegex.test(parts[0]) && !isNaN(Number(parts[1])) && !isNaN(Number(parts[2]))) {
          match = [normalized, parts[0], parts[1], parts[2]];
        }
      }

      if (match) {
        const [, number, first, second] = match;
        
        if (!isValidNumber(number, entryType)) {
          parseErrors.push(`Line ${lineNum}: Invalid number "${number}" for ${entryType} type`);
        } else {
          entries.push({
            number,
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

    setIsProcessing(true);
    setErrors([]);
    setParsedEntries([]);

    setTimeout(() => {
      const result = parseIntelligentInput(inputText);
      setParsedEntries(result.entries);
      setErrors(result.errors);
      setShowPreview(true);
      setIsProcessing(false);
    }, 300);
  };

  const handleSubmit = async () => {
    if (parsedEntries.length === 0) {
      return;
    }

    setBalanceError(null);

    // Calculate total cost
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
      // Get existing transactions
      const storageKey = `gull-transactions-${projectId}`;
      const existingTransactions = JSON.parse(localStorage.getItem(storageKey) || '[]');

      // If multiple entries, store as a single bulk transaction
      const newTransactions: Transaction[] = (() => {
        if (parsedEntries.length > 1) {
          const numbers = parsedEntries.map(e => e.number).join(', ');
          // Use first/second of the first parsed entry as the shared amounts
          const first = parsedEntries[0].first || 0;
          const second = parsedEntries[0].second || 0;
          return [{
            id: generateId(),
            projectId,
            number: numbers,
            entryType,
            first,
            second,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }];
        }
        // Single entry behaves as before
        return parsedEntries.map(entry => ({
          id: generateId(),
          projectId,
          number: entry.number,
          entryType,
          first: entry.first,
          second: entry.second,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      })();

      // Deduct balance for non-admin users
      if (!isAdmin) {
        const success = await deductBalance(totalCost);
        if (!success) {
          setBalanceError('Failed to deduct balance. Please try again.');
          return;
        }
      }

      // Save to localStorage
      localStorage.setItem(
        storageKey,
        JSON.stringify([...existingTransactions, ...newTransactions])
      );

      // Reset form
      setInputText('');
      setParsedEntries([]);
      setErrors([]);
      setShowPreview(false);
      setBalanceError(null);

      // Refresh balance display
      refreshBalance();

      // Show success
      // Success - no alert, silent success

      onSuccess();
    } catch (error) {
      console.error('Error adding transactions:', error);
      alert('An error occurred while adding transactions.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
          Intelligent Input Format
        </h3>
        <div className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
          <p>Each line should contain: <strong>Number FIRST SECOND</strong></p>
          <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded mt-2">
            {entryType === 'akra' ? '01 100 200' : '001 100 200'}<br />
            {entryType === 'akra' ? '23:150:250' : '234:150:250'}<br />
            {entryType === 'akra' ? '45 F:300 S:400' : '567 F:300 S:400'}
          </p>
        </div>
      </div>

      {/* Input Textarea */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Enter Data <span className="text-danger">*</span>
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Paste or type your data here...\n${
            entryType === 'akra' ? '01 100 200\n23 150 250' : '001 100 200\n234 150 250'
          }`}
          className="input-field h-64 resize-none font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          {inputText.split('\n').filter(l => l.trim()).length} lines entered
        </p>
      </div>

      {/* Process Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleProcess}
          disabled={isProcessing || !inputText.trim()}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : 'Process Data'}
        </button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-900 dark:text-red-300 mb-2">
            Parsing Errors ({errors.length})
          </h4>
          <ul className="text-xs text-red-800 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
            {errors.map((error, idx) => (
              <li key={idx}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Balance Error */}
      {balanceError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
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
        <div className="bg-green-50 dark:bg-green-900 dark:bg-opacity-20 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-green-900 dark:text-green-300 mb-3">
            Preview - {parsedEntries.length} entries will be added
          </h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {parsedEntries.map((entry, idx) => (
              <div
                key={idx}
                className="text-xs bg-white dark:bg-gray-800 rounded p-2 flex justify-between items-center"
              >
                <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                  {entry.number}
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  FIRST: {entry.first} | SECOND: {entry.second}
                </span>
              </div>
            ))}
          </div>
          
          <div className="mt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setParsedEntries([]);
                setShowPreview(false);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="btn-primary"
            >
              Add {parsedEntries.length} Entries
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligentEntry;

