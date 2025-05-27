import { useRef, useEffect, useCallback } from 'react';
import { webSocketService } from '@/websocket/WebSocketService';

interface UseMessageReadStatusProps {
  activeChannel: { id: number } | null;
  user: { id: number } | null;
}

interface UseMessageReadStatusReturn {
  unreadMessagesBufferRef: React.RefObject<Set<number>>;
  markMessageAsRead: (messageId: number) => void;
  markAllMessagesAsRead: () => void;
  addToReadBuffer: (messageId: number) => void;
}

export const useMessageReadStatus = ({
  activeChannel,
  user
}: UseMessageReadStatusProps): UseMessageReadStatusReturn => {
  const unreadMessagesBufferRef = useRef<Set<number>>(new Set());

  // Function to add message to read buffer
  const addToReadBuffer = useCallback((messageId: number) => {
    unreadMessagesBufferRef.current.add(messageId);
  }, []);

  // Function to mark a single message as read
  const markMessageAsRead = useCallback((messageId: number) => {
    if (!activeChannel) return;
    
    // Add to buffer for debounced sending
    unreadMessagesBufferRef.current.add(messageId);
  }, [activeChannel]);

  // Function to mark all messages as read
  const markAllMessagesAsRead = useCallback(() => {
    if (!activeChannel) return;
    
    // Send bulk-read-all request
    webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
  }, [activeChannel]);

  // Setup debounced sending of unread messages
  useEffect(() => {
    if (!activeChannel) return;

    // Function to send buffered unread messages
    const sendBufferedUnreadMessages = () => {
      if (unreadMessagesBufferRef.current.size > 0) {
        const messageIds = Array.from(unreadMessagesBufferRef.current);
        webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read`, { messageIds });
        unreadMessagesBufferRef.current.clear();
      }
    };

    // Set up interval to send buffered messages every second
    const intervalId = setInterval(sendBufferedUnreadMessages, 1000);

    return () => {
      clearInterval(intervalId);
      // Send any remaining buffered messages on cleanup
      sendBufferedUnreadMessages();
    };
  }, [activeChannel]);

  return {
    unreadMessagesBufferRef,
    markMessageAsRead,
    markAllMessagesAsRead,
    addToReadBuffer
  };
};