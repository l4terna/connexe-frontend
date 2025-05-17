import React from 'react';
import { HubMember } from '@/api/users';

interface HubContextType {
  updateHubData: () => Promise<void>;
  setUpdateHubData: (fn: () => Promise<void>) => void;
  hubMembers: HubMember[];
  setHubMembers: (members: HubMember[]) => void;
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
  const [hubMembers, setHubMembers] = React.useState<HubMember[]>([]);
  
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
    setUpdateHubData,
    hubMembers,
    setHubMembers
  }), [setUpdateHubData, hubMembers]);

  return (
    <HubContext.Provider value={contextValue}>
      {children}
    </HubContext.Provider>
  );
}; 