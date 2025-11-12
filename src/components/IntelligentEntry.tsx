import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { EntryType, AddedEntrySummary, Transaction } from '../types';
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

interface IntelligentEntryProps {
  projectId: string;
  entryType: EntryType;
  addTransaction: (transaction: Omit<Transaction, 'id'>, skipBalanceDeduction?: boolean) => Promise<Transaction | null>;
  transactions: Transaction[];
  onSuccess?: (summary: AddedEntrySummary[]) => void;
}

type EntryGroup = 'open' | 'akra' | 'ring' | 'packet';
type AmountType = 'first' | 'second';
type NumberToken = Extract<Token, { type: 'number' }>;
type AmountToken = Extract<Token, { type: 'amount' }>;

type Token =
  | {
      type: 'number';
      value: string;
      entryType: EntryGroup;
      startIndex: number;
      endIndex: number;
      line: number;
      column: number;
    }
  | {
      type: 'amount';
      amountType: AmountType;
      value: string;
      startIndex: number;
      endIndex: number;
      line: number;
      column: number;
    }
  | {
      type: 'separator';
      value: string;
      startIndex: number;
      endIndex: number;
      line: number;
      column: number;
    }
  | {
      type: 'invalid';
      value: string;
      message: string;
      startIndex: number;
      endIndex: number;
      line: number;
      column: number;
    };

interface ParseResult {
  tokens: Token[];
  numbers: Array<{
    value: string;
    entryType: EntryGroup;
    line: number;
    column: number;
    startIndex: number;
    endIndex: number;
  }>;
  amounts: Array<{
    value: string;
    amountType: AmountType;
    line: number;
    column: number;
    startIndex: number;
    endIndex: number;
  }>;
  errors: Array<{
    kind: 'number-length' | 'letter-sequence';
    value: string;
    line: number;
    column: number;
    startIndex: number;
    endIndex: number;
  }>;
}

interface Position {
  index: number;
  line: number;
  column: number;
}

const isDigit = (char: string) => char >= '0' && char <= '9';

const isLetter = (char: string) => /\p{L}/u.test(char);

const determineEntryType = (length: number): EntryGroup | null => {
  if (length === 1) return 'open';
  if (length === 2) return 'akra';
  if (length === 3) return 'ring';
  if (length === 4) return 'packet';
  return null;
};

