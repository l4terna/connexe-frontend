import { useEffect, useCallback } from 'react';
import { webSocketService } from './WebSocketService';

export const useWebSocket = (topic: string | null, callback: (message: any) => void) => {
  const handleMessage = useCallback(callback, [callback]);

  useEffect(() => {
    if (!topic) return;

    let mounted = true;

    const setupSubscription = async () => {
      try {
        await webSocketService.subscribe(topic, handleMessage);
      } catch (error) {
        console.error('Failed to setup WebSocket subscription:', error);
      }
    };

    if (mounted) {
      setupSubscription();
    }

    return () => {
      mounted = false;
      webSocketService.unsubscribe(topic, handleMessage);
    };
  }, [topic, handleMessage]);
}; 