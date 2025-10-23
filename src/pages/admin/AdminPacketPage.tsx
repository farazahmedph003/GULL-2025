import React, { useState, useEffect } from 'react';
import { db } from '../../services/database';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EditTransactionModal from '../../components/EditTransactionModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';

interface Entry {
  id: string;
  number: string;
  first_amount: number;
  second_amount: number;
  created_at: string;
  user_id: string;
  app_users: {
    username: string;
    full_name: string;
  };
}

const AdminPacketPage: React.FC = () => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState({
    totalEntries: 0,
    firstPkr: 0,
    secondPkr: 0,
    totalPkr: 0,
    uniqueNumbers: 0,
  });

  const { showSuccess, showError } = useNotifications();

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await db.getAllEntriesByType('packet');
      setEntries(data);

      // Calculate stats
      const firstPkr = data.reduce((sum, e) => sum + (e.first_amount || 0), 0);
      const secondPkr = data.reduce((sum, e) => sum + (e.second_amount || 0), 0);
      const uniqueNumbers = new Set(data.map(e => e.number)).size;

      setStats({
        totalEntries: data.length,
        firstPkr,
        secondPkr,
        totalPkr: firstPkr + secondPkr,
        uniqueNumbers,
      });
    } catch (error) {
      console.error('Error loading entries:', error);
      showError('Error', 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleDelete = async () => {
    if (!deletingEntry) return;

    try {
      setIsDeleting(true);

      // Refund the balance to the user
      const refundAmount = deletingEntry.first_amount + deletingEntry.second_amount;
      const { data: userData } = await db.getUserBalance(deletingEntry.user_id);
      const newBalance = userData.balance + refundAmount;
      await db.updateUserBalance(deletingEntry.user_id, newBalance);

      // Delete the transaction
      await db.deleteTransaction(deletingEntry.id);
      await showSuccess('Success', 'Entry deleted successfully and balance refunded');
      
      setDeletingEntry(null);
      loadEntries();
    } catch (error) {
      console.error('Delete error:', error);
      showError('Error', 'Failed to delete entry');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = async (updatedTransaction: any) => {
    if (!editingEntry) return;

    try {
      // Calculate balance difference
      const oldTotal = editingEntry.first_amount + editingEntry.second_amount;
      const newTotal = updatedTransaction.first + updatedTransaction.second;
      const difference = newTotal - oldTotal;

      // Get current user balance
      const { data: userData } = await db.getUserBalance(editingEntry.user_id);
      const newBalance = userData.balance - difference;

      // Update user balance
      await db.updateUserBalance(editingEntry.user_id, newBalance);

      // Update transaction
      await db.updateTransaction(editingEntry.id, {
        first: updatedTransaction.first,
        second: updatedTransaction.second,
        notes: updatedTransaction.notes,
      });

      await showSuccess('Success', 'Entry updated successfully');
      setEditingEntry(null);
      loadEntries();
    } catch (error) {
      console.error('Edit error:', error);
      showError('Error', 'Failed to update entry');
    }
  };

  const getUserColor = (userId: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    ];
    const index = parseInt(userId.slice(-1), 16) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading packet entries..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📦 Packet Entries (All Users)
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage all packet entries across all users
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Entries</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEntries}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">First PKR</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.firstPkr.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Second PKR</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.secondPkr.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total PKR</p>
            <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
              {stats.totalPkr.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Unique Numbers</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.uniqueNumbers}
            </p>
          </div>
        </div>

        {/* Entries Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Number
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    First
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Second
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getUserColor(entry.user_id)}`}>
                          {entry.app_users.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {entry.number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {entry.first_amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        {entry.second_amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                        {(entry.first_amount + entry.second_amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditingEntry(entry)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingEntry(entry)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {entries.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No packet entries found
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingEntry && (
        <EditTransactionModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          transaction={{
            id: editingEntry.id,
            number: editingEntry.number,
            first: editingEntry.first_amount,
            second: editingEntry.second_amount,
            notes: '',
            entryType: 'packet' as any,
            projectId: 'admin',
            createdAt: editingEntry.created_at,
            updatedAt: editingEntry.created_at,
          }}
          onSave={handleEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingEntry && (
        <DeleteConfirmationModal
          isOpen={!!deletingEntry}
          onClose={() => setDeletingEntry(null)}
          onConfirm={handleDelete}
          title="Delete Packet Entry"
          message="Are you sure you want to delete this packet entry?"
          itemName={`Number: ${deletingEntry.number} (${deletingEntry.app_users.username})`}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
};

export default AdminPacketPage;



