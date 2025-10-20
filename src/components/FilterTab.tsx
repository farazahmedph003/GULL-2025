import React, { useState } from 'react';
import type { FilterOperator, FilterResult, NumberSummary } from '../types';

interface FilterTabProps {
  summaries: Map<string, NumberSummary>;
  entryType: 'akra' | 'ring';
  projectId: string;
  onSaveResults: (deductions: Array<{ number: string; firstAmount: number; secondAmount: number }>) => Promise<void>;
}

const FilterTab: React.FC<FilterTabProps> = ({ summaries, entryType, onSaveResults }) => {
  const [firstOperator, setFirstOperator] = useState<FilterOperator>('>=');
  const [firstValue, setFirstValue] = useState('');
  const [secondOperator, setSecondOperator] = useState<FilterOperator>('>=');
  const [secondValue, setSecondValue] = useState('');
  const [firstLimit, setFirstLimit] = useState('');
  const [secondLimit, setSecondLimit] = useState('');
  const [results, setResults] = useState<FilterResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const operators: FilterOperator[] = ['>=', '>', '<=', '<', '=='];

  const applyFilter = () => {
    const filtered: FilterResult[] = [];

    summaries.forEach((summary) => {
      const meetsFirstCriteria = checkCriteria(
        summary.firstTotal,
        firstOperator,
        firstValue
      );
      const meetsSecondCriteria = checkCriteria(
        summary.secondTotal,
        secondOperator,
        secondValue
      );

      // Calculate deduction amounts (Total - Limit)
      // Only include numbers where result > 0
      const firstLimitNum = Number(firstLimit) || 0;
      const secondLimitNum = Number(secondLimit) || 0;
      
      const calculatedFirst = meetsFirstCriteria && firstLimitNum > 0
        ? Math.max(0, summary.firstTotal - firstLimitNum)
        : 0;
      const calculatedSecond = meetsSecondCriteria && secondLimitNum > 0
        ? Math.max(0, summary.secondTotal - secondLimitNum)
        : 0;

      // Only add if at least one criteria is met
      if (meetsFirstCriteria || meetsSecondCriteria) {
        filtered.push({
          number: summary.number,
          firstAmount: calculatedFirst,
          secondAmount: calculatedSecond,
          meetsFirstCriteria,
          meetsSecondCriteria,
        });
      }
    });

    // Sort by number
    filtered.sort((a, b) => a.number.localeCompare(b.number));

    setResults(filtered);
    setShowResults(true);
  };

  const checkCriteria = (
    value: number,
    operator: FilterOperator,
    threshold: string
  ): boolean => {
    if (!threshold) return false;
    const num = Number(threshold);

    switch (operator) {
      case '>=':
        return value >= num;
      case '>':
        return value > num;
      case '<=':
        return value <= num;
      case '<':
        return value < num;
      case '==':
        return value === num;
      default:
        return false;
    }
  };

  const handleSaveResults = async () => {
    // Confirm before saving
    const confirmMessage = `This will permanently deduct the calculated amounts from the totals.\n\n` +
      `Numbers affected: ${results.length}\n` +
      `Are you sure you want to continue?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // Filter results to only include numbers with deductions > 0
      const deductions = results
        .filter(r => r.firstAmount > 0 || r.secondAmount > 0)
        .map(r => ({
          number: r.number,
          firstAmount: r.firstAmount,
          secondAmount: r.secondAmount
        }));

      if (deductions.length === 0) {
        alert('No deductions to save. All calculated results are zero.');
        return;
      }

      await onSaveResults(deductions);
      
      // Reset after successful save
      setResults([]);
      setShowResults(false);
      setFirstValue('');
      setSecondValue('');
      setFirstLimit('');
      setSecondLimit('');
      
      alert(`Successfully saved ${deductions.length} deduction(s)!`);
    } catch (error) {
      console.error('Failed to save results:', error);
      alert('Failed to save results. Please try again.');
    }
  };

  const reset = () => {
    setFirstValue('');
    setSecondValue('');
    setFirstLimit('');
    setSecondLimit('');
    setResults([]);
    setShowResults(false);
  };

  const copyToClipboard = (column: 'first' | 'second') => {
    const filtered = results.filter(r =>
      column === 'first'
        ? r.meetsFirstCriteria && r.firstAmount > 0
        : r.meetsSecondCriteria && r.secondAmount > 0
    );

    if (filtered.length === 0) {
      alert('No results to copy!');
      return;
    }

    const isFirst = column === 'first';
    const header = entryType === 'akra'
      ? `Ak\t${isFirst ? 'First' : 'Second'}`
      : `Ring\t${isFirst ? 'First' : 'Second'}`;

    const rows = filtered.map(r => {
      const amount = isFirst ? r.firstAmount : r.secondAmount;
      const prefix = isFirst ? 'F' : 'S';
      return `${r.number}\t${prefix} ${amount}`;
    });

    const data = [header, ...rows].join('\n');

    navigator.clipboard.writeText(data).then(() => {
      alert(`\u2713 Copied ${filtered.length} ${isFirst ? 'First' : 'Second'} entries to clipboard!`);
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  // Removed downloadResults - using handleSaveResults instead

  return (
    <div className="space-y-6">
      {/* Filter Criteria - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FIRST Filter */}
        <div className="bg-gray-800/50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-green-400 mb-4">
            FIRST Filter
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Operator
              </label>
              <select
                value={firstOperator}
                onChange={(e) => setFirstOperator(e.target.value as FilterOperator)}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2.5 text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Value
              </label>
              <input
                type="number"
                value={firstValue}
                onChange={(e) => setFirstValue(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2.5 text-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Result Limit
              </label>
              <input
                type="number"
                value={firstLimit}
                onChange={(e) => setFirstLimit(e.target.value)}
                placeholder="No limit"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2.5 text-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* SECOND Filter */}
        <div className="bg-gray-800/50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-yellow-400 mb-4">
            SECOND Filter
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Operator
              </label>
              <select
                value={secondOperator}
                onChange={(e) => setSecondOperator(e.target.value as FilterOperator)}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2.5 text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Value
              </label>
              <input
                type="number"
                value={secondValue}
                onChange={(e) => setSecondValue(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2.5 text-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Result Limit
              </label>
              <input
                type="number"
                value={secondLimit}
                onChange={(e) => setSecondLimit(e.target.value)}
                placeholder="No limit"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2.5 text-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-3">
        <button 
          onClick={applyFilter}
          disabled={!firstValue && !secondValue}
          className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-bold py-3 px-8 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply Filter
        </button>
        <button 
          onClick={reset}
          className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-8 rounded-lg transition-all"
        >
          Reset
        </button>
        {showResults && results.length > 0 && (
          <button 
            onClick={handleSaveResults}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-8 rounded-lg transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Results
          </button>
        )}
      </div>

      {/* Results */}
      {showResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* FIRST Panel */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
            <div className="mb-3 grid grid-cols-2 items-center">
              <div className="text-sm font-semibold text-gray-300">Number</div>
              <div className="flex items-center justify-between text-sm font-semibold text-gray-300">
                <span>FIRST (Result)</span>
                {results.some(r => r.meetsFirstCriteria && r.firstAmount > 0) && (
                  <button
                    onClick={() => copyToClipboard('first')}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Copy"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-2 min-h-[300px]">
              {results.filter(r => r.meetsFirstCriteria && r.firstAmount > 0).length === 0 ? (
                <p className="text-gray-500 text-center py-8">No matching numbers found.</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {results
                    .filter(r => r.meetsFirstCriteria && r.firstAmount > 0)
                    .sort((a, b) => a.number.localeCompare(b.number))
                    .map((result) => (
                      <div
                        key={result.number}
                        className="grid grid-cols-2 items-center px-3 py-3 hover:bg-gray-800/60 transition-colors rounded"
                      >
                        <div className="text-gray-200 font-medium">{result.number}</div>
                        <div className="text-right font-semibold text-cyan-300">{`F ${result.firstAmount.toLocaleString()}`}</div>
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
                {results.some(r => r.meetsSecondCriteria && r.secondAmount > 0) && (
                  <button
                    onClick={() => copyToClipboard('second')}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Copy"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-2 min-h-[300px]">
              {results.filter(r => r.meetsSecondCriteria && r.secondAmount > 0).length === 0 ? (
                <p className="text-gray-500 text-center py-8">No matching numbers found.</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {results
                    .filter(r => r.meetsSecondCriteria && r.secondAmount > 0)
                    .sort((a, b) => a.number.localeCompare(b.number))
                    .map((result) => (
                      <div
                        key={result.number}
                        className="grid grid-cols-2 items-center px-3 py-3 hover:bg-gray-800/60 transition-colors rounded"
                      >
                        <div className="text-gray-200 font-medium">{result.number}</div>
                        <div className="text-right font-semibold text-cyan-300">{`S ${result.secondAmount.toLocaleString()}`}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterTab;

