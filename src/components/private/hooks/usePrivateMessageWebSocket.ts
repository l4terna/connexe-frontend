import { useEffect, useRef } from 'react';
import { Channel } from '../../../api/channels';
import { ExtendedMessage } from '../../hub/chat/types/message';

interface PrivateMessageWebSocketCallbacks {
  onMessageCreate: (message: ExtendedMessage) => void;
  onMessageUpdate: (message: ExtendedMessage) => void;
  onMessageDelete: (messageId: number) => void;
  onMessageReadStatus: (range: { from: number; to: number }) => void;
  onHighlightMessage: (messageId: number, duration?: number) => void;
  onUnreadMessage: (messageId: number) => void;
  onMarkMessageAsRead: (messageId: number) => void;
  onNewMessageIndicator: () => void;
  onScrollToBottom: () => void;
  onMarkAllAsRead: () => void;
  onUnreadCountChange: (change: number) => void;
}

interface PrivateMessageWebSocketOptions {
  messagesContainerRef: React.RefObject<HTMLElement>;
  convertToExtendedMessage: (message: any) => ExtendedMessage;
  isScrolledToBottom: boolean;
  isJumpingToMessage: boolean;
  loadingMode: string | null;
  unreadMessagesBufferRef: React.MutableRefObject<Set<number>>;
  addToReadBuffer: (messageId: number) => void;
}

interface User {
  id: number;
  login: string;
  avatar: string | null;
}

export const usePrivateMessageWebSocket = (
  activeChannel: Channel | null,
  user: User,
  callbacks: PrivateMessageWebSocketCallbacks,
  options: PrivateMessageWebSocketOptions
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  const connect = () => {
    if (!activeChannel || activeChannel.type !== 'PRIVATE') {
      return;
    }

    try {
      // Private channel WebSocket URL - adjust based on your backend implementation
      const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:8080'}/ws/private/${activeChannel.id}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`Connected to private chat WebSocket for channel ${activeChannel.id}`);
        reconnectAttemptsRef.current = 0;
        
        // Send authentication or initialization message if needed
        ws.send(JSON.stringify({
          type: 'authenticate',
          userId: user.id,
          channelId: activeChannel.id
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'message_created':
              if (data.message) {
                const extendedMessage = options.convertToExtendedMessage(data.message);
                
                // Check if message is from another user and we're not at bottom
                if (extendedMessage.author.id !== user.id && !options.isScrolledToBottom) {
                  callbacks.onUnreadMessage(extendedMessage.id);
                  callbacks.onUnreadCountChange(1);
                }
                
                callbacks.onMessageCreate(extendedMessage);
                
                // Auto-scroll if at bottom or if it's our own message
                if (options.isScrolledToBottom || extendedMessage.author.id === user.id) {
                  setTimeout(() => {
                    callbacks.onScrollToBottom();
                  }, 100);
                }
              }
              break;

            case 'message_updated':
              if (data.message) {
                const extendedMessage = options.convertToExtendedMessage(data.message);
                callbacks.onMessageUpdate(extendedMessage);
              }
              break;

            case 'message_deleted':
              if (data.messageId) {
                callbacks.onMessageDelete(data.messageId);
              }
              break;

            case 'message_read':
              if (data.messageId) {
                callbacks.onMarkMessageAsRead(data.messageId);
              }
              break;

            case 'messages_read_range':
              if (data.range) {
                callbacks.onMessageReadStatus(data.range);
              }
              break;

            case 'highlight_message':
              if (data.messageId) {
                callbacks.onHighlightMessage(data.messageId, data.duration);
              }
              break;

            case 'typing_start':
              // Handle typing indicators for private chat
              console.log(`${data.user?.login || 'Someone'} is typing...`);
              break;

            case 'typing_stop':
              // Handle typing stop for private chat
              console.log(`${data.user?.login || 'Someone'} stopped typing`);
              break;

            case 'user_online':
              // Handle user coming online
              console.log(`${data.user?.login || 'User'} came online`);
              break;

            case 'user_offline':
              // Handle user going offline
              console.log(`${data.user?.login || 'User'} went offline`);
              break;

            default:
              console.warn('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log(`Private chat WebSocket closed for channel ${activeChannel.id}:`, event.code, event.reason);
        wsRef.current = null;

        // Only attempt reconnection if it wasn't a manual close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('Private chat WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create private chat WebSocket connection:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounting');
      wsRef.current = null;
    }

    reconnectAttemptsRef.current = 0;
  };

  // Send typing indicator
  const sendTypingIndicator = (isTyping: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: isTyping ? 'typing_start' : 'typing_stop',
        channelId: activeChannel?.id,
        userId: user.id
      }));
    }
  };

  // Mark message as read via WebSocket
  const markMessageAsRead = (messageId: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mark_message_read',
        messageId,
        channelId: activeChannel?.id,
        userId: user.id
      }));
    }
  };

  // Mark all messages as read via WebSocket
  const markAllMessagesAsRead = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mark_all_read',
        channelId: activeChannel?.id,
        userId: user.id
      }));
    }
  };

  useEffect(() => {
    connect();
    return disconnect;
  }, [activeChannel?.id]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    sendTypingIndicator,
    markMessageAsRead,
    markAllMessagesAsRead,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
};