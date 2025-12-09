import { db } from './database';
import { readQueue, removeQueueItem, type SyncQueueItem } from './localDb';

// Runs a lightweight background loop that flushes queued offline mutations
// to Supabase as soon as connectivity is available.
let syncInterval: number | null = null;
let isRunning = false;

const processItem = async (item: SyncQueueItem) => {
  switch (item.entity) {
    case 'transactions':
      if (item.op === 'create') {
        const { userId, transaction, adminUserId } = item.payload || {};
        if (userId && transaction) {
          await db.createTransaction(userId, transaction, adminUserId);
        }
      } else if (item.op === 'update') {
        const { transactionId, updates, adminUserId } = item.payload || {};
        if (transactionId && updates) {
          await db.updateTransaction(transactionId, updates, adminUserId);
        }
      } else if (item.op === 'delete') {
        const { ids, adminUserId } = item.payload || {};
        if (Array.isArray(ids) && ids.length > 0) {
          if (ids.length === 1) {
            await db.deleteTransaction(ids[0], adminUserId);
          } else {
            await db.deleteTransactionsBatch(ids, adminUserId);
          }
        }
      }
      break;
    case 'balance_history':
      if (item.op === 'create') {
        const { userId, balance, totalSpent } = item.payload || {};
        if (userId !== undefined && balance !== undefined) {
          await db.updateUserBalance(userId, balance, { totalSpent });
        }
      }
      break;
    default:
      // Unknown entity - skip
      break;
  }
};

export const startSyncLoop = (intervalMs = 2000) => {
  if (syncInterval !== null) return;

  const run = async () => {
    if (isRunning) return;
    if (!db.isOnline()) return;

    isRunning = true;
    try {
      const items = await readQueue();
      for (const item of items) {
        try {
          await processItem(item);
          if (item.id !== undefined) {
            await removeQueueItem(item.id);
          }
        } catch (err) {
          console.error('Sync item failed, will retry later:', item, err);
        }
      }
    } finally {
      isRunning = false;
    }
  };

  // Kick off immediately, then interval
  run();
  syncInterval = window.setInterval(run, intervalMs);
};


