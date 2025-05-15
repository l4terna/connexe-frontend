import React, { createContext, useContext, useEffect } from 'react';
import { webSocketService } from './WebSocketService';

interface WebSocketContextType {
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({ isConnected: false });

export const useWebSocketContext = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = React.useState(false);

  useEffect(() => {
    const connect = async () => {
      try {
        await webSocketService.ensureConnected();
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      webSocketService.disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}; 