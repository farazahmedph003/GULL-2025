import React, { createContext, useContext, useEffect, useState } from 'react';

export type FontSize = 'small' | 'medium' | 'large';

interface AppearanceContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  animationsEnabled: boolean;
  setAnimationsEnabled: (enabled: boolean) => void;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');
  const [animationsEnabled, setAnimationsEnabledState] = useState(true);

  useEffect(() => {
    // Load from localStorage
    const savedFontSize = localStorage.getItem('gull-font-size') as FontSize || 'medium';
    const savedAnimations = localStorage.getItem('gull-animations-enabled');
    
    setFontSizeState(savedFontSize);
    setAnimationsEnabledState(savedAnimations !== 'false');
  }, []);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem('gull-font-size', size);
    applyFontSize(size);
  };

  const setAnimationsEnabled = (enabled: boolean) => {
    setAnimationsEnabledState(enabled);
    localStorage.setItem('gull-animations-enabled', enabled.toString());
    applyAnimationsEnabled(enabled);
  };

  const applyFontSize = (size: FontSize) => {
    const root = document.documentElement;
    root.classList.remove('font-sm', 'font-base', 'font-lg');
    
    switch (size) {
      case 'small':
        root.classList.add('font-sm');
        break;
      case 'medium':
        root.classList.add('font-base');
        break;
      case 'large':
        root.classList.add('font-lg');
        break;
    }
  };

  const applyAnimationsEnabled = (enabled: boolean) => {
    const root = document.documentElement;
    if (enabled) {
      root.classList.remove('no-animations');
    } else {
      root.classList.add('no-animations');
    }
  };

  // Apply initial settings
  useEffect(() => {
    applyFontSize(fontSize);
  }, [fontSize]);

  useEffect(() => {
    applyAnimationsEnabled(animationsEnabled);
  }, [animationsEnabled]);

  return (
    <AppearanceContext.Provider 
      value={{ 
        fontSize, 
        setFontSize, 
        animationsEnabled, 
        setAnimationsEnabled 
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
};
