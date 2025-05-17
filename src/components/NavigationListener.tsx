import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/redux';
import { store } from '@/store';
import { navigateTo } from '@/store/navigationMiddleware';

export const NavigationListener: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Subscribe to navigation actions
    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const lastAction = (state as any)._lastAction;
      
      if (lastAction && navigateTo.match(lastAction)) {
        navigate(lastAction.payload);
      }
    });

    return unsubscribe;
  }, [navigate]);

  return <>{children}</>;
};