import type { AmountLimitMap, EntryType, Transaction } from '../types';

const PAD_LENGTH: Record<EntryType, number> = {
  open: 1,
  akra: 2,
  ring: 3,
  packet: 4,
};

export const padNumberForEntryType = (value: string, entryType: EntryType): string => {
  const length = PAD_LENGTH[entryType];
  return value.padStart(length, '0');
};

export const getExistingTotalsForNumber = (
  transactions: Transaction[],
  entryType: EntryType,
  paddedNumber: string,
): { first: number; second: number } => {
  return transactions
    .filter((t) => t.entryType === entryType && t.number === paddedNumber)
    .reduce(
      (acc, transaction) => {
        acc.first += transaction.first || 0;
        acc.second += transaction.second || 0;
        return acc;
      },
      { first: 0, second: 0 },
    );
};

export const getLimitsForEntryType = (limits: AmountLimitMap, entryType: EntryType) =>
  limits[entryType] ?? { first: null, second: null };









