import React, { useState } from 'react';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  currentBalance: number;
  onSubmit: (amount: number, isWithdraw?: boolean) => Promise<void>;
}

const TopUpModal: React.FC<TopUpModalProps> = ({ isOpen, onClose, userName, currentBalance, onSubmit }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdraw'>('deposit');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Validate withdrawal doesn't exceed balance
    if (transactionType === 'withdraw' && amountNum > currentBalance) {
      setError('Withdrawal amount cannot exceed current balance');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(amountNum, transactionType === 'withdraw');
      setAmount('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${transactionType} balance`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Load Balance
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 mb-2">User: <strong>{userName}</strong></p>
          <p className="text-gray-700 dark:text-gray-300">
            Current Balance: <strong className="text-green-600 dark:text-green-400">PKR {currentBalance.toLocaleString()}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Transaction Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="transactionType"
                  value="deposit"
                  checked={transactionType === 'deposit'}
                  onChange={(e) => setTransactionType(e.target.value as 'deposit')}
                  className="w-4 h-4 text-green-600 focus:ring-green-500"
                  disabled={loading}
                />
                <span className="ml-2 text-gray-700 dark:text-gray-300">💰 Deposit</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="transactionType"
                  value="withdraw"
                  checked={transactionType === 'withdraw'}
                  onChange={(e) => setTransactionType(e.target.value as 'withdraw')}
                  className="w-4 h-4 text-red-600 focus:ring-red-500"
                  disabled={loading}
                />
                <span className="ml-2 text-gray-700 dark:text-gray-300">💸 Withdraw</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ${
                transactionType === 'deposit'
                  ? 'border-gray-300 dark:border-gray-600 focus:ring-green-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-red-500'
              }`}
              placeholder="Enter amount"
              required
              disabled={loading}
              min="1"
              step="1"
            />
            {amount && parseFloat(amount) > 0 && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                New Balance: <strong className={transactionType === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                  PKR {(
                    transactionType === 'deposit'
                      ? currentBalance + parseFloat(amount)
                      : currentBalance - parseFloat(amount)
                  ).toLocaleString()}
                </strong>
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-6 py-3 bg-gradient-to-r text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                transactionType === 'deposit'
                  ? 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                  : 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
              }`}
              disabled={loading}
            >
              {transactionType === 'deposit' ? '💰 Deposit' : '💸 Withdraw'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TopUpModal;



