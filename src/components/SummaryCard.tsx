import React from 'react';

interface SummaryCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'secondary',
  onClick,
}) => {
  const getGradientBg = () => {
    switch (color) {
      case 'secondary':
        return 'from-purple-500 to-blue-600';
      case 'accent':
        return 'from-teal-500 to-cyan-600';
      case 'success':
        return 'from-emerald-500 to-green-600';
      case 'warning':
        return 'from-orange-500 to-yellow-600';
      case 'danger':
        return 'from-red-500 to-pink-600';
      default:
        return 'from-blue-500 to-indigo-600';
    }
  };

  const getCardBg = () => {
    switch (color) {
      case 'secondary':
        return 'bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-100 dark:border-purple-800/30';
      case 'accent':
        return 'bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-teal-100 dark:border-teal-800/30';
      case 'success':
        return 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-100 dark:border-emerald-800/30';
      case 'warning':
        return 'bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-orange-100 dark:border-orange-800/30';
      case 'danger':
        return 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-100 dark:border-red-800/30';
      default:
        return 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800/30';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative ${getCardBg()} border rounded-xl sm:rounded-2xl p-4 sm:p-6 ${onClick ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1 active:scale-95' : ''} transition-all duration-300 group overflow-hidden min-h-[120px] sm:min-h-[140px]`}
    >
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getGradientBg()} opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity duration-300 rounded-xl sm:rounded-2xl`}></div>
      
      <div className="relative z-10 h-full flex flex-col">
        {/* Header with Icon */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1 truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${getGradientBg()} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0 ml-2`}>
              <div className="text-white">
                {icon}
              </div>
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-2 sm:mb-3 flex-1 flex items-center">
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>

        {/* Trend */}
        {trend && (
          <div className={`flex items-center text-xs sm:text-sm font-medium pt-2 border-t border-gray-200 dark:border-gray-700 ${trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend.isPositive ? (
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryCard;

