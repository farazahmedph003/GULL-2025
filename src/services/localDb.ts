import Dexie from 'dexie';
import type { Table } from 'dexie';

export type SyncOperationType = 'create' | 'update' | 'delete';

export interface LocalUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role?: string;
  is_active?: boolean;
  balance?: number;
  updated_at?: string;
}

export interface LocalTransaction {
  id: string;
  user_id: string;
  project_id?: string | null;
  number: string;
  entry_type: 'open' | 'akra' | 'ring' | 'packet';
  first_amount: number;
  second_amount: number;
  created_at: string;
  updated_at?: string;
}

export interface LocalSetting {
  key: string;
  value: any;
  updated_at?: string;
}

export interface LocalBalanceHistory {
  id?: string;
  user_id: string;
  amount: number;
  type: 'top_up' | 'deduct';
  balance_after: number;
  created_at?: string;
}

export interface SyncQueueItem {
  id?: number;
  entity: 'app_users' | 'transactions' | 'system_settings' | 'balance_history';
  op: SyncOperationType;
  payload: any;
  created_at: number;
}

class LocalDb extends Dexie {
  users!: Table<LocalUser, string>;
  transactions!: Table<LocalTransaction, string>;
  settings!: Table<LocalSetting, string>;
  balanceHistory!: Table<LocalBalanceHistory, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('gull_offline_db');
    this.version(1).stores({
      users: 'id, username, email, updated_at',
      transactions: 'id, user_id, entry_type, created_at, updated_at',
      settings: 'key',
      balanceHistory: '++id, user_id, created_at',
      syncQueue: '++id, entity, op, created_at'
    });
  }
}

export const localDb = new LocalDb();

// Cache helpers
export async function cacheUsers(users: LocalUser[]) {
  await localDb.users.bulkPut(users.map(u => ({ ...u, updated_at: u.updated_at || new Date().toISOString() })));
}

export async function cacheTransactions(rows: LocalTransaction[]) {
  await localDb.transactions.bulkPut(rows.map(r => ({ ...r, updated_at: r.updated_at || new Date().toISOString() })));
}

export async function cacheSetting(key: string, value: any) {
  await localDb.settings.put({ key, value, updated_at: new Date().toISOString() });
}

export async function getUsersWithStatsFromCache() {
  const users = await localDb.users.toArray();
  // Count transactions per user
  const counts: Record<string, number> = {};
  await localDb.transactions.each(t => {
    counts[t.user_id] = (counts[t.user_id] || 0) + 1;
  });
  return users.map(u => ({ ...u, entryCount: counts[u.id] || 0 }));
}

export async function getEntriesByTypeFromCache(entryType: string) {
  const rows = await localDb.transactions.where('entry_type').equals(entryType as any).toArray();
  // For admin pages that show username/full_name, try to join from cache
  const userMap = new Map<string, LocalUser>();
  await localDb.users.each(u => userMap.set(u.id, u));
  return rows.map(r => ({
    ...r,
    app_users: {
      username: userMap.get(r.user_id)?.username || 'user',
      full_name: userMap.get(r.user_id)?.full_name || 'User'
    }
  }));
}

export async function clearTransactionsCache() {
  await localDb.transactions.clear();
}

// Queue helpers
export async function enqueue(entity: SyncQueueItem['entity'], op: SyncQueueItem['op'], payload: any) {
  await localDb.syncQueue.add({ entity, op, payload, created_at: Date.now() });
}

export async function readQueue() { return localDb.syncQueue.orderBy('created_at').toArray(); }
export async function removeQueueItem(id: number) { return localDb.syncQueue.delete(id); }


