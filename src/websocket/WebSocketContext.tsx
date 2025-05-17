import React, { createContext, useContext, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { webSocketService } from './WebSocketService';
import { usersApi } from '@/api/users';

interface WebSocketContextType {
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({ isConnected: false });

export const useWebSocketContext = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = React.useState(false);
  const [shouldConnect, setShouldConnect] = React.useState(false);
  const token = useSelector((state: RootState) => state.auth.token);
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  
  // Use RTK Query to check user endpoint
  const { data: userData, error: userError, refetch } = usersApi.useGetCurrentUserQuery(undefined, {
    skip: !isAuthenticated || !token
  });

  // Check authentication and trigger user check
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log('WebSocket: User authenticated with token, checking endpoint');
      // Reset connection state when re-authenticating
      setIsConnected(false);
      setShouldConnect(false);
      refetch();
    } else {
      console.log('WebSocket: User not authenticated or no token');
      setShouldConnect(false);
      setIsConnected(false);
      // Disconnect any existing connection
      if (webSocketService.isConnected()) {
        webSocketService.disconnect();
      }
    }
  }, [isAuthenticated, token, refetch]);

  // Connect to WebSocket after successful user check
  useEffect(() => {
    let isSubscribed = true;
    
    const connect = async () => {
      if (!shouldConnect || !token) {
        console.log('WebSocket: Cannot connect - no token or shouldConnect is false');
        return;
      }
      
      try {
        console.log('WebSocket: Connecting to WebSocket with token');
        await webSocketService.ensureConnected();
        if (isSubscribed) {
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        if (isSubscribed) {
          setIsConnected(false);
        }
      }
    };

    if (userData && !userError && token) {
      console.log('WebSocket: User endpoint successful and token available, enabling connection');
      setShouldConnect(true);
      connect();
    } else if (userError) {
      console.error('WebSocket: User endpoint failed, not connecting', userError);
      setShouldConnect(false);
      setIsConnected(false);
    } else if (!token) {
      console.log('WebSocket: No token available, not connecting');
      setShouldConnect(false);
      setIsConnected(false);
    }

    return () => {
      isSubscribed = false;
    };
  }, [userData, userError, shouldConnect, token]);
  
  // Handle disconnection when authentication changes
  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (isConnected || shouldConnect) {
        console.log('WebSocket: Disconnecting - user no longer authenticated or no token');
        webSocketService.disconnect();
        setIsConnected(false);
        setShouldConnect(false);
      }
    }
  }, [isAuthenticated, token, isConnected, shouldConnect]);

  return (
    <WebSocketContext.Provider value={{ isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}; 