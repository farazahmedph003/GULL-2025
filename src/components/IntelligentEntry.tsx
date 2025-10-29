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
  entryType: EntryType; // Auto-detected from number length
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

  // Helper function to parse amount patterns
  const parseAmountPattern = (text: string): { first: number; second: number } | null => {
    const cleanText = text.trim();
    
    // Check for nil/n patterns: N+200, n+200, NIL+200, nil+200, 300+N, 300+nil
    const nilPattern = /^(n|nil)$/i;
    const nilPlusNumber = /^(n|nil)\+(\d+(?:\.\d+)?)$/i;
    const numberPlusNil = /^(\d+(?:\.\d+)?)\+(n|nil|ff)$/i;
    
    if (nilPlusNumber.test(cleanText)) {
      const match = cleanText.match(nilPlusNumber);
      return { first: 0, second: Number(match![2]) };
    }
    
    if (numberPlusNil.test(cleanText)) {
      const match = cleanText.match(numberPlusNil);
      return { first: Number(match![1]), second: 0 };
    }
    
    // Check for ff/ss patterns: ff10, FF10, ff.10, FF.10, 100ff, 100FF, 100-ff, 100-FF (prefix, suffix, and dash)
    const ffPrefixPattern = /^ff\.?(\d+)$/i;
    const fsSuffixPattern = /^(\d+)ff$/i;
    const ffDashPattern = /^(\d+)-ff$/i;
    const ssPrefixPattern = /^ss\.?(\d+)$/i;
    const ssSuffixPattern = /^(\d+)ss$/i;
    const ssDashPattern = /^(\d+)-ss$/i;
    
    if (ffPrefixPattern.test(cleanText)) {
      const match = cleanText.match(ffPrefixPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (fsSuffixPattern.test(cleanText)) {
      const match = cleanText.match(fsSuffixPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (ffDashPattern.test(cleanText)) {
      const match = cleanText.match(ffDashPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (ssPrefixPattern.test(cleanText)) {
      const match = cleanText.match(ssPrefixPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (ssSuffixPattern.test(cleanText)) {
      const match = cleanText.match(ssSuffixPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (ssDashPattern.test(cleanText)) {
      const match = cleanText.match(ssDashPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    // Check for f/s patterns: 10f 20s, 10F 20S, f20, s20, F20, S20, or single: 100f, 200s
    const fsSingleFirst = /^(\d+)[fF]$/;
    const fsSingleSecond = /^(\d+)[sS]$/;
    const fPrefixPattern = /^[fF](\d+(?:\.\d+)?)$/;
    const sPrefixPattern = /^[sS](\d+(?:\.\d+)?)$/;
    const fsPattern = /^(\d+(?:\.\d+)?)[fF]\s+(\d+(?:\.\d+)?)[sS]$/;
    
    if (fsPattern.test(cleanText)) {
      const match = cleanText.match(fsPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (fsSingleFirst.test(cleanText)) {
      const match = cleanText.match(fsSingleFirst);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (fsSingleSecond.test(cleanText)) {
      const match = cleanText.match(fsSingleSecond);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (fPrefixPattern.test(cleanText)) {
      const match = cleanText.match(fPrefixPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (sPrefixPattern.test(cleanText)) {
      const match = cleanText.match(sPrefixPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    // Check for /, -, by, x patterns: 10/20, 10-20, 10by20, 10x20
    const slashPattern = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/;
    const dashPattern = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/;
    const byPattern = /^(\d+(?:\.\d+)?)(by|x)(\d+(?:\.\d+)?)$/i;
    
    if (slashPattern.test(cleanText)) {
      const match = cleanText.match(slashPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (dashPattern.test(cleanText)) {
      const match = cleanText.match(dashPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (byPattern.test(cleanText)) {
      const match = cleanText.match(byPattern);
      return { first: Number(match![1]), second: Number(match![3]) };
    }
    
    return null;
  };

  const parseIntelligentInput = (text: string): { entries: ParsedEntry[]; errors: string[] } => {
    const entries: ParsedEntry[] = [];
    const parseErrors: string[] = [];
    
    // Clean WhatsApp timestamp lines (e.g., "[28/10/2025 11:16 pm] Username: 89")
    // Extract the actual data after the timestamp and username
    const whatsappPattern = /^\[.*?\].*?:\s*/;
    
    const lines = text.split('\n')
      .filter(line => line.trim())
      .map(line => {
        // If line starts with WhatsApp timestamp, remove it and keep only the data
        if (whatsappPattern.test(line.trim())) {
          return line.trim().replace(whatsappPattern, '');
        }
        return line.trim();
      })
      .filter(line => line.length > 0); // Remove empty lines after cleaning

    // Helper function to detect entry type from number length
    const detectEntryType = (num: string): EntryType => {
      const len = num.length;
      if (len === 1) return 'open';
      if (len === 2) return 'akra';
      if (len === 3) return 'ring';
      return 'packet';
    };

    // Helper function to pad numbers to correct length based on entry type
    const padNumber = (num: string, type: EntryType): string => {
      const lengths = { open: 1, akra: 2, ring: 3, packet: 4 };
      return num.padStart(lengths[type], '0');
    };

    // Process lines to support both horizontal and vertical grouping
    let currentNumberGroup: string[] = [];
    let currentNumberLineNums: number[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const normalized = line.trim().replace(/\s+/g, ' ');
      
      // FIRST: Find and extract pattern from the line BEFORE splitting by dots
      let amountPattern: { first: number; second: number } | null = null;
      let isOnlyPattern = false;
      let lineWithoutPattern = normalized;
      
      // Check if the entire line is just a pattern (like "ff.10" alone or ".ff.10")
      const cleanedLine = normalized.replace(/^[.,\s]+/, '').trim(); // Remove leading dots/commas
      const wholeLineParsed = parseAmountPattern(cleanedLine);
      if (wholeLineParsed) {
        amountPattern = wholeLineParsed;
        isOnlyPattern = true;
      } else {
        // Try to find patterns embedded in the line using comprehensive regex
        // Matches: ff.10, ff10, 100ff, 100-ff, ss.20, ss20, 200ss, 200-ss, n+100, 100+n, 10/20, 10-20, 10by20, 10x20, 100f, 200s, f20, s20, etc.
        const patternRegex = /(?:ff\.?\d+|\d+ff|\d+-ff|ss\.?\d+|\d+ss|\d+-ss|(?:n|nil)\+\d+|\d+\+(?:n|nil|ff|ss)|\d+\/\d+|\d+-\d+|\d+(?:by|x)\d+|\d+f(?:\s+\d+s)?|\d+s|[fF]\d+|[sS]\d+)/gi;
        const patternMatches = normalized.match(patternRegex);
        
        if (patternMatches && patternMatches.length > 0) {
          // Try each match to see if it's a valid pattern
          for (const match of patternMatches) {
            const parsed = parseAmountPattern(match);
            if (parsed) {
              amountPattern = parsed;
              // Remove the pattern from the line to extract numbers
              lineWithoutPattern = normalized.replace(match, '').trim();
              break;
            }
          }
        }
        
        // If still no pattern found, try space-separated tokens
        if (!amountPattern) {
          const tokens = normalized.split(/\s+/);
          for (const token of tokens) {
            // Remove leading dots/commas from token
            const cleanToken = token.replace(/^[.,]+/, '').replace(/[.,]+$/, '');
            
            // Skip if it's a pure number (could be a game number)
            if (/^\d+$/.test(cleanToken) && cleanToken.length <= 4) {
              continue;
            }
            
            const parsed = parseAmountPattern(cleanToken);
            if (parsed) {
              amountPattern = parsed;
              // Remove this token from the line
              lineWithoutPattern = normalized.replace(cleanToken, '').trim();
              break;
            }
          }
        }
      }
      
      // SECOND: Extract numbers (only if line is not purely a pattern)
      // Split by common separators: spaces, dots, commas, equals, plus, dash, slash, etc.
      const numberMatches = lineWithoutPattern.split(/[\s.,+=\-\/|;:]+/);
      const validNumbers: string[] = [];
      
      // Only extract numbers if this line is not purely an amount pattern
      if (!isOnlyPattern) {
        // Filter to only valid game numbers (1-4 digits, pure numbers only)
        for (const num of numberMatches) {
          const trimmed = num.trim();
          if (/^\d+$/.test(trimmed) && trimmed.length >= 1 && trimmed.length <= 4) {
            validNumbers.push(trimmed);
          }
        }
      }
      
      // CASE 1: Line has both numbers AND amount pattern (horizontal format + vertical grouping)
      if (validNumbers.length > 0 && amountPattern) {
        // Combine accumulated numbers from previous lines with current line's numbers
        const allNumbers = [...currentNumberGroup, ...validNumbers];
        
        // Apply pattern to ALL numbers (accumulated + current line)
        for (const num of allNumbers) {
          const detectedType = detectEntryType(num);
          const paddedNumber = padNumber(num, detectedType);
          
          if (!isValidNumber(paddedNumber, detectedType)) {
            parseErrors.push(`Line ${lineNum}: Invalid number "${num}" for ${detectedType} type`);
            continue;
          }
          
          entries.push({
            number: paddedNumber,
            first: amountPattern.first,
            second: amountPattern.second,
            entryType: detectedType,
          });
        }
        
        // Reset the accumulator
        currentNumberGroup = [];
        currentNumberLineNums = [];
      }
      // CASE 2: Line has ONLY numbers (vertical format - accumulate)
      else if (validNumbers.length > 0 && !amountPattern) {
        currentNumberGroup.push(...validNumbers);
        currentNumberLineNums.push(lineNum);
      }
      // CASE 3: Line has ONLY amount pattern (applies to accumulated numbers)
      else if (validNumbers.length === 0 && amountPattern) {
        if (currentNumberGroup.length === 0) {
          parseErrors.push(`Line ${lineNum}: Amount pattern without numbers`);
          continue;
        }
        
        // Apply pattern to all accumulated numbers
        for (const num of currentNumberGroup) {
          const detectedType = detectEntryType(num);
          const paddedNumber = padNumber(num, detectedType);
          
          if (!isValidNumber(paddedNumber, detectedType)) {
            parseErrors.push(`Lines ${currentNumberLineNums.join(',')}: Invalid number "${num}" for ${detectedType} type`);
            continue;
          }
          
          entries.push({
            number: paddedNumber,
            first: amountPattern.first,
            second: amountPattern.second,
            entryType: detectedType,
          });
        }
        
        // Reset the group
        currentNumberGroup = [];
        currentNumberLineNums = [];
      }
      // CASE 4: Line has neither (error)
      else {
        parseErrors.push(`Line ${lineNum}: Could not parse "${line}"`);
      }
    }
    
    // Check for any remaining numbers without pattern
    if (currentNumberGroup.length > 0) {
      parseErrors.push(`Lines ${currentNumberLineNums.join(',')}: Numbers without amount pattern: ${currentNumberGroup.join(', ')}`);
    }

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
        entryType: entry.entryType, // Use auto-detected type
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
        `Added ${successCount} ${successCount === 1 ? 'entry' : 'entries'} for ${formatCurrency(totalCost)}`,
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
      {/* Input Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Paste your data here
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Paste data here...`}
          className="w-full px-6 py-5 text-xl border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono resize-none transition-all duration-200"
          rows={15}
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
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-sm">
                    {entry.number}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded uppercase font-semibold">
                    {entry.entryType}
                  </span>
                </div>
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

