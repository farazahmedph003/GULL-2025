import React from 'react';

interface ScalingSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const ScalingSlider: React.FC<ScalingSliderProps> = ({
  value,
  onChange,
  min = 50,
  max = 200,
  step = 10
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10));
  };

  const getScaleLabel = (scale: number) => {
    if (scale < 80) return 'Small';
    if (scale < 120) return 'Medium';
    if (scale < 160) return 'Large';
    return 'Extra Large';
  };

  const getScaleDescription = (scale: number) => {
    if (scale < 80) return 'Smaller elements, more content fits on screen';
    if (scale < 120) return 'Balanced size, good readability';
    if (scale < 160) return 'Larger elements, easier to tap and read';
    return 'Maximum size, best for accessibility';
  };

  return (
    <div className="space-y-4">
      {/* Current Value Display */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {value}% - {getScaleLabel(value)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {getScaleDescription(value)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {value}%
          </div>
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #6366F1 0%, #6366F1 ${((value - min) / (max - min)) * 100}%, #E5E7EB ${((value - min) / (max - min)) * 100}%, #E5E7EB 100%)`
          }}
        />
        
        {/* Scale markers */}
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{min}%</span>
          <span>100%</span>
          <span>{max}%</span>
        </div>
      </div>

      {/* Quick preset buttons */}
      <div className="flex space-x-2">
        {[75, 100, 125, 150].map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              value === preset
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {preset}%
          </button>
        ))}
      </div>

      {/* Preview info */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <strong>How it works:</strong> The desktop layout will always fit your screen width perfectly.
          {value < 100 && ' Elements will appear smaller, showing more content.'}
          {value > 100 && ' Elements will appear larger, improving readability.'}
          {value === 100 && ' Standard desktop size.'}
          <br />
          <em>No horizontal scrolling - everything fits your screen!</em>
        </div>
      </div>
    </div>
  );
};

export default ScalingSlider;
