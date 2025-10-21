import React from 'react';

export type FontSize = 'small' | 'medium' | 'large';

interface FontSizeSelectorProps {
  value: FontSize;
  onChange: (size: FontSize) => void;
  className?: string;
}

const FontSizeSelector: React.FC<FontSizeSelectorProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const sizes: { value: FontSize; label: string; preview: string }[] = [
    { value: 'small', label: 'Small', preview: 'Aa' },
    { value: 'medium', label: 'Medium', preview: 'Aa' },
    { value: 'large', label: 'Large', preview: 'Aa' }
  ];

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {sizes.map((size) => (
        <button
          key={size.value}
          onClick={() => onChange(size.value)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all ${
            value === size.value
              ? 'bg-blue-500 text-white border-blue-500 shadow-lg'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <span
            className={`font-medium ${
              size.value === 'small' ? 'text-sm' :
              size.value === 'medium' ? 'text-base' : 'text-lg'
            }`}
          >
            {size.preview}
          </span>
          <span className="text-sm">{size.label}</span>
        </button>
      ))}
    </div>
  );
};

export default FontSizeSelector;
