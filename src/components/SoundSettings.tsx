import React, { useState, useEffect } from 'react';
import { audioFeedback, type SoundVolumeSettings } from '../utils/audioFeedback';

interface SoundSettingsProps {
  className?: string;
}

const SoundSettings: React.FC<SoundSettingsProps> = ({ className = '' }) => {
  const [volumes, setVolumes] = useState<SoundVolumeSettings>(audioFeedback.getVolumeSettings());
  const [enabled, setEnabled] = useState(audioFeedback.isEnabled());

  useEffect(() => {
    // Load current settings
    setVolumes(audioFeedback.getVolumeSettings());
    setEnabled(audioFeedback.isEnabled());
  }, []);

  const handleVolumeChange = (category: keyof Omit<SoundVolumeSettings, 'master'>, value: number) => {
    const newVolumes = { ...volumes, [category]: value };
    setVolumes(newVolumes);
    audioFeedback.setVolume(category, value);
  };

  const handleMasterVolumeChange = (value: number) => {
    const newVolumes = { ...volumes, master: value };
    setVolumes(newVolumes);
    audioFeedback.setMasterVolume(value);
  };

  const handleEnabledToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    audioFeedback.setEnabled(newEnabled);
  };

  const playTestSound = (category: keyof Omit<SoundVolumeSettings, 'master'>) => {
    switch (category) {
      case 'money':
        audioFeedback.playMoneyDeposit(1000);
        break;
      case 'notifications':
        audioFeedback.playNotificationByType('info');
        break;
      case 'navigation':
        audioFeedback.playNavigate();
        break;
      case 'ui':
        audioFeedback.playClick();
        break;
    }
  };

  const formatVolumeLabel = (volume: number) => {
    return `${Math.round(volume * 100)}%`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sound Settings</h3>
        <button
          onClick={handleEnabledToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* Master Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Master Volume
              </label>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formatVolumeLabel(volumes.master)}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumes.master}
                onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <button
                onClick={() => audioFeedback.playClick()}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Test
              </button>
            </div>
          </div>

          {/* Money Sounds */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Money Sounds
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatVolumeLabel(volumes.money)}
                </span>
                <button
                  onClick={() => playTestSound('money')}
                  className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-md transition-colors"
                >
                  Test
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volumes.money}
              onChange={(e) => handleVolumeChange('money', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Notification Sounds */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Notifications
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatVolumeLabel(volumes.notifications)}
                </span>
                <button
                  onClick={() => playTestSound('notifications')}
                  className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 rounded-md transition-colors"
                >
                  Test
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volumes.notifications}
              onChange={(e) => handleVolumeChange('notifications', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Navigation Sounds */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Navigation
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatVolumeLabel(volumes.navigation)}
                </span>
                <button
                  onClick={() => playTestSound('navigation')}
                  className="px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-md transition-colors"
                >
                  Test
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volumes.navigation}
              onChange={(e) => handleVolumeChange('navigation', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* UI Interaction Sounds */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                UI Interactions
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatVolumeLabel(volumes.ui)}
                </span>
                <button
                  onClick={() => playTestSound('ui')}
                  className="px-3 py-1 text-xs bg-orange-100 dark:bg-orange-900 hover:bg-orange-200 dark:hover:bg-orange-800 rounded-md transition-colors"
                >
                  Test
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volumes.ui}
              onChange={(e) => handleVolumeChange('ui', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>
      )}

      {!enabled && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sounds are currently disabled. Toggle the switch above to enable them.
          </p>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          .slider::-webkit-slider-thumb {
            appearance: none;
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .slider::-moz-range-thumb {
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
        `
      }} />
    </div>
  );
};

export default SoundSettings;
