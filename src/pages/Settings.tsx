import React, { useState, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { usePushNotifications } from '../contexts/PushNotificationContext';
import { useAppearance } from '../contexts/AppearanceContext';
import { isOfflineMode } from '../lib/supabase';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';
import SoundSettings from '../components/SoundSettings';
import SettingsSection from '../components/SettingsSection';
import SettingItem from '../components/SettingItem';
import FontSizeSelector from '../components/FontSizeSelector';
import AnimationToggle from '../components/AnimationToggle';
import LoadingSpinner from '../components/LoadingSpinner';
import KeyboardShortcuts, { useKeyboardShortcuts } from '../components/KeyboardShortcuts';
import {
  exportAllProjects,
  exportToExcel,
  importFromFile,
  clearAppCache,
  createBackup,
  restoreFromBackup,
  deleteAllUserData
} from '../utils/dataManagement';

const Settings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { fontSize, setFontSize, animationsEnabled, setAnimationsEnabled } = useAppearance();
  const { state: notificationState, enableNotifications, disableNotifications, requestPermission } = usePushNotifications();
  const { isOpen: shortcutsOpen, open: openShortcuts, close: closeShortcuts } = useKeyboardShortcuts();
  
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const handleNotificationToggle = async () => {
    if (notificationLoading) return;
    
    setNotificationLoading(true);
    try {
      if (notificationState.enabled) {
        await disableNotifications();
      } else {
        const success = await enableNotifications();
        if (!success && notificationState.permission === 'default') {
          console.log('Notification permission was denied');
        }
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleExportProjects = async () => {
    setIsExporting(true);
    try {
      await exportAllProjects();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await exportToExcel();
    } catch (error) {
      console.error('Excel export failed:', error);
      alert('Excel export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await importFromFile(file);
      alert('Projects imported successfully! Please refresh the page.');
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the file format.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearCache = async () => {
    if (!confirm('This will clear app cache and settings. Continue?')) return;
    
    setIsClearing(true);
    try {
      clearAppCache();
      alert('Cache cleared successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Cache clear failed:', error);
      alert('Failed to clear cache.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      await createBackup();
      alert('Backup created and downloaded successfully!');
    } catch (error) {
      console.error('Backup failed:', error);
      alert('Backup failed. Please try again.');
    }
  };

  const handleRestoreBackup = () => {
    backupInputRef.current?.click();
  };

  const handleBackupSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await restoreFromBackup(file);
      alert('Backup restored successfully! Please refresh the page.');
      window.location.reload();
    } catch (error) {
      console.error('Restore failed:', error);
      alert(`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (backupInputRef.current) {
        backupInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAllData = async () => {
    try {
      await deleteAllUserData();
      alert('All data deleted successfully! You will be redirected to welcome page.');
      window.location.href = '/welcome';
    } catch (error) {
      console.error('Delete failed:', error);
      alert(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BackButton />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Settings
              </h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Appearance Settings */}
            <SettingsSection
              title="Appearance"
              description="Customize the look and feel of the application"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                </svg>
              }
            >
              <SettingItem
                label="Theme"
                description="Switch between light and dark mode"
              >
                <button
                  onClick={toggleTheme}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {theme === 'dark' ? '🌙' : '☀️'}
                  </span>
                  <span className="text-sm capitalize">{theme}</span>
                </button>
              </SettingItem>

              <SettingItem
                label="Font Size"
                description="Adjust the text size throughout the application"
              >
                <FontSizeSelector
                  value={fontSize}
                  onChange={setFontSize}
                />
              </SettingItem>

              <SettingItem
                label="Animations"
                description="Enable or disable animations and transitions"
              >
                <div className="flex items-center space-x-3">
                  <AnimationToggle
                    enabled={animationsEnabled}
                    onChange={setAnimationsEnabled}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {animationsEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </SettingItem>
            </SettingsSection>

            {/* Sound Settings */}
            <SettingsSection
              title="Sound & Audio"
              description="Configure audio feedback and sound preferences"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              }
            >
              <SoundSettings />
            </SettingsSection>

            {/* Notification Settings */}
            <SettingsSection
              title="Notifications"
              description="Manage browser notifications and alerts"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 7H4l5-5v5zM12 9a3 3 0 100-6 3 3 0 000 6zM12 15a3 3 0 100 6 3 3 0 000-6z" />
                </svg>
              }
            >
              <SettingItem
                label="Browser Notifications"
                description="Enable notifications for balance changes, transactions, and updates"
              >
                <div className="flex items-center space-x-3">
                  {!notificationState.supported ? (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Not supported
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={handleNotificationToggle}
                        disabled={notificationLoading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          notificationState.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notificationState.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      {notificationState.permission === 'denied' && (
                        <button
                          onClick={requestPermission}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          disabled={notificationLoading}
                        >
                          {notificationLoading ? <LoadingSpinner size="sm" /> : 'Request Permission'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </SettingItem>
            </SettingsSection>

            {/* Data Management */}
            <SettingsSection
              title="Data Management"
              description="Export, import, and manage your data"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              }
            >
              <SettingItem
                label="Export Projects"
                description="Download all your projects as JSON or Excel files"
              >
                <div className="flex space-x-2">
                  <button
                    onClick={handleExportProjects}
                    disabled={isExporting}
                    className="btn-primary text-sm"
                  >
                    {isExporting ? <LoadingSpinner size="sm" /> : 'Export JSON'}
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={isExporting}
                    className="btn-secondary text-sm"
                  >
                    Export Excel
                  </button>
                </div>
              </SettingItem>

              <SettingItem
                label="Import Projects"
                description="Restore projects from a previously exported file"
              >
                <button
                  onClick={handleImportFile}
                  disabled={isImporting}
                  className="btn-secondary text-sm"
                >
                  {isImporting ? <LoadingSpinner size="sm" /> : 'Import File'}
                </button>
              </SettingItem>

              <SettingItem
                label="Backup & Restore"
                description="Create full backups or restore from a backup file"
              >
                <div className="flex space-x-2">
                  <button
                    onClick={handleCreateBackup}
                    className="btn-primary text-sm"
                  >
                    Create Backup
                  </button>
                  <button
                    onClick={handleRestoreBackup}
                    className="btn-secondary text-sm"
                  >
                    Restore Backup
                  </button>
                </div>
              </SettingItem>

              <SettingItem
                label="Clear Cache"
                description="Clear application cache and temporary data"
              >
                <button
                  onClick={handleClearCache}
                  disabled={isClearing}
                  className="btn-secondary text-sm"
                >
                  {isClearing ? <LoadingSpinner size="sm" /> : 'Clear Cache'}
                </button>
              </SettingItem>
            </SettingsSection>

            {/* Performance Settings */}
            <SettingsSection
              title="Performance & System"
              description="System information and performance options"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            >
              <SettingItem
                label="Connection Status"
                description="Current application mode"
              >
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isOfflineMode() 
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                }`}>
                  {isOfflineMode() ? '🔒 Offline Mode' : '🌐 Online Mode'}
                </span>
              </SettingItem>

              <SettingItem
                label="Keyboard Shortcuts"
                description="View all available keyboard shortcuts"
              >
                <button
                  onClick={openShortcuts}
                  className="btn-secondary text-sm"
                >
                  View Shortcuts
                </button>
              </SettingItem>
            </SettingsSection>

            {/* Danger Zone */}
            <SettingsSection
              title="Danger Zone"
              description="Irreversible actions that affect your data"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              }
              className="border-2 border-red-200 dark:border-red-800"
            >
              <SettingItem
                label="Delete All Data"
                description="⚠️ Permanently delete all your projects and data. This action cannot be undone."
              >
                <button
                  onClick={handleDeleteAllData}
                  className="btn-danger text-sm"
                >
                  Delete All Data
                </button>
              </SettingItem>
            </SettingsSection>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => window.open('/welcome', '_blank')}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    View Welcome Page
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Learn about the app
                  </div>
                </button>
              </div>
            </div>

            {/* System Info */}
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                System Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">App Version</span>
                  <span className="text-gray-900 dark:text-gray-100">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Browser</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {navigator.userAgent.split(' ')[0]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Platform</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {navigator.platform}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelected}
        className="hidden"
      />
      <input
        ref={backupInputRef}
        type="file"
        accept=".json,.backup.json"
        onChange={handleBackupSelected}
        className="hidden"
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcuts isOpen={shortcutsOpen} onClose={closeShortcuts} />
    </div>
  );
};

export default Settings;
