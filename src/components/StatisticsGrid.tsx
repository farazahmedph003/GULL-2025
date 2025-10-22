import React from 'react';
import SummaryCard from './SummaryCard';
import type { ProjectStatistics, EntryType } from '../types';

interface StatisticsGridProps {
  statistics: ProjectStatistics;
  entryType?: EntryType;
  onCardClick?: (type: 'first' | 'second' | 'entries' | 'unique') => void;
}

const StatisticsGrid: React.FC<StatisticsGridProps> = ({
  statistics,
  entryType,
  onCardClick,
}) => {
  const getEntryCount = () => {
    if (!entryType) return statistics.totalEntries;
    return entryType === 'akra' ? statistics.akraEntries : statistics.ringEntries;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {/* FIRST Total */}
      <SummaryCard
        title="FIRST Total"
        value={statistics.firstTotal}
        subtitle="Total amount"
        color="secondary"
        onClick={() => onCardClick?.('first')}
        icon={
          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      {/* SECOND Total */}
      <SummaryCard
        title="SECOND Total"
        value={statistics.secondTotal}
        subtitle="Total amount"
        color="accent"
        onClick={() => onCardClick?.('second')}
        icon={
          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
      />

      {/* Total Entries */}
      <SummaryCard
        title={entryType ? `${entryType.toUpperCase()} Entries` : 'Total Entries'}
        value={getEntryCount()}
        subtitle="Transactions"
        color="success"
        onClick={() => onCardClick?.('entries')}
        icon={
          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />

      {/* Unique Numbers */}
      <SummaryCard
        title="Unique Numbers"
        value={statistics.uniqueNumbers}
        subtitle="Different numbers"
        color="warning"
        onClick={() => onCardClick?.('unique')}
        icon={
          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        }
      />
    </div>
  );
};

export default StatisticsGrid;

