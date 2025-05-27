import { useCallback } from 'react';
import { useWebSocket } from '@/websocket/useWebSocket';
import { webSocketService } from '@/websocket/WebSocketService';
import type { Message } from '@/api/channels';

// Enum для статусов сообщений
enum MessageStatus {
  SENT = 0,
  READ = 1,
  NEW = 2
}

// Интерфейс расширенного сообщения
export interface ExtendedMessage extends Message {
  status: MessageStatus;
  channel_id?: number;
}

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
}

export const useMessageWebSocket = (
  activeChannel: Channel | null,
  user: User | null,
  callbacks: MessageWebSocketCallbacks,
  options: MessageWebSocketOptions
) => {

  const handleNewMessage = useCallback((data: WebSocketMessageData) => {
    if (data.type === 'MESSAGE_CREATE' && data.message) {
      const newMessage = options.convertToExtendedMessage(data.message);
      
      // Skip processing if the message is from the current user
      if (newMessage.author.id === user?.id) {
        return;
      }
      
      // Add new message
      callbacks.onMessageCreate(newMessage);
      
      // Highlight message temporarily
      callbacks.onHighlightMessage(newMessage.id, 1500);
      
      // Handle NEW message status
      if (newMessage.status === MessageStatus.NEW) {
        const container = options.messagesContainerRef.current;
        if (container) {
          const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
          const isAtBottom = scrollPosition < 100;
          const isScrolledUpSignificantly = scrollPosition > 300;
          
          if (isAtBottom && activeChannel) {
            // User is at bottom - mark as read immediately
            options.addToReadBuffer(newMessage.id);
            callbacks.onMarkMessageAsRead(newMessage.id);
            
            // Auto-scroll if not jumping to message
            if (options.loadingMode !== 'around' && !options.isJumpingToMessage) {
              callbacks.onScrollToBottom();
            }
            
            // Mark all messages as read
            webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
            callbacks.onMarkAllAsRead();
          } else if (isScrolledUpSignificantly) {
            // User is scrolled up significantly - show indicator
            callbacks.onNewMessageIndicator(true);
            callbacks.onUnreadMessage(newMessage.id);
            
            // Check if message becomes visible
            setTimeout(() => {
              const messageElement = document.querySelector(`[data-msg-id="${newMessage.id}"]`);
              if (messageElement) {
                const rect = messageElement.getBoundingClientRect();
                const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
                
                if (isVisible && activeChannel) {
                  options.addToReadBuffer(newMessage.id);
                  callbacks.onMarkMessageAsRead(newMessage.id);
                }
              }
            }, 100);
          } else {
            // User is slightly scrolled up - auto-scroll and mark as read
            options.addToReadBuffer(newMessage.id);
            callbacks.onMarkMessageAsRead(newMessage.id);
            
            if (options.loadingMode !== 'around' && !options.isJumpingToMessage) {
              callbacks.onScrollToBottom();
            }
            
            if (activeChannel) {
              webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
              callbacks.onMarkAllAsRead();
            }
          }
        }
      }
    } else if (data.type === 'MESSAGE_UPDATE' && data.message) {
      const updatedMessage = options.convertToExtendedMessage(data.message);
      callbacks.onMessageUpdate(updatedMessage);
      
      // Update unread status if message status changed to read
      if (updatedMessage.status === MessageStatus.READ) {
        callbacks.onUnreadCountChange(-1);
      }
    } else if (data.type === 'MESSAGE_DELETE' && data.messageId) {
      callbacks.onMessageDelete(data.messageId);
      callbacks.onUnreadCountChange(-1);
    } else if (data.type === 'MESSAGE_READ_STATUS' && data.message_range) {
      // Handle message read status updates
      callbacks.onMessageReadStatus(data.message_range);
    }
  }, [
    user?.id,
    activeChannel,
    options.convertToExtendedMessage,
    options.isJumpingToMessage,
    options.loadingMode,
    options.messagesContainerRef,
    options.addToReadBuffer,
    callbacks.onMessageCreate,
    callbacks.onMessageUpdate,
    callbacks.onMessageDelete,
    callbacks.onMessageReadStatus,
    callbacks.onHighlightMessage,
    callbacks.onUnreadMessage,
    callbacks.onMarkMessageAsRead,
    callbacks.onNewMessageIndicator,
    callbacks.onScrollToBottom,
    callbacks.onMarkAllAsRead,
    callbacks.onUnreadCountChange
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