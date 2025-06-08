import { useState, useCallback, useRef, useEffect } from 'react';
import { ExtendedMessage } from '../types/message';

interface UseNewMessageHighlightOptions {
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  isScrolledToBottom: boolean;
  user: { id: number };
}

export const useNewMessageHighlight = ({
  messagesContainerRef,
  isScrolledToBottom,
  user
}: UseNewMessageHighlightOptions) => {
  // Сообщения, которые пришли когда пользователь не был внизу
  const [newMessagesWhileScrolledUp, setNewMessagesWhileScrolledUp] = useState<Set<number>>(new Set());
  // Сообщения, которые нужно подсветить в viewport
  const [highlightedNewMessages, setHighlightedNewMessages] = useState<Set<number>>(new Set());
  // Первое непрочитанное сообщение для разделителя
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<number | null>(null);
  // Показывать ли разделитель "новые сообщения"
  const [showUnreadSeparator, setShowUnreadSeparator] = useState(false);
  
  const highlightTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const separatorTimeout = useRef<NodeJS.Timeout | null>(null);

  // Функция для добавления нового сообщения в трекинг
  const trackNewMessage = useCallback((message: ExtendedMessage) => {
    // Только для сообщений от других пользователей
    if (message.author.id === user.id) return;
    
    // Если пользователь не внизу, трекаем это сообщение как новое
    if (!isScrolledToBottom) {
      setNewMessagesWhileScrolledUp(prev => new Set([...prev, message.id]));
      
      // Устанавливаем первое непрочитанное сообщение если его еще нет
      setFirstUnreadMessageId(prev => {
        if (prev === null) {
          setShowUnreadSeparator(true);
          
          // Убираем разделитель через 3 секунды
          if (separatorTimeout.current) {
            clearTimeout(separatorTimeout.current);
          }
          separatorTimeout.current = setTimeout(() => {
            setShowUnreadSeparator(false);
          }, 3000);
          
          return message.id;
        }
        return prev;
      });
    }
  }, [isScrolledToBottom, user.id]);

  // Функция для проверки сообщений в viewport
  const checkMessagesInViewport = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || newMessagesWhileScrolledUp.size === 0) return;

    const containerRect = container.getBoundingClientRect();
    const newHighlighted = new Set<number>();

    // Проверяем каждое новое сообщение
    newMessagesWhileScrolledUp.forEach(messageId => {
      const messageElement = container.querySelector(`[data-msg-id="${messageId}"]`);
      if (messageElement) {
        const messageRect = messageElement.getBoundingClientRect();
        
        // Проверяем, находится ли сообщение в viewport
        const isInViewport = 
          messageRect.top < containerRect.bottom && 
          messageRect.bottom > containerRect.top;
        
        if (isInViewport) {
          newHighlighted.add(messageId);
          
          // Устанавливаем таймаут для удаления подсветки
          const existingTimeout = highlightTimeouts.current.get(messageId);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }
          
          const timeout = setTimeout(() => {
            setHighlightedNewMessages(prev => {
              const newSet = new Set(prev);
              newSet.delete(messageId);
              return newSet;
            });
            highlightTimeouts.current.delete(messageId);
          }, 2000); // Подсветка держится 2 секунды
          
          highlightTimeouts.current.set(messageId, timeout);
        }
      }
    });

    if (newHighlighted.size > 0) {
      setHighlightedNewMessages(prev => new Set([...prev, ...newHighlighted]));
    }
  }, [messagesContainerRef, newMessagesWhileScrolledUp]);

  // Очистка при скролле в низ
  const clearNewMessages = useCallback(() => {
    setNewMessagesWhileScrolledUp(new Set());
    setHighlightedNewMessages(new Set());
    setFirstUnreadMessageId(null);
    setShowUnreadSeparator(false);
    
    // Очищаем все таймауты
    highlightTimeouts.current.forEach(timeout => clearTimeout(timeout));
    highlightTimeouts.current.clear();
    
    if (separatorTimeout.current) {
      clearTimeout(separatorTimeout.current);
      separatorTimeout.current = null;
    }
  }, []);

  // Автоматическая очистка при скролле в низ
  useEffect(() => {
    if (isScrolledToBottom) {
      clearNewMessages();
    }
  }, [isScrolledToBottom, clearNewMessages]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      highlightTimeouts.current.forEach(timeout => clearTimeout(timeout));
      if (separatorTimeout.current) {
        clearTimeout(separatorTimeout.current);
      }
    };
  }, []);

  return {
    trackNewMessage,
    checkMessagesInViewport,
    clearNewMessages,
    highlightedNewMessages,
    firstUnreadMessageId,
    showUnreadSeparator,
    newMessagesWhileScrolledUp
  };
};