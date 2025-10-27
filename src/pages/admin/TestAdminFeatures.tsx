import React, { useState } from 'react';
import { db } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

/**
 * TEST PAGE - Temporary component to test admin features
 * Navigate to /admin/test-features to access this page
 * 
 * Tests:
 * 1. Admin Deductions
 * 2. User Delete
 * 3. Reset User History
 */

const TestAdminFeatures: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotifications();

  const [testTransactionId, setTestTransactionId] = useState('');
  const [testUserId, setTestUserId] = useState('');
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${result}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // Test 1: Check database connection
  const testDatabaseConnection = async () => {
    try {
      addResult('🔍 Testing database connection...');
      const isOnline = db.isOnline();
      addResult(`Database online: ${isOnline ? '✅ YES' : '❌ NO'}`);
      
      if (!isOnline) {
        addResult('❌ Database is not available. Check Supabase configuration.');
        showError('Error', 'Database not available');
        return;
      }
      
      addResult('✅ Database connection test passed!');
      showSuccess('Success', 'Database is connected');
    } catch (error: any) {
      addResult(`❌ Error: ${error.message}`);
      showError('Error', error.message);
    }
  };

  // Test 2: Check if admin_deductions table exists
  const testAdminDeductionsTable = async () => {
    try {
      addResult('🔍 Checking if admin_deductions table exists...');
      
      // Try to query the table
      const { supabase } = await import('../../lib/supabase');
      if (!supabase) {
        addResult('❌ Supabase client not initialized');
        return;
      }

      const { data, error } = await supabase
        .from('admin_deductions')
        .select('id')
        .limit(1);

      if (error) {
        addResult(`❌ Table check failed: ${error.message}`);
        addResult(`Error code: ${error.code}`);
        addResult(`Hint: ${error.hint || 'None'}`);
        showError('Error', 'admin_deductions table not found');
        return;
      }

      addResult('✅ admin_deductions table exists!');
      addResult(`Current deductions count: ${data?.length || 0}`);
      showSuccess('Success', 'Table exists');
    } catch (error: any) {
      addResult(`❌ Error: ${error.message}`);
      showError('Error', error.message);
    }
  };

  // Test 3: Test saving admin deduction
  const testSaveAdminDeduction = async () => {
    if (!testTransactionId) {
      showError('Error', 'Please enter a transaction ID');
      return;
    }

    try {
      addResult('🔍 Testing saveAdminDeduction...');
      addResult(`Transaction ID: ${testTransactionId}`);
      addResult(`Admin User ID: ${user?.id}`);

      await db.saveAdminDeduction(
        testTransactionId,
        user?.id || 'test-admin',
        100,
        50,
        'test_feature',
        { test: true, timestamp: new Date().toISOString() }
      );

      addResult('✅ Admin deduction saved successfully!');
      showSuccess('Success', 'Admin deduction saved');
    } catch (error: any) {
      addResult(`❌ Error: ${error.message}`);
      addResult(`Error details: ${JSON.stringify(error, null, 2)}`);
      showError('Error', error.message);
    }
  };

  // Test 4: Test user delete
  const testUserDelete = async () => {
    if (!testUserId) {
      showError('Error', 'Please enter a user ID');
      return;
    }

    try {
      addResult('🔍 Testing deleteUser (soft delete)...');
      addResult(`User ID: ${testUserId}`);

      await db.deleteUser(testUserId, false);

      addResult('✅ User soft delete successful!');
      showSuccess('Success', 'User deleted');
    } catch (error: any) {
      addResult(`❌ Error: ${error.message}`);
      addResult(`Error details: ${JSON.stringify(error, null, 2)}`);
      showError('Error', error.message);
    }
  };

  // Test 5: Test reset user history
  const testResetUserHistory = async () => {
    if (!testUserId) {
      showError('Error', 'Please enter a user ID');
      return;
    }

    try {
      addResult('🔍 Testing resetUserHistory...');
      addResult(`User ID: ${testUserId}`);

      const result = await db.resetUserHistory(testUserId);

      addResult(`✅ Reset successful! Deleted ${result.deletedCount} transactions`);
      showSuccess('Success', `Deleted ${result.deletedCount} transactions`);
    } catch (error: any) {
      addResult(`❌ Error: ${error.message}`);
      addResult(`Error details: ${JSON.stringify(error, null, 2)}`);
      showError('Error', error.message);
    }
  };

  // Test 6: Get all users
  const testGetAllUsers = async () => {
    try {
      addResult('🔍 Fetching all users...');
      const users = await db.getAllUsersWithStats();
      addResult(`✅ Found ${users.length} users`);
      users.slice(0, 3).forEach(u => {
        addResult(`  - ${u.username} (${u.full_name}): ${u.entryCount} entries, Balance: ${u.balance}`);
      });
      showSuccess('Success', `Found ${users.length} users`);
    } catch (error: any) {
      addResult(`❌ Error: ${error.message}`);
      showError('Error', error.message);
    }
  };

  // Test 7: Get sample transaction
  const testGetTransactions = async () => {
    try {
      addResult('🔍 Fetching sample transactions...');
      const entries = await db.getAllEntriesByType('akra', false);
      addResult(`✅ Found ${entries.length} transactions`);
      if (entries.length > 0) {
        const sample = entries[0];
        addResult(`  Sample ID: ${sample.id}`);
        addResult(`  Number: ${sample.number}`);
        addResult(`  First: ${sample.first_amount}, Second: ${sample.second_amount}`);
        addResult(`  User ID: ${sample.user_id}`);
        setTestTransactionId(sample.id);
        setTestUserId(sample.user_id);
        addResult('ℹ️ Auto-filled transaction ID and user ID with sample data');
      }
      showSuccess('Success', `Found ${entries.length} transactions`);
    } catch (error: any) {
      addResult(`❌ Error: ${error.message}`);
      showError('Error', error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🧪 Test Admin Features
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test page to diagnose admin deduction and user delete issues
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Test Controls */}
          <div className="space-y-6">
            {/* Basic Tests */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Basic Tests
              </h2>
              <div className="space-y-3">
                <button
                  onClick={testDatabaseConnection}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition"
                >
                  1. Test Database Connection
                </button>
                <button
                  onClick={testAdminDeductionsTable}
                  className="w-full px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold transition"
                >
                  2. Check admin_deductions Table
                </button>
                <button
                  onClick={testGetAllUsers}
                  className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition"
                >
                  3. Get All Users
                </button>
                <button
                  onClick={testGetTransactions}
                  className="w-full px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold transition"
                >
                  4. Get Sample Transactions
                </button>
              </div>
            </div>

            {/* Feature Tests */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Feature Tests
              </h2>
              
              {/* Transaction ID Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Transaction ID
                </label>
                <input
                  type="text"
                  value={testTransactionId}
                  onChange={(e) => setTestTransactionId(e.target.value)}
                  placeholder="Enter transaction ID or click 'Get Sample Transactions'"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* User ID Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder="Enter user ID or click 'Get Sample Transactions'"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-3">
                <button
                  onClick={testSaveAdminDeduction}
                  disabled={!testTransactionId}
                  className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
                >
                  5. Test Save Admin Deduction
                </button>
                <button
                  onClick={testUserDelete}
                  disabled={!testUserId}
                  className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
                >
                  6. Test User Delete (Soft)
                </button>
                <button
                  onClick={testResetUserHistory}
                  disabled={!testUserId}
                  className="w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
                >
                  7. Test Reset User History
                </button>
              </div>
            </div>

            {/* Current User Info */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Current User
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">ID:</span>
                  <span className="font-mono text-gray-900 dark:text-white">{user?.id || 'Not logged in'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Username:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{user?.username || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Role:</span>
                  <span className={`font-semibold ${user?.role === 'admin' ? 'text-green-600' : 'text-blue-600'}`}>
                    {user?.role === 'admin' ? '✅ ADMIN' : user?.role?.toUpperCase() || 'USER'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Test Results */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Test Results
              </h2>
              <button
                onClick={clearResults}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Clear
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 h-[600px] overflow-y-auto font-mono text-sm">
              {testResults.length === 0 ? (
                <p className="text-gray-500">No test results yet. Run a test to see output.</p>
              ) : (
                testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`mb-1 ${
                      result.includes('✅') ? 'text-green-400' :
                      result.includes('❌') ? 'text-red-400' :
                      result.includes('ℹ️') ? 'text-blue-400' :
                      result.includes('🔍') ? 'text-yellow-400' :
                      'text-gray-300'
                    }`}
                  >
                    {result}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestAdminFeatures;