const advancePosition = (text: string, start: Position, length: number): Position => {
  let { index, line, column } = start;
  for (let i = 0; i < length; i += 1) {
    const char = text[index];
    index += 1;
    if (char === '\n') {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
  }
  return { index, line, column };
};

const MIN_TEXTAREA_HEIGHT = 240;

const parseText = (text: string): ParseResult => {
  const tokens: Token[] = [];
  const numbers: ParseResult['numbers'] = [];
  const amounts: ParseResult['amounts'] = [];
  const errors: ParseResult['errors'] = [];

  let position: Position = { index: 0, line: 0, column: 0 };

  while (position.index < text.length) {
    const currentChar = text[position.index];
    const lowerChar = currentChar.toLowerCase();
    const tokenStart = position;
    const remainingText = text.slice(position.index);

    const byMatch = remainingText.match(/^(\d+)by(\d+)/);
    if (byMatch) {
      const [, firstValue, secondValue] = byMatch;

      const firstEndPosition = advancePosition(text, position, firstValue.length);
      tokens.push({
        type: 'amount',
        amountType: 'first',
        value: firstValue,
        startIndex: tokenStart.index,
        endIndex: firstEndPosition.index,
        line: tokenStart.line,
        column: tokenStart.column,
      });
      amounts.push({
        value: firstValue,
        amountType: 'first',
        line: tokenStart.line,
        column: tokenStart.column,
        startIndex: tokenStart.index,
        endIndex: firstEndPosition.index,
      });

      const byStartPosition = firstEndPosition;
      const byEndPosition = advancePosition(text, byStartPosition, 2);
      const byValue = text.slice(byStartPosition.index, byEndPosition.index);
      tokens.push({
        type: 'separator',
        value: byValue,
        startIndex: byStartPosition.index,
        endIndex: byEndPosition.index,
        line: byStartPosition.line,
        column: byStartPosition.column,
      });

      const secondStartPosition = byEndPosition;
      const secondEndPosition = advancePosition(text, secondStartPosition, secondValue.length);
      tokens.push({
        type: 'amount',
        amountType: 'second',
        value: secondValue,
        startIndex: secondStartPosition.index,
        endIndex: secondEndPosition.index,
        line: secondStartPosition.line,
        column: secondStartPosition.column,
      });
      amounts.push({
        value: secondValue,
        amountType: 'second',
        line: secondStartPosition.line,
        column: secondStartPosition.column,
        startIndex: secondStartPosition.index,
        endIndex: secondEndPosition.index,
      });

      position = secondEndPosition;
          continue;
        }

    if (isDigit(currentChar)) {
      let end = position.index;
      while (end < text.length && isDigit(text[end])) {
        end += 1;
      }
      const value = text.slice(position.index, end);
      const entryType = determineEntryType(value.length);
      const nextPosition = advancePosition(text, position, value.length);

      if (entryType) {
        numbers.push({
          value,
          entryType,
          line: tokenStart.line,
          column: tokenStart.column,
          startIndex: tokenStart.index,
          endIndex: nextPosition.index,
        });

        tokens.push({
          type: 'number',
          value,
          entryType,
          startIndex: tokenStart.index,
          endIndex: nextPosition.index,
          line: tokenStart.line,
          column: tokenStart.column,
        });
      } else {
        errors.push({
          kind: 'number-length',
          value,
          line: tokenStart.line,
          column: tokenStart.column,
          startIndex: tokenStart.index,
          endIndex: nextPosition.index,
        });

        tokens.push({
          type: 'invalid',
          value,
          message: `Invalid number "${value}" at line ${tokenStart.line + 1}, column ${
            tokenStart.column + 1
          }: numbers must be 1-4 digits.`,
          startIndex: tokenStart.index,
          endIndex: nextPosition.index,
          line: tokenStart.line,
          column: tokenStart.column,
        });
      }

      position = nextPosition;
          continue;
        }

    if ((lowerChar === 'f' || lowerChar === 's') && position.index + 1 < text.length) {
      let end = position.index + 1;
      while (end < text.length && isDigit(text[end])) {
        end += 1;
      }

      if (end > position.index + 1) {
        const value = text.slice(position.index, end);
        const amountType: AmountType = lowerChar === 'f' ? 'first' : 'second';
        const nextPosition = advancePosition(text, position, value.length);

        amounts.push({
          value,
          amountType,
          line: tokenStart.line,
          column: tokenStart.column,
          startIndex: tokenStart.index,
          endIndex: nextPosition.index,
        });

        tokens.push({
          type: 'amount',
          amountType,
          value,
          startIndex: tokenStart.index,
          endIndex: nextPosition.index,
          line: tokenStart.line,
          column: tokenStart.column,
        });

        position = nextPosition;
          continue;
        }
    }

    if (isLetter(currentChar)) {
      let end = position.index;
      while (end < text.length && isLetter(text[end])) {
        end += 1;
      }
      const value = text.slice(position.index, end);
      const nextPosition = advancePosition(text, position, value.length);

      errors.push({
        kind: 'letter-sequence',
        value,
        line: tokenStart.line,
        column: tokenStart.column,
        startIndex: tokenStart.index,
        endIndex: nextPosition.index,
      });

      tokens.push({
        type: 'invalid',
        value,
        message: `Invalid characters "${value}" at line ${tokenStart.line + 1}, column ${
          tokenStart.column + 1
        }: letters are not allowed between numbers.`,
        startIndex: tokenStart.index,
        endIndex: nextPosition.index,
        line: tokenStart.line,
        column: tokenStart.column,
      });

      position = nextPosition;
          continue;
        }

    let end = position.index;
    while (end < text.length && !isDigit(text[end]) && !isLetter(text[end])) {
      end += 1;
    }
    const value = text.slice(position.index, end);
    const nextPosition = advancePosition(text, position, value.length);

    tokens.push({
      type: 'separator',
      value,
      startIndex: tokenStart.index,
      endIndex: nextPosition.index,
      line: tokenStart.line,
      column: tokenStart.column,
    });

    position = nextPosition;
  }

  return { tokens, numbers, amounts, errors };
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderTokensAsHtml = (tokens: Token[]): string =>
  tokens
    .map((token) => {
      let className = 'text-gray-900 dark:text-gray-100';

      if (token.type === 'number') {
        className = 'text-yellow-500 dark:text-yellow-400 font-semibold';
      } else if (token.type === 'amount') {
        className =
          token.amountType === 'first'
            ? 'text-green-500 dark:text-green-400 font-semibold'
            : 'text-purple-500 dark:text-purple-400 font-semibold';
      } else if (token.type === 'invalid') {
        className = 'text-red-500 dark:text-red-400 font-semibold underline decoration-dotted';
      }

      return `<span class="${className}">${escapeHtml(token.value)}</span>`;
    })
    .join('');

const autoResizeTextarea = (
  textarea: HTMLTextAreaElement,
  overlay: HTMLDivElement | null,
  container: HTMLDivElement | null,
) => {
  textarea.style.height = 'auto';
  const height = Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT);
  textarea.style.height = `${height}px`;

  if (overlay) {
    overlay.style.height = `${height}px`;
  }

  if (container) {
    container.style.height = `${height}px`;
  }
};

interface EntryCandidate {
  number: string;
  entryType: EntryGroup;
  first: number;
  second: number;
}

interface EntryPreviewGroup {
  numbers: Array<{ value: string; entryType: EntryGroup }>;
  first: number;
  second: number;
}

interface BuildEntriesResult {
  entries: EntryCandidate[];
  missingAmounts: NumberToken[];
  orphanAmounts: AmountToken[];
  groups: EntryPreviewGroup[];
}

const parseAmountValue = (token: AmountToken): number | null => {
  const withoutPrefix = token.value.replace(/^[fFsS]+/, '');
  const numericPortion = withoutPrefix.replace(/[^\d.]/g, '');
  if (!numericPortion) {
    return null;
  }
  const numericValue = Number(numericPortion);
  if (Number.isNaN(numericValue)) {
    return null;
  }
  return numericValue;
};

const buildEntries = (tokens: Token[]): BuildEntriesResult => {
  const entries: EntryCandidate[] = [];
  const missingAmounts: NumberToken[] = [];
  const orphanAmounts: AmountToken[] = [];
  const groups: EntryPreviewGroup[] = [];

  let currentNumbers: NumberToken[] = [];
  let currentFirst: number | null = null;
  let currentSecond: number | null = null;

  const flush = () => {
    if (currentNumbers.length === 0) {
      currentFirst = null;
      currentSecond = null;
      return;
    }

    if (currentFirst === null && currentSecond === null) {
      missingAmounts.push(...currentNumbers);
    } else {
      currentNumbers.forEach((numberToken) => {
        entries.push({
          number: numberToken.value,
          entryType: numberToken.entryType,
          first: currentFirst ?? 0,
          second: currentSecond ?? 0,
        });
      });
    }

    groups.push({
      numbers: currentNumbers.map(({ value, entryType }) => ({ value, entryType })),
      first: currentFirst ?? 0,
      second: currentSecond ?? 0,
    });

    currentNumbers = [];
    currentFirst = null;
    currentSecond = null;
  };

  tokens.forEach((token) => {
    if (token.type === 'number') {
      if (
        currentNumbers.length > 0 &&
        (currentFirst !== null || currentSecond !== null)
      ) {
        flush();
      }
      currentNumbers.push(token);
      return;
    }

    if (token.type === 'amount') {
      if (currentNumbers.length === 0) {
        orphanAmounts.push(token);
        return;
      }

      const amountValue = parseAmountValue(token);
      if (amountValue === null) {
        return;
      }

      if (token.amountType === 'first') {
        currentFirst = amountValue;
          } else {
        currentSecond = amountValue;
      }
      return;
    }
  });

  flush();

  return { entries, missingAmounts, orphanAmounts, groups };
};

const padNumberValue = (value: string, type: EntryGroup): string =>
  padNumberForEntryType(value, type);

const IntelligentEntry: React.FC<IntelligentEntryProps> = ({
  projectId,
  entryType: _entryType,
  addTransaction,
  transactions,
  onSuccess: _onSuccess,
}) => {
  const [inputText, setInputText] = useState('');
  const [submissionErrors, setSubmissionErrors] = useState<string[]>([]);
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { balance, hasSufficientBalance, deductBalance } = useUserBalance();
  const { showSuccess, showError } = useNotifications();
  const { amountLimits } = useSystemSettings();

  const parseResult = useMemo(() => parseText(inputText), [inputText]);
  const parsedEntries = useMemo(
    () => buildEntries(parseResult.tokens),
    [parseResult.tokens],
  );

  useEffect(() => {
    if (!overlayRef.current) {
      return;
    }
    overlayRef.current.innerHTML = renderTokensAsHtml(parseResult.tokens);
  }, [parseResult.tokens]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    autoResizeTextarea(textarea, overlayRef.current, containerRef.current);
  }, [inputText]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !overlayRef.current) {
      return;
    }

    const handleScroll = () => {
      if (!overlayRef.current) return;
        overlayRef.current.scrollTop = textarea.scrollTop;
        overlayRef.current.scrollLeft = textarea.scrollLeft;
    };

    textarea.addEventListener('scroll', handleScroll);
    return () => {
      textarea.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleAdd = async () => {
    setSubmissionErrors([]);
    setBalanceMessage(null);

    if (!inputText.trim()) {
      setSubmissionErrors(['Please paste numbers and amounts before adding entries.']);
      return;
    }

    if (parseResult.errors.length > 0) {
      setSubmissionErrors(['Fix the highlighted issues above before adding entries.']);
      return;
    }

    const { entries, missingAmounts, orphanAmounts } = parsedEntries;

    const issues: string[] = [];

    if (orphanAmounts.length > 0) {
      const orphanList = orphanAmounts
        .map(
          (token) =>
            `${token.value} (line ${token.line + 1}, column ${token.column + 1})`,
        )
        .join(', ');
      issues.push(
        `Amounts ${orphanList} appear before any numbers. Place numbers before the amount values.`,
      );
    }

    if (missingAmounts.length > 0) {
      const missingList = missingAmounts
        .map(
          (token) =>
            `${token.value} (line ${token.line + 1}, column ${token.column + 1})`,
        )
        .join(', ');
      issues.push(
        `Numbers ${missingList} do not have any F or S amounts after them. Add at least one amount for each number.`,
      );
    }

    if (entries.length === 0 && issues.length === 0) {
      issues.push('No valid entries found. Add numbers followed by F and/or S amounts.');
    }

    if (issues.length > 0) {
      setSubmissionErrors(issues);
      return;
    }

    const totalCost = entries.reduce((sum, entry) => sum + entry.first + entry.second, 0);

    if (totalCost === 0) {
      setSubmissionErrors(['Add at least one F or S amount before submitting.']);
      return;
    }

    if (!hasSufficientBalance(totalCost)) {
      setBalanceMessage(
        `Insufficient balance. You need ${formatCurrency(totalCost)} but only have ${formatCurrency(balance)}.`,
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (totalCost > 0) {
        const balanceSuccess = await deductBalance(totalCost);
        if (!balanceSuccess) {
          setBalanceMessage('Failed to deduct balance. Please try again.');
      return;
        }
      }

      const now = new Date().toISOString();
      const additionsByNumber = new Map<
        string,
        { entryType: EntryGroup; addFirst: number; addSecond: number }
      >();

      entries.forEach((entry) => {
        const padded = padNumberValue(entry.number, entry.entryType);
        const accumulator =
          additionsByNumber.get(padded) || { entryType: entry.entryType, addFirst: 0, addSecond: 0 };
        accumulator.addFirst += entry.first;
        accumulator.addSecond += entry.second;
        additionsByNumber.set(padded, accumulator);
      });

      for (const [paddedNumber, addition] of additionsByNumber.entries()) {
        const entryType = addition.entryType as EntryType;
        const limits = getLimitsForEntryType(amountLimits, entryType);
        const existingTotals = getExistingTotalsForNumber(transactions, entryType, paddedNumber);

        if (limits.first !== null && addition.addFirst > 0) {
          const totalFirst = existingTotals.first + addition.addFirst;
          if (totalFirst > limits.first) {
            setSubmissionErrors([
              `Number ${paddedNumber} exceeds First limit (${limits.first}). Current total is ${existingTotals.first}.`,
            ]);
            setIsSubmitting(false);
            return;
          }
        }

        if (limits.second !== null && addition.addSecond > 0) {
          const totalSecond = existingTotals.second + addition.addSecond;
          if (totalSecond > limits.second) {
            setSubmissionErrors([
              `Number ${paddedNumber} exceeds Second limit (${limits.second}). Current total is ${existingTotals.second}.`,
            ]);
          setIsSubmitting(false);
          return;
          }
        }
      }

      const transactionsToAdd: Array<Omit<Transaction, 'id'>> = entries.map((entry) => ({
        projectId,
        userId: user?.id,
        number: padNumberValue(entry.number, entry.entryType),
        entryType: entry.entryType,
        first: entry.first,
        second: entry.second,
        createdAt: now,
        updatedAt: now,
      }));

      const results = await Promise.all(
        transactionsToAdd.map((transaction) => addTransaction(transaction, true)),
      );

      const successfulResults = results.filter(
        (transaction): transaction is Transaction => transaction !== null,
      );

      if (successfulResults.length === 0) {
        setSubmissionErrors(['Failed to add entries. Please try again.']);
        await showError(
          'Error Adding Entry',
          'An error occurred while adding the transaction. Please try again.',
          { duration: 5000 },
        );
        return;
      }

      setInputText('');
      setSubmissionErrors([]);
      setBalanceMessage(null);

      playSuccessSound();

      const entryCounts = entries.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.entryType] = (acc[entry.entryType] || 0) + 1;
        return acc;
      }, {});

      const entryTypesAdded = Object.entries(entryCounts)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');

      await showSuccess(
        'Entries Added Successfully',
        `Added ${entries.length} entries (${entryTypesAdded}) for ${formatCurrency(totalCost)}`,
        { duration: 2000 },
      );

      _onSuccess?.(
        successfulResults.map<AddedEntrySummary>((transaction) => ({
          id: transaction.id,
          number: transaction.number,
          entryType: transaction.entryType,
          first: transaction.first,
          second: transaction.second,
        })),
      );

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } catch (error) {
      console.error('Error adding entries:', error);
      setSubmissionErrors(['An unexpected error occurred while adding entries. Please try again.']);
      await showError(
        'Error Adding Entry',
        'An error occurred while adding the transaction. Please try again.',
        { duration: 5000 },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="w-full">
        <div
          ref={containerRef}
          className="relative border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700"
          style={{ minHeight: `${MIN_TEXTAREA_HEIGHT}px` }}
        >
        <div
          ref={overlayRef}
            className="absolute inset-0 px-6 py-5 text-xl leading-[1.6] font-mono whitespace-pre-wrap break-words pointer-events-none overflow-hidden text-gray-900 dark:text-gray-100"
            style={{ zIndex: 0 }}
          />

        <textarea
          ref={textareaRef}
          value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onInput={(e) =>
              autoResizeTextarea(
                e.currentTarget,
                overlayRef.current,
                containerRef.current,
              )
            }
            className="w-full px-6 py-5 text-xl leading-[1.6] font-mono border-none bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none relative z-10 overflow-hidden"
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
              minHeight: `${MIN_TEXTAREA_HEIGHT}px`,
            color: 'transparent',
              caretColor: '#60a5fa',
            WebkitTextFillColor: 'transparent',
          }}
          autoComplete="off"
          rows={1}
          spellCheck={false}
        />
        </div>
        </div>
        
      {parseResult.errors.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
          <div className="flex items-start space-x-3">
            <svg
              className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                Input issues detected
              </h4>
              <ul className="space-y-2 text-sm text-yellow-700 dark:text-yellow-300">
                {parseResult.errors.map((error) => (
                  <li
                    key={`${error.startIndex}-${error.endIndex}-${error.value}`}
                    className="leading-relaxed"
                  >
                    <p className="font-medium">
                      Line {error.line + 1}, column {error.column + 1}
                    </p>
                    {error.kind === 'letter-sequence' ? (
                      <p>
                        Letters like{' '}
                        <code className="px-1 py-0.5 rounded bg-yellow-100 dark:bg-yellow-800/40">
                          {error.value}
                        </code>{' '}
                        are not allowed between numbers. Use separators such as
                        space or punctuation instead.
                      </p>
                    ) : (
                      <p>
                        Number{' '}
                        <code className="px-1 py-0.5 rounded bg-yellow-100 dark:bg-yellow-800/40">
                          {error.value}
                        </code>{' '}
                        has {error.value.length} digits. Only 1 to 4 digits are
                        allowed.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
        </div>
          </div>
        </div>
      )}

      {submissionErrors.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
          <div className="flex items-start space-x-3">
            <svg
              className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                Please fix these issues
              </h4>
              <ul className="space-y-2 text-sm text-yellow-700 dark:text-yellow-300">
                {submissionErrors.map((error) => (
                  <li key={error} className="leading-relaxed">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {balanceMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <div className="flex items-start space-x-3">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-200">
                Insufficient Balance
              </h4>
              <p className="text-sm text-red-600 dark:text-red-400">{balanceMessage}</p>
            </div>
          </div>
        </div>
      )}

      {parsedEntries.groups.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 bg-gray-50 dark:bg-gray-800/40">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
            Parsed Preview
          </h4>
          <div className="space-y-2">
            {parsedEntries.groups.map((group, index) => {
              const hasFirst = group.first > 0;
              const hasSecond = group.second > 0;
              const isGroup = group.numbers.length > 1;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 px-3 py-2 shadow-sm"
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                        isGroup
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}
                    >
                      {isGroup ? 'Group' : 'Single'}
                    </span>
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                      {group.numbers.map((n) => n.value).join(', ')}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-sm font-medium">
                    {hasFirst ? (
                      <span className="text-green-600 dark:text-green-400">F {group.first}</span>
                    ) : null}
                    {hasSecond ? (
                      <span className="text-purple-600 dark:text-purple-400">
                        S {group.second}
                      </span>
                    ) : null}
                    {!hasFirst && !hasSecond ? (
                      <span className="text-gray-500 dark:text-gray-400">--</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

        <div className="flex justify-end">
          <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-md hover:shadow-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting || !inputText.trim()}
          >
          {isSubmitting ? 'Processing...' : 'Add'}
          </button>
        </div>
      </div>
  );
};

export default IntelligentEntry;
