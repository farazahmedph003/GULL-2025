import React from 'react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  icon,
  children,
  className = ''
}) => {
  return (
    <div className={`card ${className}`}>
      <div className="flex items-center space-x-3 mb-6">
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-xl shadow-lg">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
      
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

export default SettingsSection;
