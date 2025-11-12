import React, { useEffect, useMemo, useState } from 'react';
import type { EntryType } from '../../types';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { useNotifications } from '../../contexts/NotificationContext';

const ENTRY_TYPES: EntryType[] = ['open', 'akra', 'ring', 'packet'];
const ENTRY_LABELS: Record<EntryType, { title: string; description: string }> = {
  open: { title: 'Open (0-9)', description: 'Single digit numbers' },
  akra: { title: 'Akra (00-99)', description: 'Two digit numbers' },
  ring: { title: 'Ring (000-999)', description: 'Three digit numbers' },
  packet: { title: 'Packet (0000-9999)', description: 'Four digit numbers' },
};

const formatLimit = (value: number | null): string => {
  if (value === null || value === undefined) return '';
  return Number.isFinite(value) ? value.toString() : '';
};

const parseInput = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

const AdminAmountLimitsPage: React.FC = () => {
  const { amountLimits, updateAmountLimits, loading } = useSystemSettings();
  const { showSuccess, showError, showInfo } = useNotifications();
  const [selectedType, setSelectedType] = useState<EntryType>('open');
  const [firstInput, setFirstInput] = useState<string>('');
  const [secondInput, setSecondInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const currentLimits = useMemo(() => amountLimits[selectedType], [amountLimits, selectedType]);

  useEffect(() => {
    setFirstInput(formatLimit(currentLimits.first ?? null));
    setSecondInput(formatLimit(currentLimits.second ?? null));
  }, [currentLimits]);

  const handleSave = async () => {
    const firstLimit = parseInput(firstInput);
    const secondLimit = parseInput(secondInput);

    if (firstInput.trim() && firstLimit === null) {
      showError('Invalid Amount', 'First amount limit must be a positive number or blank.');
      return;
    }
    if (secondInput.trim() && secondLimit === null) {
      showError('Invalid Amount', 'Second amount limit must be a positive number or blank.');
      return;
    }

    setIsSaving(true);
    try {
      await updateAmountLimits(selectedType, {
        first: firstLimit,
        second: secondLimit,
      });
      showSuccess(
        'Limits Updated',
        `Amount limits for ${selectedType.toUpperCase()} saved successfully.`,
        { duration: 2000 },
      );
    } catch (err) {
      console.error('Failed to save amount limits:', err);
      showError('Save Failed', 'Could not update amount limits. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!firstInput && !secondInput && currentLimits.first === null && currentLimits.second === null) {
      showInfo('Nothing to reset', 'Limits are already cleared for this entry type.');
      return;
    }

    setIsSaving(true);
    try {
      await updateAmountLimits(selectedType, { first: null, second: null });
      showSuccess(
        'Limits Cleared',
        `Amount limits for ${selectedType.toUpperCase()} reset to unlimited.`,
        { duration: 2000 },
      );
      setFirstInput('');
      setSecondInput('');
    } catch (err) {
      console.error('Failed to reset amount limits:', err);
      showError('Reset Failed', 'Could not reset amount limits. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">📏 Amount Limits</h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-3xl">
            Configure maximum allowed First (F) and Second (S) amounts for each entry type. When a user tries to submit
            an amount above the configured limit for a specific number, their submission will be blocked with an error.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Select Entry Type</h2>
          <div className="flex flex-wrap gap-3">
            {ENTRY_TYPES.map((type) => (
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
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {ENTRY_LABELS[selectedType].title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {ENTRY_LABELS[selectedType].description}. Leave a field blank to allow unlimited entries for that amount.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-inner">
              <h4 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300 mb-2">First Amount Limit</h4>
              <p className="text-sm text-emerald-600 dark:text-emerald-200 mb-4">
                Maximum total F amount allowed per number for this entry type.
              </p>
              <input
                type="number"
                min={0}
                placeholder="Unlimited"
                value={firstInput}
                onChange={(e) => setFirstInput(e.target.value)}
                className="w-full px-4 py-3 border border-emerald-200 dark:border-emerald-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-inner">
              <h4 className="text-lg font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Second Amount Limit</h4>
              <p className="text-sm text-indigo-600 dark:text-indigo-200 mb-4">
                Maximum total S amount allowed per number for this entry type.
              </p>
              <input
                type="number"
                min={0}
                placeholder="Unlimited"
                value={secondInput}
                onChange={(e) => setSecondInput(e.target.value)}
                className="w-full px-4 py-3 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-xl p-5 text-sm text-yellow-800 dark:text-yellow-100">
            <p className="font-semibold mb-2">How enforcement works:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Limits apply per number. For example, setting F = 100 on Akra means each Akra number cannot exceed 100.</li>
              <li>Users will see a validation error if they try to submit an amount above the configured limit.</li>
              <li>Leave a field blank to allow unlimited entries for that amount type.</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving || loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Limits'}
            </button>
            <button
              onClick={handleReset}
              disabled={isSaving || loading}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Reset to Unlimited
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAmountLimitsPage;


