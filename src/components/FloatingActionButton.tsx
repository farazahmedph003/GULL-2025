import React from 'react';

interface FloatingActionButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  position: 'bottom-left' | 'bottom-right';
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'purple';
  performanceMode?: 'default' | 'stable';
  showTooltip?: boolean;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  icon,
  label,
  position,
  color = 'secondary',
  performanceMode = 'default',
  showTooltip = true,
}) => {
  const positionClasses = {
    'bottom-left': 'bottom-6 left-6',
    'bottom-right': 'bottom-6 right-6',
  };

  const colorClasses = {
    primary: 'bg-primary hover:bg-primary-dark', // Coral red
    secondary: 'bg-secondary hover:bg-secondary-dark', // Dark navy
    accent: 'bg-accent-teal hover:bg-cyan-600',
    success: 'bg-success hover:bg-green-600',
    warning: 'bg-warning hover:bg-yellow-600',
    danger: 'bg-danger hover:bg-red-600',
    purple: 'bg-accent-purple hover:bg-purple-700',
  };

  const baseButtonClasses = performanceMode === 'stable'
    ? `fixed ${positionClasses[position]} ${colorClasses[color]} text-white p-4 rounded-full shadow-md transition-colors duration-150 z-50 group will-change-transform`
    : `fixed ${positionClasses[position]} ${colorClasses[color]} text-white p-4 rounded-full shadow-floating hover:shadow-2xl transition-all duration-200 hover:scale-110 z-50 group will-change-transform`;

  return (
    <button
      onClick={onClick}
      className={baseButtonClasses}
      aria-label={label}
      title={label}
      data-action="add-entry"
      style={{ boxShadow: '0 12px 24px rgba(0, 0, 0, 0.12)', transform: 'translateZ(0)', WebkitFontSmoothing: 'antialiased', backfaceVisibility: 'hidden' as any }}
    >
      {icon}
      
      {/* Tooltip - Design System */}
      {showTooltip && (
        <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-3 py-1.5 bg-secondary text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {label}
          <span className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-secondary" />
        </span>
      )}
    </button>
  );
};

export default FloatingActionButton;

