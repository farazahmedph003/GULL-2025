import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import ProjectHeader from '../components/ProjectHeader';
import EntryPanel from '../components/EntryPanel';
import FloatingActionButton from '../components/FloatingActionButton';
import { useTransactions } from '../hooks/useTransactions';
import { useHistory } from '../hooks/useHistory';
import { useUserBalance } from '../hooks/useUserBalance';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';
import { getProject } from '../utils/storage';
import type { EntryType } from '../types';

const AdvancedFilter: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedType, setSelectedType] = useState<EntryType>('akra');
  const [entryPanelOpen, setEntryPanelOpen] = useState(false);
  
  // Filter states
  const [firstNumbers, setFirstNumbers] = useState('');
  const [secondNumbers, setSecondNumbers] = useState('');
  
  const project = getProject(id || '');
  const { 
    transactions, 
    refresh: refreshTransactions, 
    addTransaction
  } = useTransactions(id || '');
  const { refresh: refreshBalance } = useUserBalance();
  
  const { addAction } = useHistory(id || '', {
    onRevert: () => {},
    onApply: () => {},
  });
  
  // Comprehensive refresh function
  const refresh = () => {
    refreshTransactions();
    refreshBalance();
  };

  // Group transactions
  const summaries = useMemo(
    () => groupTransactionsByNumber(transactions, selectedType),
    [transactions, selectedType]
  );

  // Advanced search filter for numbers with wildcard and command support
  const matchesSearch = (number: string, query: string): boolean => {
    if (!query) return false;
    
    const trimmedQuery = query.trim().toLowerCase();
    const lowerNumber = number.toLowerCase();
    
    // Command: starts:
    if (trimmedQuery.startsWith('starts:')) {
      const searchPattern = trimmedQuery.replace('starts:', '');
      return lowerNumber.startsWith(searchPattern);
    }
    
    // Command: ends:
    if (trimmedQuery.startsWith('ends:')) {
      const searchPattern = trimmedQuery.replace('ends:', '');
      return lowerNumber.endsWith(searchPattern);
    }
    
    // Command: middle: (only for Ring - 3 digit numbers)
    if (trimmedQuery.startsWith('middle:')) {
      const searchPattern = trimmedQuery.replace('middle:', '');
      if (lowerNumber.length === 3) {
        return lowerNumber.charAt(1) === searchPattern;
      }
      return false;
    }
    
    // Wildcard: starts with (e.g., "1*")
    if (trimmedQuery.endsWith('*') && !trimmedQuery.startsWith('*')) {
      const searchPattern = trimmedQuery.slice(0, -1);
      return lowerNumber.startsWith(searchPattern);
    }
    
    // Wildcard: ends with (e.g., "*3")
    if (trimmedQuery.startsWith('*') && !trimmedQuery.endsWith('*')) {
      const searchPattern = trimmedQuery.slice(1);
      return lowerNumber.endsWith(searchPattern);
    }
    
    // Wildcard: starts and ends (e.g., "1*3")
    if (trimmedQuery.includes('*')) {
      const parts = trimmedQuery.split('*');
      if (parts.length === 2) {
        const startPart = parts[0];
        const endPart = parts[1];
        return lowerNumber.startsWith(startPart) && lowerNumber.endsWith(endPart);
      }
    }
    
    // Simple contains search
    return lowerNumber.includes(trimmedQuery);
  };

  // Filter results for First
  const firstFilteredResults = useMemo(() => {
    if (!firstNumbers.trim()) return [];
    
    const results: Array<{ number: string; amount: number }> = [];
    summaries.forEach((summary, number) => {
      if (summary.firstTotal > 0 && matchesSearch(number, firstNumbers)) {
        results.push({
          number,
          amount: summary.firstTotal,
        });
      }
    });

    return results.sort((a, b) => a.number.localeCompare(b.number));
  }, [summaries, firstNumbers]);

  // Filter results for Second
  const secondFilteredResults = useMemo(() => {
    if (!secondNumbers.trim()) return [];
    
    const results: Array<{ number: string; amount: number }> = [];
    summaries.forEach((summary, number) => {
      if (summary.secondTotal > 0 && matchesSearch(number, secondNumbers)) {
        results.push({
          number,
          amount: summary.secondTotal,
        });
      }
    });

    return results.sort((a, b) => a.number.localeCompare(b.number));
  }, [summaries, secondNumbers]);

  // Copy function with special formatting
  const copyFirstResults = () => {
    if (firstFilteredResults.length === 0) {
      alert('No results to copy!');
      return;
    }

    const header = selectedType === 'akra' ? 'Ak\tFirst' : 'Ring\tFirst';
    const rows = firstFilteredResults.map(r => `${r.number}\tF ${r.amount}`);
    const data = [header, ...rows].join('\n');

    navigator.clipboard.writeText(data).then(() => {
      alert(`✓ Copied ${firstFilteredResults.length} First entries to clipboard!`);
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  const copySecondResults = () => {
    if (secondFilteredResults.length === 0) {
      alert('No results to copy!');
      return;
    }

    const header = selectedType === 'akra' ? 'Ak\tSecond' : 'Ring\tSecond';
    const rows = secondFilteredResults.map(r => `${r.number}\tS ${r.amount}`);
    const data = [header, ...rows].join('\n');

    navigator.clipboard.writeText(data).then(() => {
      alert(`✓ Copied ${secondFilteredResults.length} Second entries to clipboard!`);
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  // Deduct functions
  const deductFirstResults = async () => {
    if (firstFilteredResults.length === 0) {
      alert('No results to deduct!');
      return;
    }

    const confirmDeduct = window.confirm(
      `Are you sure you want to deduct ${firstFilteredResults.length} First entries?`
    );

    if (!confirmDeduct) return;

    try {
      const affectedNumbers: string[] = [];

      // Create deduction transactions for each result
      for (const result of firstFilteredResults) {
        const deductionTransaction = {
          projectId: id || '',
          number: result.number,
          entryType: selectedType,
          first: -result.amount, // Negative amount for deduction
          second: 0,
          notes: `Deducted from Advanced Filter - First`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await addTransaction(deductionTransaction);
        affectedNumbers.push(result.number);
      }

      // Record in history
      addAction('filter', `Applied first deductions to ${firstFilteredResults.length} numbers`, affectedNumbers);

      alert(`✓ Successfully deducted ${firstFilteredResults.length} First entries!`);
      refresh();
    } catch (error) {
      console.error('Error deducting first results:', error);
      alert('Failed to deduct entries. Please try again.');
    }
  };

  const deductSecondResults = async () => {
    if (secondFilteredResults.length === 0) {
      alert('No results to deduct!');
      return;
    }

    const confirmDeduct = window.confirm(
      `Are you sure you want to deduct ${secondFilteredResults.length} Second entries?`
    );

    if (!confirmDeduct) return;

    try {
      const affectedNumbers: string[] = [];

      // Create deduction transactions for each result
      for (const result of secondFilteredResults) {
        const deductionTransaction = {
          projectId: id || '',
          number: result.number,
          entryType: selectedType,
          first: 0,
          second: -result.amount, // Negative amount for deduction
          notes: `Deducted from Advanced Filter - Second`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await addTransaction(deductionTransaction);
        affectedNumbers.push(result.number);
      }

      // Record in history
      addAction('filter', `Applied second deductions to ${secondFilteredResults.length} numbers`, affectedNumbers);

      alert(`✓ Successfully deducted ${secondFilteredResults.length} Second entries!`);
      refresh();
    } catch (error) {
      console.error('Error deducting second results:', error);
      alert('Failed to deduct entries. Please try again.');
    }
  };

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <ProjectHeader 
        projectName={project.name} 
        projectDate={project.date} 
        projectId={id}
        onRefresh={refresh}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            🔍 Advanced Filter & Calculator
          </h1>
          <p className="text-gray-400">
            Search and filter numbers based on amount conditions
          </p>
        </div>

        {/* Type Selection */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setSelectedType('akra')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              selectedType === 'akra'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Akra (00-99)
          </button>
          <button
            onClick={() => setSelectedType('ring')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              selectedType === 'ring'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Ring (000-999)
          </button>
        </div>

      {/* Two-Panel Layout (match FilterTab layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* FIRST Panel */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="mb-3 grid grid-cols-2 items-center">
            <div className="text-sm font-semibold text-gray-300">Number</div>
            <div className="flex items-center justify-between text-sm font-semibold text-gray-300">
              <span>FIRST (Result)</span>
              {firstFilteredResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyFirstResults}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Copy"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={deductFirstResults}
                    className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                    title="Deduct"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

            <input
              type="text"
              value={firstNumbers}
              onChange={(e) => setFirstNumbers(e.target.value)}
              placeholder="e.g., 5, 1*, *3, starts:8, ends:0"
              className="w-full bg-gray-900 text-gray-300 border-none rounded-lg px-4 py-3 mb-4 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {/* First Results */}
            <div className="bg-gray-900 rounded-lg p-2 min-h-[300px]">
              {firstFilteredResults.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No matching numbers found.</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {firstFilteredResults.map((result) => (
                    <div
                      key={result.number}
                      className="grid grid-cols-2 items-center px-3 py-3 hover:bg-gray-800/60 transition-colors rounded"
                    >
                      <div className="text-gray-200 font-medium">{result.number}</div>
                      <div className="text-right font-semibold text-cyan-300">{`F ${result.amount.toLocaleString()}`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECOND Panel */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="mb-3 grid grid-cols-2 items-center">
            <div className="text-sm font-semibold text-gray-300">Number</div>
            <div className="flex items-center justify-between text-sm font-semibold text-gray-300">
              <span>SECOND (Result)</span>
              {secondFilteredResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copySecondResults}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Copy"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={deductSecondResults}
                    className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                    title="Deduct"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

            <input
              type="text"
              value={secondNumbers}
              onChange={(e) => setSecondNumbers(e.target.value)}
              placeholder="e.g., 5, 1*, *3, starts:8, ends:0"
              className="w-full bg-gray-900 text-gray-300 border-none rounded-lg px-4 py-3 mb-4 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Second Results */}
            <div className="bg-gray-900 rounded-lg p-2 min-h-[300px]">
              {secondFilteredResults.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No matching numbers found.</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {secondFilteredResults.map((result) => (
                    <div
                      key={result.number}
                      className="grid grid-cols-2 items-center px-3 py-3 hover:bg-gray-800/60 transition-colors rounded"
                    >
                      <div className="text-gray-200 font-medium">{result.number}</div>
                      <div className="text-right font-semibold text-cyan-300">{`S ${result.amount.toLocaleString()}`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Use Advanced Search
          </h3>
          <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
            <div>
              <p className="font-semibold mb-2">Search Patterns:</p>
              <ul className="space-y-1 ml-4">
                <li><strong>Contains:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">5</code> to find any number containing &quot;5&quot; (e.g., 05, 15, 50, 55)</li>
                <li><strong>Starts with:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">1*</code> to find numbers starting with &quot;1&quot; (e.g., 10, 11, 12...)</li>
                <li><strong>Ends with:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">*3</code> to find numbers ending with &quot;3&quot; (e.g., 03, 13, 23...)</li>
                <li><strong>Starts & Ends:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">1*3</code> to find numbers starting with &quot;1&quot; and ending with &quot;3&quot;</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-2">Commands:</p>
              <ul className="space-y-1 ml-4">
                <li><strong>starts:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">starts:8</code> to find numbers starting with &quot;8&quot;</li>
                <li><strong>ends:</strong> Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">ends:0</code> to find numbers ending with &quot;0&quot;</li>
                <li><strong>middle:</strong> (Ring only) Type <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded">middle:4</code> to find 3-digit numbers with &quot;4&quot; in the middle</li>
              </ul>
            </div>
            <p className="mt-3 p-2 bg-blue-100 dark:bg-blue-900/40 rounded">
              <strong>Copy Format:</strong> Click the copy button to copy results with tab separation and &quot;F&quot; prefix for First, &quot;S&quot; prefix for Second amounts
            </p>
          </div>
        </div>
      </div>

      {/* Floating Add Entry Button (restored) */}
      <FloatingActionButton
        onClick={() => setEntryPanelOpen(true)}
        position="bottom-right"
        color="primary"
        label="Add Entry (Ctrl+E)"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        }
      />

      {/* Entry Panel (kept available, but no overlay now) */}
      <EntryPanel
        isOpen={entryPanelOpen}
        onClose={() => setEntryPanelOpen(false)}
        projectId={id || ''}
        entryType={selectedType}
        onEntryAdded={() => {
          refresh();
          setEntryPanelOpen(false);
        }}
      />
    </div>
  );
};

export default AdvancedFilter;
