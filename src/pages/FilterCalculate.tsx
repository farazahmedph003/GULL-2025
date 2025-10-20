import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProjectHeader from '../components/ProjectHeader';
import TabNavigation from '../components/TabNavigation';
import { useTransactions } from '../hooks/useTransactions';
import { useHistory } from '../hooks/useHistory';
import { groupTransactionsByNumber } from '../utils/transactionHelpers';
import { db } from '../services/database';
import type { TabItem, EntryType, Transaction } from '../types';

type ComparisonType = '>=' | '>' | '<=' | '<' | '==';

interface CalculationResult {
  number: string;
  firstOriginal: number;
  firstResult: number;
  secondOriginal: number;
  secondResult: number;
}

const FilterCalculate: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedType, setSelectedType] = useState<EntryType>('akra');
  
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
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  
  // Load project from database
  useEffect(() => {
    const loadProject = async () => {
      if (!id) return;
      
      try {
        const projectData = await db.getProject(id);
        setProject(projectData);
      } catch (error) {
        console.error('Error loading project:', error);
      } finally {
        setProjectLoading(false);
      }
    };

    loadProject();
  }, [id]);
  
  const { 
    transactions, 
    addTransaction,
    deleteTransaction,
    updateTransaction,
    bulkDeleteTransactions
  } = useTransactions(id || '');

  const { 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    addAction 
  } = useHistory(id || '', {
    onRevert: async (action) => {
      if (action.type === 'add' && action.data?.transactionId) {
        await deleteTransaction(action.data.transactionId);
      } else if (action.type === 'delete' && action.data?.transaction) {
        await addTransaction(action.data.transaction);
      } else if (action.type === 'edit' && action.data?.originalTransaction) {
        await updateTransaction(action.data.transactionId, action.data.originalTransaction);
      } else if (action.type === 'batch' && action.data?.transactions) {
        for (const t of action.data.transactions) {
          await addTransaction(t);
        }
      } else if (action.type === 'filter' && action.data?.transactionIds) {
        // Revert filter deductions by deleting the created deduction transactions
        for (const transactionId of action.data.transactionIds) {
          await deleteTransaction(transactionId);
        }
      }
    },
    onApply: async (action) => {
      if (action.type === 'add' && action.data?.transaction) {
        await addTransaction(action.data.transaction);
      } else if (action.type === 'delete' && action.data?.transactionId) {
        await deleteTransaction(action.data.transactionId);
      } else if (action.type === 'edit' && action.data?.updatedTransaction) {
        await updateTransaction(action.data.transactionId, action.data.updatedTransaction);
      } else if (action.type === 'batch' && action.data?.transactionIds) {
        await bulkDeleteTransactions(action.data.transactionIds);
      } else if (action.type === 'filter' && action.data?.transactions) {
        // Redo filter deductions by re-adding the deduction transactions
        for (const transaction of action.data.transactions) {
          await addTransaction(transaction);
        }
      }
    },
  });

  // Group transactions
  const summaries = useMemo(
    () => groupTransactionsByNumber(transactions, selectedType),
    [transactions, selectedType]
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
      // Check if number passes filters
      const passesFirstFilter = firstFilterValue ? compare(summary.firstTotal, firstComparison, firstThreshold) : true;
      const passesSecondFilter = secondFilterValue ? compare(summary.secondTotal, secondComparison, secondThreshold) : true;

      if (passesFirstFilter || passesSecondFilter) {
        // Calculate results (Original - Limit, only if Original > Limit)
        const firstResult = summary.firstTotal > firstLimitValue ? summary.firstTotal - firstLimitValue : 0;
        const secondResult = summary.secondTotal > secondLimitValue ? summary.secondTotal - secondLimitValue : 0;

        // Only add to results if there's a deduction (result > 0)
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

  // Save deductions to database
  const handleSaveResults = async () => {
    if (!id || calculatedResults.length === 0) return;

    if (!confirm(`Save ${calculatedResults.length} deduction entries to database?`)) {
      return;
    }

    try {
      // Store current transactions count to find new ones after adding
      const beforeCount = transactions.length;
      const affectedNumbers: string[] = [];
      const deductionTransactions: Omit<Transaction, 'id'>[] = [];

      const validResults = calculatedResults.filter(result => result.firstResult > 0 || result.secondResult > 0);
      
      for (const result of validResults) {
        const transactionData: Omit<Transaction, 'id'> = {
          projectId: id,
          number: result.number,
          entryType: selectedType,
          first: -result.firstResult, // Negative for deduction
          second: -result.secondResult, // Negative for deduction
          notes: `Filter & Calculate Deduction (Limit: F ${firstLimit || 0}, S ${secondLimit || 0})`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isFilterDeduction: true,
        };

        deductionTransactions.push(transactionData);
        affectedNumbers.push(result.number);

        const success = await addTransaction(transactionData);
        if (!success) {
          console.error('Failed to add filter transaction');
          return;
        }
      }
      
      // Get the newly created transactions for undo/redo
      setTimeout(() => {
        const newTransactions = transactions.slice(beforeCount);
        const filterTransactions = newTransactions.filter(t => 
          t.entryType === selectedType && 
          t.isFilterDeduction &&
          affectedNumbers.includes(t.number)
        );
        
        addAction('filter', `Applied filter deductions to ${validResults.length} number(s)`, affectedNumbers, {
          transactions: deductionTransactions as Transaction[],
          transactionIds: filterTransactions.map(t => t.id),
        });
      }, 50);

      alert(`✓ Saved ${validResults.length} deduction entries successfully!`);
      handleReset();
    } catch (error) {
      console.error('Error saving filter results:', error);
      alert('Failed to save results. Please try again.');
    }
  };

  // Reset all
  const handleReset = () => {
    setFirstFilterValue('');
    setSecondFilterValue('');
    setFirstLimit('');
    setSecondLimit('');
    setCalculatedResults([]);
    setShowSaveButton(false);
  };

  // Copy results
  const copyFirstResults = () => {
    const data = calculatedResults
      .filter(r => r.firstResult > 0)
      .map(r => `${r.number}\t${r.firstResult}`)
      .join('\n');
    
    navigator.clipboard.writeText(data).then(() => {
      alert(`✓ Copied ${calculatedResults.filter(r => r.firstResult > 0).length} First results!`);
    });
  };

  const copySecondResults = () => {
    const data = calculatedResults
      .filter(r => r.secondResult > 0)
      .map(r => `${r.number}\t${r.secondResult}`)
      .join('\n');
    
    navigator.clipboard.writeText(data).then(() => {
      alert(`✓ Copied ${calculatedResults.filter(r => r.secondResult > 0).length} Second results!`);
    });
  };

  const tabs: TabItem[] = [
    { id: 'dashboard', label: 'Dashboard', path: `/project/${id}` },
    { id: 'akra', label: 'Akra (00)', path: `/project/${id}/akra` },
    { id: 'ring', label: 'Ring (000)', path: `/project/${id}/ring` },
    { id: 'advanced', label: 'Advanced Filter', path: `/project/${id}/advanced-filter` },
    { id: 'filter-calculate', label: 'Filter & Calculate', path: `/project/${id}/filter-calculate` },
    { id: 'history', label: 'History', path: `/project/${id}/history` },
  ];

  if (!project || projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  const firstTotal = calculatedResults.reduce((sum, r) => sum + r.firstResult, 0);
  const secondTotal = calculatedResults.reduce((sum, r) => sum + r.secondResult, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <ProjectHeader 
        projectName={project.name} 
        projectDate={project.date}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabNavigation tabs={tabs} baseClass="mb-6" />

        {/* Type Selection */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            🧮 Filter & Calculate
          </h2>
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setSelectedType('akra')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                selectedType === 'akra'
                  ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Akra (00-99)
            </button>
            <button
              onClick={() => setSelectedType('ring')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                selectedType === 'ring'
                  ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Ring (000-999)
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="card mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
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
                  className="input-field w-16 text-center text-xl font-bold"
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
                  className="input-field flex-1 text-lg"
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
                  className="input-field w-16 text-center text-xl font-bold"
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
                  className="input-field flex-1 text-lg"
                />
              </div>
            </div>
          </div>

          {/* Limit Section */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-xl border border-yellow-200 dark:border-yellow-800 mb-4">
            <h4 className="text-md font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span>⚡</span>
              Step 2: Set Limits (Result = Original - Limit)
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
                  className="input-field text-lg"
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
                  className="input-field text-lg"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleApplyFilter}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Apply Filter
            </button>

            {showSaveButton && (
              <button
                onClick={handleSaveResults}
                className="btn-secondary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Results ({calculatedResults.length})
              </button>
            )}

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
          <div className="card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
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
                <div className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Combined:</span>
                  <span className="ml-2 font-bold text-purple-700 dark:text-purple-300">{firstTotal + secondTotal}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Results */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100">💰 FIRST Results</h4>
                  <button
                    onClick={copyFirstResults}
                    className="text-sm btn-secondary py-2"
                  >
                    Copy
                  </button>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 max-h-96 overflow-y-auto space-y-2">
                  {calculatedResults.filter(r => r.firstResult > 0).map((result) => (
                    <div
                      key={`first-${result.number}`}
                      className="bg-white dark:bg-gray-700 p-3 rounded-lg flex justify-between items-center"
                    >
                      <span className="font-bold text-gray-900 dark:text-gray-100">{result.number}</span>
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
                  <h4 className="font-bold text-gray-900 dark:text-gray-100">💎 SECOND Results</h4>
                  <button
                    onClick={copySecondResults}
                    className="text-sm btn-secondary py-2"
                  >
                    Copy
                  </button>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 max-h-96 overflow-y-auto space-y-2">
                  {calculatedResults.filter(r => r.secondResult > 0).map((result) => (
                    <div
                      key={`second-${result.number}`}
                      className="bg-white dark:bg-gray-700 p-3 rounded-lg flex justify-between items-center"
                    >
                      <span className="font-bold text-gray-900 dark:text-gray-100">{result.number}</span>
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

        {/* Help */}
        <div className="card mt-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How It Works
          </h3>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <p><strong>Step 1:</strong> Set filter conditions for FIRST and/or SECOND amounts</p>
            <p><strong>Step 2:</strong> Set limit values - Result will be calculated as: <code className="bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">Original - Limit</code></p>
            <p><strong>Step 3:</strong> Click "Apply Filter" to see calculated results</p>
            <p><strong>Step 4:</strong> Click "Save Results" to save deductions as negative entries in database</p>
            <p className="mt-3 p-2 bg-blue-100 dark:bg-blue-900/40 rounded">
              <strong>Note:</strong> Only numbers where Original {'>'} Limit will show results. Results are shown as deductions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterCalculate;

