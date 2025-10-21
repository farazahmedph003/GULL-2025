import React from 'react';

interface AnimationToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
}

const AnimationToggle: React.FC<AnimationToggleProps> = ({
  enabled,
  onChange,
  className = ''
}) => {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
      style={{
        backgroundColor: enabled ? '#3b82f6' : '#d1d5db'
      }}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
};

export default AnimationToggle;
