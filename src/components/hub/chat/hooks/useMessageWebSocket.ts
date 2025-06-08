import { useCallback, useRef, useEffect } from 'react';
import { useWebSocket } from '@/websocket/useWebSocket';
import { webSocketService } from '@/websocket/WebSocketService';
import type { Message } from '@/api/channels';
import { ExtendedMessage, MessageStatus } from '../types/message';

// Типы WebSocket событий
export interface WebSocketMessageData {
  type: 'MESSAGE_CREATE' | 'MESSAGE_UPDATE' | 'MESSAGE_DELETE' | 'MESSAGE_READ_STATUS';
  message?: Message;
  messageId?: number;
  channelId?: number;
  message_range?: { from: number; to: number };
}

// Интерфейс для канала
export interface Channel {
  id: number;
  [key: string]: any;
}

// Интерфейс для пользователя
export interface User {
  id: number;
  [key: string]: any;
}

// Функции обратного вызова для обновления состояния
export interface MessageWebSocketCallbacks {
  onMessageCreate: (message: ExtendedMessage) => void;
  onMessageUpdate: (message: ExtendedMessage) => void;
  onMessageDelete: (messageId: number) => void;
  onMessageReadStatus: (range: { from: number; to: number }) => void;
  onHighlightMessage: (messageId: number, duration?: number) => void;
  onUnreadMessage: (messageId: number) => void;
  onMarkMessageAsRead: (messageId: number) => void;
  onNewMessageIndicator: (show: boolean) => void;
  onScrollToBottom: () => void;
  onMarkAllAsRead: () => void;
  onUnreadCountChange: (change: number) => void;
}

// Интерфейс для дополнительных опций
export interface MessageWebSocketOptions {
  messagesContainerRef: React.RefObject<HTMLElement>;
  convertToExtendedMessage: (message: Message) => ExtendedMessage;
  isScrolledToBottom: boolean;
  isJumpingToMessage: boolean;
  loadingMode: string | null;
  unreadMessagesBufferRef: React.RefObject<Set<number>>;
  addToReadBuffer: (messageId: number) => void;
  bulkReadAllRef: React.RefObject<number>;
}

export const useMessageWebSocket = (
  activeChannel: Channel | null,
  user: User | null,
  callbacks: MessageWebSocketCallbacks,
  options: MessageWebSocketOptions
) => {
  // Debouncing for bulk-read-all calls
  const lastBulkReadAllTimeRef = useRef<number>(0);
  
  // Use refs to keep stable references to callbacks and options
  const callbacksRef = useRef(callbacks);
  const optionsRef = useRef(options);
  
  // Update refs when values change
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);
  
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  
  const debouncedBulkReadAll = useCallback(() => {
    if (!activeChannel) return;
    
    const now = Date.now();
    if (now - lastBulkReadAllTimeRef.current > 1000 && now - optionsRef.current.bulkReadAllRef.current > 1000) {
      lastBulkReadAllTimeRef.current = now;
      optionsRef.current.bulkReadAllRef.current = now;
      webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
      callbacksRef.current.onMarkAllAsRead();
    }
  }, [activeChannel?.id]);

  const handleNewMessage = useCallback((data: WebSocketMessageData) => {
    const currentOptions = optionsRef.current;
    const currentCallbacks = callbacksRef.current;
    
    if (data.type === 'MESSAGE_CREATE' && data.message) {
      const newMessage = currentOptions.convertToExtendedMessage(data.message);
      
      // Skip processing if the message is from the current user
      if (newMessage.author.id === user?.id) {
        return;
      }
      
      // Add new message
      currentCallbacks.onMessageCreate(newMessage);
      
      // Highlight message temporarily
      currentCallbacks.onHighlightMessage(newMessage.id, 1500);
      
      // Handle NEW message status
      if (newMessage.status === MessageStatus.NEW) {
        const container = currentOptions.messagesContainerRef.current;
        if (container) {
          const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
          const isAtBottom = scrollPosition < 100;
          const isScrolledUpSignificantly = scrollPosition > 300;
          
          if (isAtBottom && activeChannel) {
            // User is at bottom - mark as read immediately
            currentOptions.addToReadBuffer(newMessage.id);
            currentCallbacks.onMarkMessageAsRead(newMessage.id);
            
            // Auto-scroll if not jumping to message
            if (currentOptions.loadingMode !== 'around' && !currentOptions.isJumpingToMessage) {
              currentCallbacks.onScrollToBottom();
            }
            
            // Mark all messages as read
            debouncedBulkReadAll();
          } else if (isScrolledUpSignificantly) {
            // User is scrolled up significantly - show indicator
            currentCallbacks.onNewMessageIndicator(true);
            currentCallbacks.onUnreadMessage(newMessage.id);
            
            // Check if message becomes visible
            setTimeout(() => {
              const messageElement = document.querySelector(`[data-msg-id="${newMessage.id}"]`);
              if (messageElement) {
                const rect = messageElement.getBoundingClientRect();
                const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
                
                if (isVisible && activeChannel) {
                  currentOptions.addToReadBuffer(newMessage.id);
                  currentCallbacks.onMarkMessageAsRead(newMessage.id);
                }
              }
            }, 100);
          } else {
            // User is slightly scrolled up - auto-scroll and mark as read
            currentOptions.addToReadBuffer(newMessage.id);
            currentCallbacks.onMarkMessageAsRead(newMessage.id);
            
            if (currentOptions.loadingMode !== 'around' && !currentOptions.isJumpingToMessage) {
              currentCallbacks.onScrollToBottom();
            }
            
            // Mark all messages as read
            debouncedBulkReadAll();
          }
        }
      }
    } else if (data.type === 'MESSAGE_UPDATE' && data.message) {
      const updatedMessage = currentOptions.convertToExtendedMessage(data.message);
      currentCallbacks.onMessageUpdate(updatedMessage);
      
      // Update unread status if message status changed to read
      if (updatedMessage.status === MessageStatus.READ) {
        currentCallbacks.onUnreadCountChange(-1);
      }
    } else if (data.type === 'MESSAGE_DELETE' && data.messageId) {
      currentCallbacks.onMessageDelete(data.messageId);
      currentCallbacks.onUnreadCountChange(-1);
    } else if (data.type === 'MESSAGE_READ_STATUS' && data.message_range) {
      // Handle message read status updates
      currentCallbacks.onMessageReadStatus(data.message_range);
    }
  }, [
    user?.id,
    activeChannel?.id,
    debouncedBulkReadAll
  ]);

  // Subscribe to user-specific queue
  useWebSocket(
    activeChannel && user ? `/v1/user/${user.id}/queue/channels/${activeChannel.id}/messages` : null,
    handleNewMessage
  );

  // Subscribe to channel topic
  useWebSocket(
    activeChannel ? `/v1/topic/channels/${activeChannel.id}/messages` : null,
    handleNewMessage
  );

  // WebSocket hook setup complete
  return {};
};