import React, { createContext, useContext, useEffect, useState } from 'react';

interface ScalingContextType {
  viewportWidth: number;
  setViewportWidth: (width: number) => void;
  scalePercentage: number;
  setScalePercentage: (percentage: number) => void;
}

const ScalingContext = createContext<ScalingContextType | undefined>(undefined);

export const ScalingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewportWidth, setViewportWidth] = useState<number>(1280); // Default to 1280px
  const [scalePercentage, setScalePercentage] = useState<number>(100); // Default to 100%

  const updateViewportMeta = (width: number) => {
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (viewportMeta) {
      viewportMeta.content = `width=${width}, user-scalable=no, viewport-fit=cover`;
    }
  };

  useEffect(() => {
    // Get scaling preference from localStorage
    const savedWidth = localStorage.getItem('gull-viewport-width');
    const savedScale = localStorage.getItem('gull-scale-percentage');
    
    if (savedWidth) {
      setViewportWidth(parseInt(savedWidth, 10));
    }
    
    if (savedScale) {
      const scale = parseInt(savedScale, 10);
      setScalePercentage(scale);
      
      // Calculate actual viewport width based on scale percentage
      const baseWidth = 1280; // Base width for 100%
      const scaledWidth = Math.round((baseWidth * 100) / scale);
      updateViewportMeta(scaledWidth);
    } else {
      // Initialize with default 1280px width
      updateViewportMeta(1280);
    }
  }, []);

  const updateViewportWidth = (width: number) => {
    setViewportWidth(width);
    localStorage.setItem('gull-viewport-width', width.toString());
    updateViewportMeta(width);
  };

  const updateScalePercentage = (percentage: number) => {
    setScalePercentage(percentage);
    localStorage.setItem('gull-scale-percentage', percentage.toString());
    
    // Calculate actual viewport width based on scale percentage
    // Higher percentage = larger elements = smaller viewport width
    // Lower percentage = smaller elements = larger viewport width
    const baseWidth = 1280; // Base width for 100%
    const scaledWidth = Math.round((baseWidth * 100) / percentage);
    updateViewportMeta(scaledWidth);
  };

  return (
    <ScalingContext.Provider 
      value={{ 
        viewportWidth, 
        setViewportWidth: updateViewportWidth,
        scalePercentage,
        setScalePercentage: updateScalePercentage
      }}
    >
      {children}
    </ScalingContext.Provider>
  );
};

export const useScaling = () => {
  const context = useContext(ScalingContext);
  if (context === undefined) {
    throw new Error('useScaling must be used within a ScalingProvider');
  }
  return context;
};
