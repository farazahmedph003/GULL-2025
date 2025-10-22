import React, { useMemo, useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { useNotifications } from '../contexts/NotificationContext';

interface FreshEntryPanelProps {
  projectId: string;
  entryType: 'akra' | 'ring' | 'open' | 'packet';
  onSuccess?: () => void;
}

const FreshEntryPanel: React.FC<FreshEntryPanelProps> = ({ projectId, entryType, onSuccess }) => {
  const { addTransaction } = useTransactions(projectId);
  const { showError, showSuccess } = useNotifications();

  const [numbers, setNumbers] = useState('');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numbersList = useMemo(() => {
    return numbers
      .split(/[^0-9]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
  }, [numbers]);

  const validateNumber = (n: string): boolean => {
    if (entryType === 'open') return /^\d$/.test(n);
    if (entryType === 'akra') return /^\d{1,2}$/.test(n);
    if (entryType === 'ring') return /^\d{1,3}$/.test(n);
    if (entryType === 'packet') return /^\d{1,4}$/.test(n);
    return false;
  };

  const canSubmit = useMemo(() => {
    if (numbersList.length === 0) return false;
    if (!first && !second) return false;
    if (first && isNaN(Number(first))) return false;
    if (second && isNaN(Number(second))) return false;
    return numbersList.every(validateNumber);
  }, [numbersList, first, second]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const payloads = numbersList.map(num => ({
        projectId,
        number: num.padStart(entryType === 'open' ? 1 : entryType === 'akra' ? 2 : entryType === 'ring' ? 3 : 4, '0'),
        entryType,
        first: Number(first || 0),
        second: Number(second || 0),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      for (const tx of payloads) {
        const ok = await addTransaction(tx);
        if (!ok) throw new Error('Failed to add one or more entries');
      }

      setNumbers('');
      setFirst('');
      setSecond('');
      onSuccess?.();
      await showSuccess('Entry Added', `Added ${payloads.length} ${entryType} entr${payloads.length > 1 ? 'ies' : 'y'}.`, { duration: 2500 });
    } catch (err) {
      console.error(err);
      await showError('Add Entry Failed', err instanceof Error ? err.message : 'Could not add entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Numbers</label>
          <input
            value={numbers}
            onChange={e => setNumbers(e.target.value)}
            placeholder={entryType === 'ring' ? 'e.g. 123 007 5* *9' : 'e.g. 12 34 56'}
            className="input-field"
          />
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Parsed: {numbersList.join(', ') || '—'}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">First</label>
            <input value={first} onChange={e => setFirst(e.target.value)} className="input-field" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Second</label>
            <input value={second} onChange={e => setSecond(e.target.value)} className="input-field" placeholder="0" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">{numbersList.length} number(s) ready</div>
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Adding…' : 'Add Entry'}
        </button>
      </div>
    </form>
  );
};

export default FreshEntryPanel;


