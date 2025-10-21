import React from 'react';

interface SettingItemProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

const SettingItem: React.FC<SettingItemProps> = ({
  label,
  description,
  children,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${className}`}>
      <div className="flex-1 min-w-0">
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
          {label}
        </label>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </p>
        )}
      </div>
      <div className="ml-6 flex-shrink-0">
        {children}
      </div>
    </div>
  );
};

export default SettingItem;
