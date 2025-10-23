import React from 'react';
import { useUserBalance } from '../hooks/useUserBalance';
import { formatCurrency } from '../utils/helpers';

const BalanceDisplay: React.FC = () => {
  const { balance, loading, error, spent } = useUserBalance() as any;

  // Debug logging
  console.log('BalanceDisplay render:', { balance, loading, error });

  // Balance updates are now handled globally by useUserBalance hook

  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-4 py-2 bg-background-lightSecondary dark:bg-secondary-light rounded-2xl animate-pulse">
        <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        <div className="w-20 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-medium">Error</span>
      </div>
    );
  }

  const balanceColor = balance <= 0
    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    : balance < 1000
    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';

  return (
    <div className="flex items-center space-x-2">
      <div className={`flex items-center space-x-2 px-4 py-2 rounded-2xl ${balanceColor} transition-all hover:shadow-md`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <div className="text-left">
          <div className="text-xs font-semibold opacity-75">Balance</div>
          <div className="text-sm font-bold leading-tight">{formatCurrency(balance)}</div>
        </div>
      </div>
      {typeof spent === 'number' && (
        <div className="flex items-center space-x-2 px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-left">
            <div className="text-xs font-semibold opacity-75">Spent</div>
            <div className="text-sm font-bold leading-tight">{formatCurrency(spent)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BalanceDisplay;





