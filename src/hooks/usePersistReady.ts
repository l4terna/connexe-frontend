import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

export const usePersistReady = () => {
  const [isReady, setIsReady] = useState(false);
  const _persist = useSelector((state: RootState) => (state as any)._persist);
  
  useEffect(() => {
    if (_persist) {
      setIsReady(_persist.rehydrated);
    } else {
      // If no persist state, assume it's ready
      setIsReady(true);
    }
  }, [_persist]);
  
  return isReady;
};