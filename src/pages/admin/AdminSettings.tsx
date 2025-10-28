import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../hooks/useAdmin';
import { isAdminEmail } from '../../config/admin';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import SettingsSection from '../../components/SettingsSection';
import SettingItem from '../../components/SettingItem';
import AnimationToggle from '../../components/AnimationToggle';
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from '../../config/admin';

const AdminSettings: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin, loading: authLoading } = useAdmin();
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load settings from localStorage - MUST be called before any conditional returns
  useEffect(() => {
    if (!isAdmin || !user) return; // Only load if we have admin access
    
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('admin-system-settings');
        if (saved) {
          setSystemSettings(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load admin settings:', error);
      }
    };
    loadSettings();
  }, [isAdmin, user]);

  // Check admin permissions AFTER all hooks
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAdmin || !user || !isAdminEmail(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to access admin settings.
          </p>
        </div>
      </div>
    );
  }

  const saveSettings = async () => {
    setLoading(true);
    setSaveStatus('saving');
    
    try {
      // Save to localStorage (in a real app, this would be saved to a database)
      localStorage.setItem('admin-system-settings', JSON.stringify(systemSettings));
      
      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 300)); // Reduced for instant feel
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000); // Reduced duration
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000); // Reduced duration
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(
    key: K, 
    value: SystemSettings[K]
  ) => {
    setSystemSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateFeatureFlag = (flag: keyof typeof systemSettings.featureFlags, value: boolean) => {
    setSystemSettings(prev => ({
      ...prev,
      featureFlags: {
        ...prev.featureFlags,
        [flag]: value
      }
    }));
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure system-wide settings and manage application features
          </p>
        </div>
        <button
          onClick={saveSettings}
          disabled={loading}
          className={`btn-primary flex items-center space-x-2 ${
            saveStatus === 'saved' ? 'bg-green-600 hover:bg-green-700' : 
            saveStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : ''
          }`}
        >
          {loading ? (
            <LoadingSpinner size="sm" />
          ) : saveStatus === 'saved' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
          <span>
            {saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save Settings'}
          </span>
        </button>
      </div>

      {/* System Configuration */}
      <SettingsSection
        title="System Configuration"
        description="Configure entry costs and financial settings"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      >

        <SettingItem
          label="Default User Balance"
          description="Initial balance for new users in PKR"
        >
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={systemSettings.defaultBalance}
              onChange={(e) => updateSetting('defaultBalance', parseInt(e.target.value) || 0)}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              min="0"
              step="100"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">PKR</span>
          </div>
        </SettingItem>

        <SettingItem
          label="Minimum Top-up Amount"
          description="Minimum amount users can top up in PKR"
        >
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={systemSettings.minTopupAmount}
              onChange={(e) => updateSetting('minTopupAmount', parseInt(e.target.value) || 0)}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              min="0"
              step="100"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">PKR</span>
          </div>
        </SettingItem>

        <SettingItem
          label="Maximum Top-up Amount"
          description="Maximum amount users can top up in PKR"
        >
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={systemSettings.maxTopupAmount}
              onChange={(e) => updateSetting('maxTopupAmount', parseInt(e.target.value) || 0)}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              min="0"
              step="1000"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">PKR</span>
          </div>
        </SettingItem>
      </SettingsSection>

      {/* User Management Settings */}
      <SettingsSection
        title="User Management"
        description="Configure user registration and account settings"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        }
      >
        <SettingItem
          label="Auto-approve Top-ups"
          description="Automatically approve all top-up requests"
        >
          <div className="flex items-center space-x-3">
            <AnimationToggle
              enabled={systemSettings.autoApproveTopups}
              onChange={(enabled) => updateSetting('autoApproveTopups', enabled)}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {systemSettings.autoApproveTopups ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </SettingItem>
      </SettingsSection>

      {/* Feature Flags */}
      <SettingsSection
        title="Feature Flags"
        description="Enable or disable application features globally"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      >
        <SettingItem
          label="User Registration"
          description="Allow new users to register accounts"
        >
          <div className="flex items-center space-x-3">
            <AnimationToggle
              enabled={systemSettings.featureFlags.enableRegistration}
              onChange={(enabled) => updateFeatureFlag('enableRegistration', enabled)}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {systemSettings.featureFlags.enableRegistration ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </SettingItem>

        <SettingItem
          label="Email Verification"
          description="Require email verification for new accounts"
        >
          <div className="flex items-center space-x-3">
            <AnimationToggle
              enabled={systemSettings.featureFlags.enableEmailVerification}
              onChange={(enabled) => updateFeatureFlag('enableEmailVerification', enabled)}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {systemSettings.featureFlags.enableEmailVerification ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </SettingItem>

        <SettingItem
          label="Advanced Reports"
          description="Enable advanced reporting features"
        >
          <div className="flex items-center space-x-3">
            <AnimationToggle
              enabled={systemSettings.featureFlags.enableAdvancedReports}
              onChange={(enabled) => updateFeatureFlag('enableAdvancedReports', enabled)}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {systemSettings.featureFlags.enableAdvancedReports ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </SettingItem>

        <SettingItem
          label="Bulk Operations"
          description="Enable bulk data operations and imports"
        >
          <div className="flex items-center space-x-3">
            <AnimationToggle
              enabled={systemSettings.featureFlags.enableBulkOperations}
              onChange={(enabled) => updateFeatureFlag('enableBulkOperations', enabled)}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {systemSettings.featureFlags.enableBulkOperations ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </SettingItem>

        <SettingItem
          label="Data Export"
          description="Allow users to export their data"
        >
          <div className="flex items-center space-x-3">
            <AnimationToggle
              enabled={systemSettings.featureFlags.enableDataExport}
              onChange={(enabled) => updateFeatureFlag('enableDataExport', enabled)}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {systemSettings.featureFlags.enableDataExport ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </SettingItem>

        <SettingItem
          label="Debug Mode"
          description="Enable debug features and logging"
        >
          <div className="flex items-center space-x-3">
            <AnimationToggle
              enabled={systemSettings.featureFlags.enableDebugMode}
              onChange={(enabled) => updateFeatureFlag('enableDebugMode', enabled)}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {systemSettings.featureFlags.enableDebugMode ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </SettingItem>
      </SettingsSection>

      {/* System Control */}
      <SettingsSection
        title="System Control"
        description="Manage system-wide operational settings"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      >
        <SettingItem
          label="Maintenance Mode"
          description="Put the application in maintenance mode (restricts user access)"
        >
          <div className="flex items-center space-x-3">
            <AnimationToggle
              enabled={systemSettings.maintenanceMode}
              onChange={(enabled) => updateSetting('maintenanceMode', enabled)}
            />
            <span className={`text-sm ${
              systemSettings.maintenanceMode 
                ? 'text-yellow-600 dark:text-yellow-400 font-medium' 
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {systemSettings.maintenanceMode ? 'Maintenance Active' : 'Normal Operation'}
            </span>
          </div>
        </SettingItem>

        {systemSettings.maintenanceMode && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Maintenance mode is active. Users may experience limited functionality.
              </p>
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  );
};

export default AdminSettings;
