import React from 'react';

interface HubContextType {
  updateHubData: () => Promise<void>;
  setUpdateHubData: (fn: () => Promise<void>) => void;
}

export const HubContext = React.createContext<HubContextType | null>(null);

export const useHubContext = () => {
  const context = React.useContext(HubContext);
  if (!context) {
    throw new Error('useHubContext must be used within a HubProvider');
  }
  return context;
};

export const HubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const updateHubDataRef = React.useRef<() => Promise<void>>(() => Promise.resolve());
  const isInitializedRef = React.useRef(false);
  
  const setUpdateHubData = React.useCallback((fn: () => Promise<void>) => {
    updateHubDataRef.current = fn;
    isInitializedRef.current = true;
  }, []);

  const contextValue = React.useMemo(() => ({
    updateHubData: async () => {
      if (isInitializedRef.current) {
        try {
          await updateHubDataRef.current();
        } catch (error) {
          console.error('Error in updateHubData:', error);
        }
      }
    },
    setUpdateHubData
  }), [setUpdateHubData]);

  return (
    <HubContext.Provider value={contextValue}>
      {children}
    </HubContext.Provider>
  );
}; 