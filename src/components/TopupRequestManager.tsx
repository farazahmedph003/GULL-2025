import React, { useState } from 'react';
import { useTopupRequests } from '../hooks/useTopupRequests';
import { formatCurrency, formatDate } from '../utils/helpers';
import { playMoneyDepositSound } from '../utils/audioFeedback';

interface TopupRequestManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const TopupRequestManager: React.FC<TopupRequestManagerProps> = ({ isOpen, onClose }) => {
  const { getAllRequests, updateRequestStatus, getPendingCount } = useTopupRequests();
  const [adminNotes, setAdminNotes] = useState('');
  const [topupAmount, setTopupAmount] = useState<number>(1000);

  const requests = getAllRequests();
  const pendingCount = getPendingCount();

  // Use the same effective user ID logic as useUserBalance
  const getEffectiveUserId = (userId: string) => {
    // If it's the offline user, use the same key as useUserBalance
    if (userId === 'offline-user' || !userId) {
      let id = localStorage.getItem('gull_offline_user_id');
      if (!id) {
        id = 'offline-user';
        localStorage.setItem('gull_offline_user_id', id);
      }
      return id;
    }
    return userId;
  };

  const addBalanceToUser = (userId: string, amount: number) => {
    try {
      // Get current balances from localStorage
      const localBalances = JSON.parse(localStorage.getItem('gull_user_balances') || '{}');
      
      // Use effective user ID for consistency
      const effectiveUserId = getEffectiveUserId(userId);
      
      // Add amount to the specific user's balance
      localBalances[effectiveUserId] = (localBalances[effectiveUserId] || 0) + amount;
      
      // Save back to localStorage
      localStorage.setItem('gull_user_balances', JSON.stringify(localBalances));
      
      // Dispatch event to notify balance change
      window.dispatchEvent(new CustomEvent('user-balance-updated', { 
        detail: { balance: localBalances[effectiveUserId], userId: effectiveUserId } 
      }));
      
      return true;
    } catch (error) {
      console.error('Error adding balance:', error);
      return false;
    }
  };

  const handleApprove = async (requestId: string, userId: string) => {
    try {
      // Add balance to user's account
      const success = addBalanceToUser(userId, topupAmount);
      
      if (success) {
        // Update request status
        updateRequestStatus(requestId, 'approved', adminNotes || `Approved with ${formatCurrency(topupAmount)} top-up`);
        
        // Play deposit sound for successful top-up approval
        playMoneyDepositSound(topupAmount);
        
        setAdminNotes('');
        setTopupAmount(1000);
        
        alert(`Successfully added ${formatCurrency(topupAmount)} to user's balance!`);
      } else {
        alert('Failed to add balance. Please try again.');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Error approving request. Please try again.');
    }
  };

  const handleReject = (requestId: string) => {
    updateRequestStatus(requestId, 'rejected', adminNotes || 'Request rejected');
    setAdminNotes('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Top-up Requests</h2>
              <p className="text-blue-100 text-sm mt-1">
                {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">No top-up requests found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className={`border rounded-lg p-4 transition-all ${
                    request.status === 'pending'
                      ? 'border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
                      : request.status === 'approved'
                      ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                      : 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        request.status === 'pending' ? 'bg-yellow-500' :
                        request.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {request.userEmail}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(request.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Current: {formatCurrency(request.currentBalance)}
                      </div>
                      {request.requestedAmount && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Requested: {formatCurrency(request.requestedAmount)}
                        </div>
                      )}
                    </div>
                  </div>

                  {request.message && (
                    <div className="mb-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>Message:</strong> {request.message}
                      </p>
                    </div>
                  )}

                  {request.adminNotes && (
                    <div className="mb-3 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Admin Notes:</strong> {request.adminNotes}
                      </p>
                    </div>
                  )}

                  {request.status === 'pending' && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          Top-up Amount
                        </label>
                        <input
                          type="number"
                          value={topupAmount}
                          onChange={(e) => setTopupAmount(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          min="1"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          Admin Notes
                        </label>
                        <input
                          type="text"
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Optional notes..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(request.id, request.userId)}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      request.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                      request.status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                      'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                    }`}>
                      {request.status.toUpperCase()}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Updated: {formatDate(request.updatedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopupRequestManager;
