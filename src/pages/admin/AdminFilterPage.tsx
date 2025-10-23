import React, { useState, useMemo } from 'react';
import { db } from '../../services/database';
import { useNotifications } from '../../contexts/NotificationContext';
import { groupTransactionsByNumber } from '../../utils/transactionHelpers';
import type { EntryType } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

type ComparisonType = '>=' | '>' | '<=' | '<' | '==';

interface CalculationResult {
  number: string;
  firstOriginal: number;
  firstResult: number;
  secondOriginal: number;
  secondResult: number;
}

const AdminFilterPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<EntryType>('open');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter states
  const [firstComparison, setFirstComparison] = useState<ComparisonType>('>=');
  const [firstFilterValue, setFirstFilterValue] = useState('');
  const [secondComparison, setSecondComparison] = useState<ComparisonType>('>=');
  const [secondFilterValue, setSecondFilterValue] = useState('');
  
  // Limit states
  const [firstLimit, setFirstLimit] = useState('');
  const [secondLimit, setSecondLimit] = useState('');
  
  // Results
  const [calculatedResults, setCalculatedResults] = useState<CalculationResult[]>([]);
  const [showSaveButton] = useState(false);
  const [viewMode, setViewMode] = useState<'combined' | 'per-user'>('combined');

  const { showSuccess, showError } = useNotifications();

  // Load entries when type changes
  React.useEffect(() => {
    loadEntries();
  }, [selectedType]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await db.getAllEntriesByType(selectedType);
      
      // Convert to transaction format
      const transactions = data.map((e: any) => ({
        id: e.id,
        number: e.number,
        entryType: e.entry_type,
        first: e.first_amount,
        second: e.second_amount,
        userId: e.user_id,
        username: e.app_users?.username || 'Unknown',
      }));
      
      setEntries(transactions);
    } catch (error) {
      console.error('Error loading entries:', error);
      showError('Error', 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  // Group transactions
  const summaries = useMemo(
    () => groupTransactionsByNumber(entries, selectedType),
    [entries, selectedType]
  );

  // Comparison function
  const compare = (value: number, comparison: ComparisonType, threshold: number): boolean => {
    switch (comparison) {
      case '>=': return value >= threshold;
      case '>': return value > threshold;
      case '<=': return value <= threshold;
      case '<': return value < threshold;
      case '==': return value === threshold;
      default: return false;
    }
  };

  // Apply filter and calculate
  const handleApplyFilter = () => {
    const results: CalculationResult[] = [];
    const firstThreshold = parseFloat(firstFilterValue) || 0;
    const secondThreshold = parseFloat(secondFilterValue) || 0;
    const firstLimitValue = parseFloat(firstLimit) || 0;
    const secondLimitValue = parseFloat(secondLimit) || 0;

    summaries.forEach((summary, number) => {
      const passesFirstFilter = firstFilterValue ? compare(summary.firstTotal, firstComparison, firstThreshold) : true;
      const passesSecondFilter = secondFilterValue ? compare(summary.secondTotal, secondComparison, secondThreshold) : true;

      if (passesFirstFilter || passesSecondFilter) {
        const firstResult = summary.firstTotal > firstLimitValue ? summary.firstTotal - firstLimitValue : 0;
        const secondResult = summary.secondTotal > secondLimitValue ? summary.secondTotal - secondLimitValue : 0;

        if (firstResult > 0 || secondResult > 0) {
          results.push({
            number,
            firstOriginal: summary.firstTotal,
            firstResult,
            secondOriginal: summary.secondTotal,
            secondResult,
          });
        }
      }
    });

    results.sort((a, b) => a.number.localeCompare(b.number));
    setCalculatedResults(results);
    setShowSaveButton(results.length > 0);
  };

  const handleReset = () => {
    setFirstFilterValue('');
    setSecondFilterValue('');
    setFirstLimit('');
    setSecondLimit('');
    setCalculatedResults([]);
    setShowSaveButton(false);
  };

  const copyFirstResults = () => {
    const data = calculatedResults
      .filter(r => r.firstResult > 0)
      .map(r => `${r.number}\t${r.firstResult}`)
      .join('\n');
    
    navigator.clipboard.writeText(data).then(() => {
      showSuccess('Success', `Copied ${calculatedResults.filter(r => r.firstResult > 0).length} First results!`);
    });
  };

  const copySecondResults = () => {
    const data = calculatedResults
      .filter(r => r.secondResult > 0)
      .map(r => `${r.number}\t${r.secondResult}`)
      .join('\n');
    
    navigator.clipboard.writeText(data).then(() => {
      showSuccess('Success', `Copied ${calculatedResults.filter(r => r.secondResult > 0).length} Second results!`);
    });
  };

  const firstTotal = calculatedResults.reduce((sum, r) => sum + r.firstResult, 0);
  const secondTotal = calculatedResults.reduce((sum, r) => sum + r.secondResult, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🧮 Filter & Calculate
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Filter and calculate deductions across all users
          </p>
        </div>

        {/* Entry Type Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Select Data Source</h2>
          <div className="flex flex-wrap gap-3">
            {(['open', 'akra', 'ring', 'packet'] as EntryType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  selectedType === type
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="mt-4 flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">View Mode:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('combined')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  viewMode === 'combined'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Combined
              </button>
              <button
                onClick={() => setViewMode('per-user')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  viewMode === 'per-user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Per-User Breakdown
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner text={`Loading ${selectedType} entries...`} />
          </div>
        ) : (
          <>
            {/* Filter Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                🔍 Step 1: Apply Filters
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* First Filter */}
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    💰 FIRST Filter
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={firstComparison}
                      onChange={(e) => setFirstComparison(e.target.value as ComparisonType)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-16 text-center"
                    >
                      <option value=">=">≥</option>
                      <option value=">">{'>'}</option>
                      <option value="<=">≤</option>
                      <option value="<">{'<'}</option>
                      <option value="==">{'='}</option>
                    </select>
                    <input
                      type="number"
                      value={firstFilterValue}
                      onChange={(e) => setFirstFilterValue(e.target.value)}
                      placeholder="Enter value"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Second Filter */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    💎 SECOND Filter
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={secondComparison}
                      onChange={(e) => setSecondComparison(e.target.value as ComparisonType)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-16 text-center"
                    >
                      <option value=">=">≥</option>
                      <option value=">">{'>'}</option>
                      <option value="<=">≤</option>
                      <option value="<">{'<'}</option>
                      <option value="==">{'='}</option>
                    </select>
                    <input
                      type="number"
                      value={secondFilterValue}
                      onChange={(e) => setSecondFilterValue(e.target.value)}
                      placeholder="Enter value"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Limit Section */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-xl border border-yellow-200 dark:border-yellow-800 mb-4">
                <h4 className="text-md font-bold text-gray-900 dark:text-white mb-4">
                  ⚡ Step 2: Set Limits (Result = Original - Limit)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      💰 FIRST Limit
                    </label>
                    <input
                      type="number"
                      value={firstLimit}
                      onChange={(e) => setFirstLimit(e.target.value)}
                      placeholder="e.g., 100"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      💎 SECOND Limit
                    </label>
                    <input
                      type="number"
                      value={secondLimit}
                      onChange={(e) => setSecondLimit(e.target.value)}
                      placeholder="e.g., 100"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleApplyFilter}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg transition-all"
                >
                  Apply Filter
                </button>

                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Results */}
            {calculatedResults.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    📊 Filtered & Calculated Results
                  </h3>
                  <div className="flex gap-2">
                    <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <span className="text-xs text-gray-600 dark:text-gray-400">First Total:</span>
                      <span className="ml-2 font-bold text-green-700 dark:text-green-300">{firstTotal}</span>
                    </div>
                    <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Second Total:</span>
                      <span className="ml-2 font-bold text-blue-700 dark:text-blue-300">{secondTotal}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* First Results */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-900 dark:text-white">💰 FIRST Results</h4>
                      <button
                        onClick={copyFirstResults}
                        className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 max-h-96 overflow-y-auto space-y-2">
                      {calculatedResults.filter(r => r.firstResult > 0).map((result) => (
                        <div
                          key={`first-${result.number}`}
                          className="bg-white dark:bg-gray-800 p-3 rounded-lg flex justify-between items-center"
                        >
                          <span className="font-bold text-gray-900 dark:text-white">{result.number}</span>
                          <div className="text-right">
                            <div className="text-sm text-gray-500 dark:text-gray-400 line-through">
                              {result.firstOriginal}
                            </div>
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                              {result.firstResult}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Second Results */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-900 dark:text-white">💎 SECOND Results</h4>
                      <button
                        onClick={copySecondResults}
                        className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 max-h-96 overflow-y-auto space-y-2">
                      {calculatedResults.filter(r => r.secondResult > 0).map((result) => (
                        <div
                          key={`second-${result.number}`}
                          className="bg-white dark:bg-gray-800 p-3 rounded-lg flex justify-between items-center"
                        >
                          <span className="font-bold text-gray-900 dark:text-white">{result.number}</span>
                          <div className="text-right">
                            <div className="text-sm text-gray-500 dark:text-gray-400 line-through">
                              {result.secondOriginal}
                            </div>
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {result.secondResult}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminFilterPage;



