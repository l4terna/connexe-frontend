import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, IconButton, Paper, Stack, Typography, Fade, Skeleton, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ReplyIcon from '@mui/icons-material/Reply';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Channel, Message, ChannelType, useGetMessagesQuery, useCreateMessageMutation, useUpdateMessageMutation, useDeleteMessageMutation } from '../../../api/channels';
import UserAvatar from '../../UserAvatar';
import Input from '../../common/Input';
import AppModal from '../../AppModal';
import DOMPurify from 'dompurify';
import { useNotification } from '@/context/NotificationContext';
import { hasPermission } from '@/utils/rolePermissions';
import { useWebSocket } from '@/websocket/useWebSocket';
import { webSocketService } from '@/websocket/WebSocketService';
import { useAppSelector } from '@/hooks/redux';
import VirtualizedChatArea from './VirtualizedChatArea';

enum MessageStatus {
  SENT = 0,
  READ = 1,
  NEW = 2
}

interface ExtendedMessage extends Message {
  status: MessageStatus;
  channel_id?: number; // Добавляем channel_id для проверки канала
  reply_to?: Message; // Добавляем поддержку ответов на сообщения
}

const formatMessageTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

const formatDateForGroup = (timestamp: string) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  const isCurrentYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(isCurrentYear ? {} : { year: 'numeric' })
  });
};

const isWithinTimeThreshold = (timestamp1: string, timestamp2: string, thresholdMinutes: number = 30) => {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  const diffInMinutes = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
  return diffInMinutes <= thresholdMinutes;
};

interface MainChatAreaProps {
  activeChannel: Channel | null;
  user: { id: number; login: string; avatar: string | null } | null;
  hubId: number;
  userPermissions: string[];
  isOwner: boolean;
}

// Update validation schema to remove the required message
const messageSchema = Yup.object().shape({
  content: Yup.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message is too long')
});


const MainChatArea: React.FC<MainChatAreaProps> = ({ activeChannel, user, hubId, userPermissions, isOwner }) => {
  const authToken = useAppSelector(state => state.auth.token);
  
  // Early return if user is null
  if (!user) {
    return null;
  }
  const [sending] = useState(false);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<ExtendedMessage | null>(null);
  const [currentDateLabel, setCurrentDateLabel] = useState<string | null>(null);
  const [showDateLabel, setShowDateLabel] = useState(false);
  const [beforeId, setBeforeId] = useState<number | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [tempMessages, setTempMessages] = useState<Map<string, ExtendedMessage>>(new Map());
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [highlightedMessages, setHighlightedMessages] = useState<Set<number>>(new Set());
  const [focusedMessageId, setFocusedMessageId] = useState<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<{id: number; login: string; avatar: string | null}[]>([]);
  const [showTypingUsersModal, setShowTypingUsersModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const virtualizedChatRef = useRef<any>(null);
  const dateLabelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingMoreRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const messagesLengthRef = useRef(0);
  // const [page, setPage] = useState(1);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  // const [readMessages, setReadMessages] = useState<Set<number>>(new Set());
  const readMessagesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibleMessagesRef = useRef<Set<number>>(new Set());
  const unreadMessagesBufferRef = useRef<Set<number>>(new Set());

  const MESSAGES_PER_PAGE = 40;

  const { data: messagesData = [], isLoading } = useGetMessagesQuery(
    activeChannel?.type === ChannelType.TEXT ? {
      channelId: activeChannel?.id ?? 0,
      params: {
        size: MESSAGES_PER_PAGE,
        before: beforeId || undefined
      }
    } : { channelId: 0, params: {} },
    { 
      skip: !activeChannel || activeChannel.type !== ChannelType.TEXT,
      refetchOnMountOrArgChange: true // Add this to force refresh on channel change
    }
  );

  const [createMessage] = useCreateMessageMutation();
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const { notify } = useNotification();

  const canSendMessages = hasPermission(userPermissions, 'SEND_MESSAGES', isOwner);

  // Функция для отписки от WebSocket топиков канала
  // const unsubscribeFromChannelTopics = useCallback((channel: Channel | null, userId: number | null, callback: (message: any) => void) => {
  //   if (!channel) return;
    
  //   console.log(`Unsubscribing from all topics for channel ${channel.id}`);
    
  //   // Отписка от персональной очереди пользователя
  //   if (userId) {
  //     const userQueueTopic = `/v1/user/${userId}/queue/channels/${channel.id}/messages`;
  //     webSocketService.unsubscribe(userQueueTopic, callback);
  //   }
    
  //   // Отписка от общего топика канала
  //   const channelTopic = `/v1/topic/channels/${channel.id}/messages`;
  //   webSocketService.unsubscribe(channelTopic, callback);
  // }, []);
  
  // Reset state when channel changes
  useEffect(() => {
    // Cleanup function for previous channel
    return () => {
      // Отписываемся от всех подписок предыдущего канала
      if (activeChannel && user) {
        // Используем функцию отписки, но без handleNewMessage, так как он еще не определен
        // Вместо этого просто отписываемся от топиков через WebSocketService
        if (user.id && activeChannel.id) {
          const userQueueTopic = `/v1/user/${user.id}/queue/channels/${activeChannel.id}/messages`;
          const channelTopic = `/v1/topic/channels/${activeChannel.id}/messages`;
          
          // Отписываемся напрямую через WebSocketService
          webSocketService.unsubscribe(userQueueTopic, () => {});
          webSocketService.unsubscribe(channelTopic, () => {});
        }
      }
    };
  }, [activeChannel?.id, user.id]);
  
  // Флаг для отслеживания текущего статуса печати
  const isTypingRef = useRef(false);
  // Таймер для обнаружения паузы в печати
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Таймер для периодической отправки статуса STARTED
  const typingRefreshRef = useRef<NodeJS.Timeout | null>(null);
  
  // Функция для отправки статуса печати
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!activeChannel || !user) return;
    
    if (isTyping) {
      // Если уже отправлен статус "печатает", просто обновляем таймер паузы
      if (!isTypingRef.current) {
        // Отправляем статус "начал печатать"
        webSocketService.publish(`/app/v1/channels/${activeChannel.id}/typing`, {
          typing_status: 0 // STARTED
        });
        isTypingRef.current = true;
        
        // Устанавливаем интервал для периодической отправки STARTED каждые 4 секунды
        // Этот интервал создается только один раз при начале печати
        typingRefreshRef.current = setInterval(() => {
          webSocketService.publish(`/app/v1/channels/${activeChannel.id}/typing`, {
            typing_status: 0 // STARTED
          });
        }, 4000);
      }
      
      // Очищаем таймер паузы если он был (но не интервал!)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Устанавливаем таймер на 2 секунды для определения паузы
      typingTimeoutRef.current = setTimeout(() => {
        // Если сработал таймер, значит 2 секунды не было изменений в поле
        webSocketService.publish(`/app/v1/channels/${activeChannel.id}/typing`, {
          typing_status: 1 // STOPPED
        });
        isTypingRef.current = false;
        typingTimeoutRef.current = null;
        
        // Очищаем интервал периодической отправки
        if (typingRefreshRef.current) {
          clearInterval(typingRefreshRef.current);
          typingRefreshRef.current = null;
        }
      }, 2000);
    } else {
      // Остановка печати (поле стало пустым или отправлено сообщение)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      if (typingRefreshRef.current) {
        clearInterval(typingRefreshRef.current);
        typingRefreshRef.current = null;
      }
      
      if (isTypingRef.current) {
        webSocketService.publish(`/app/v1/channels/${activeChannel.id}/typing`, {
          typing_status: 1 // STOPPED
        });
        isTypingRef.current = false;
      }
    }
  }, [activeChannel, user]);
  
  // Получение печатающих пользователей для канала
  const fetchTypingUsers = useCallback(async (channelId: number) => {
    console.log('Fetching typing users for channel:', channelId);
    try {
      if (!authToken) {
        console.error('No JWT token found');
        return;
      }
      
      const response = await fetch(`/api/v1/channels/${channelId}/typing-users`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const typingUsersList = await response.json();
        console.log('Received typing users:', typingUsersList);
        const realUsers = typingUsersList.filter((u: {id: number}) => u.id !== user.id);
        
        setTypingUsers(realUsers);
      } else {
        console.error('Failed to fetch typing users:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch typing users:', error);
    }
  }, [user.id, authToken]);

  // Инициализация при входе в новый канал и отписка при выходе
  useEffect(() => {
    // Store previous channel ID for cleanup
    let previousChannelId: number | null = null;
    
    if (!activeChannel) {
      return;
    }
    
    console.log(`Entering channel ${activeChannel.id}`);
    
    // Reset all states when channel changes
    setMessages([]);
    setHasMoreMessages(true);
    setBeforeId(null);
    setEditingMessageId(null);
    setCurrentDateLabel(null);
    setShowDateLabel(false);
    setShowScrollButton(false);
    setTempMessages(new Map());
    // setPage(1);
    setIsScrolledToBottom(true);
    isLoadingMoreRef.current = false;
    // setReadMessages(new Set());
    setTypingUsers([]); // Сбрасываем список печатающих пользователей
    
    // Очищаем все таймеры и состояние печати
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (typingRefreshRef.current) {
      clearInterval(typingRefreshRef.current);
      typingRefreshRef.current = null;
    }
    
    // Сбрасываем флаг печати
    isTypingRef.current = false;
    
    // Mark all messages as read when entering a channel
    webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
    
    // Получаем список печатающих пользователей при входе в канал
    fetchTypingUsers(activeChannel.id);
    
    previousChannelId = activeChannel.id;
    
    // Clean up function - runs when leaving the channel
    return () => {
      if (previousChannelId) {
        console.log(`Leaving channel ${previousChannelId}`);
        
        // Unsubscribe from all WebSocket topics for this channel
        webSocketService.unsubscribeFromChannel(previousChannelId);
        
        // Clear any typing status
        if (isTypingRef.current) {
          webSocketService.publish(`/app/v1/channels/${previousChannelId}/typing`, {
            typing_status: 1 // STOPPED
          });
          isTypingRef.current = false;
        }
        
        // Clear all timers
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        if (typingRefreshRef.current) {
          clearInterval(typingRefreshRef.current);
          typingRefreshRef.current = null;
        }
        
        // Clear typing users
        setTypingUsers([]);
      }
    };
  }, [activeChannel?.id, fetchTypingUsers]); // Using id instead of the full object

  // Simple function to scroll to bottom without marking messages as read
  const scrollToBottom = useCallback(() => {
    if (virtualizedChatRef.current) {
      virtualizedChatRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  // Function to scroll to bottom and mark all messages as read
  const handleScrollToBottom = useCallback(() => {
    // First, highlight unread messages before marking them as read
    const unreadMessageIds = new Set<number>();
    messages.forEach(msg => {
      if (msg.author.id !== user.id && msg.status === MessageStatus.NEW) {
        unreadMessageIds.add(msg.id);
      }
    });
    
    // Add all unread messages to highlighted set
    if (unreadMessageIds.size > 0) {
      setHighlightedMessages(prev => new Set([...prev, ...unreadMessageIds]));
      
      // Remove highlight after 1.5 seconds
      setTimeout(() => {
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          unreadMessageIds.forEach(id => newSet.delete(id));
          return newSet;
        });
      }, 1500);
    }
    
    // Scroll to bottom
    scrollToBottom();
    
    // Send bulk-read-all request when scrolling to bottom
    if (activeChannel) {
      webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
      // Update all messages to READ status
      setMessages(prev => prev.map(msg => (
        msg.author.id !== user?.id 
          ? { ...msg, status: MessageStatus.READ }
          : msg
      )));
    }

    // Update local state
    setUnreadMessages(new Set());
    setUnreadCount(0);
    setHasNewMessage(false);
  }, [activeChannel, user?.id, scrollToBottom, messages]);

  // Helper function to convert Message to ExtendedMessage
  const convertToExtendedMessage = useCallback((message: Message): ExtendedMessage => {
    return {
      ...message,
      status: 'status' in message ? (message as any).status : MessageStatus.SENT // Use existing status or default to SENT
    };
  }, []);

  // Handle initial messages load
  useEffect(() => {
    if (!activeChannel || activeChannel.type !== ChannelType.TEXT) return;
    
    // Set empty messages array when data is empty
    if (!messagesData || messagesData.length === 0) {
      setMessages([]);
      setUnreadMessages(new Set());
      setUnreadCount(0);
      setHasNewMessage(false);
      return;
    }
    
    // Only set messages on initial load (when beforeId is null)
    if (beforeId === null) {
      const extendedMessages = messagesData.map(convertToExtendedMessage);
      setMessages(extendedMessages);
      messagesLengthRef.current = messagesData.length;
      
      // Check for unread messages in initial load (only from other users)
      const unreadMessagesFromOthers = extendedMessages.filter(
        msg => msg.author.id !== user?.id && msg.status === MessageStatus.NEW
      );
      
      if (unreadMessagesFromOthers.length > 0) {
        setUnreadMessages(new Set(unreadMessagesFromOthers.map(msg => msg.id)));
        setUnreadCount(unreadMessagesFromOthers.length);
      } else {
        setUnreadMessages(new Set());
        setUnreadCount(0);
        setHasNewMessage(false);
      }
      
      // Scroll to bottom after loading initial messages with multiple attempts
      const scrollToBottomWithRetry = (attempts = 0) => {
        if (attempts > 3) {
          console.warn('Failed to scroll to bottom after 3 attempts');
          return;
        }
        
        setTimeout(() => {
          if (messagesContainerRef.current) {
            const container = messagesContainerRef.current;
            const scrollBefore = container.scrollTop;
            container.scrollTop = container.scrollHeight;
            
            console.log('Scroll attempt', attempts + 1, {
              scrollHeight: container.scrollHeight,
              clientHeight: container.clientHeight,
              scrollTop: container.scrollTop,
              scrollBefore,
              messagesCount: extendedMessages.length
            });
            
            // Check if scroll was successful
            if (container.scrollTop + container.clientHeight < container.scrollHeight - 50) {
              // If not at bottom, retry
              scrollToBottomWithRetry(attempts + 1);
            }
          }
        }, 50 * (attempts + 1)); // Increasing delay with each attempt
      };
      
      scrollToBottomWithRetry();
    }
  }, [activeChannel, messagesData, beforeId, convertToExtendedMessage, user?.id]);

  // Add effect to ensure scrolling when messages update
  useEffect(() => {
    if (messagesContainerRef.current && isScrolledToBottom) {
      const container = messagesContainerRef.current;
      const shouldScroll = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      if (shouldScroll) {
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        });
      }
    }
  }, [messages.length, isScrolledToBottom]);

  // Add effect to focus input when chat is opened
  useEffect(() => {
    if (activeChannel && inputRef.current) {
      inputRef.current.focus();
      // Place cursor at the end
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [activeChannel]);

  // Add effect to focus edit input when editing starts
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
      // Place cursor at the end
      const length = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(length, length);
    }
  }, [editingMessageId]);

  // Focus input helper function
  const focusMessageInput = useCallback(() => {
    // Clear any active element focus first
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Use RAF for better timing with DOM updates
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(0, 0);
      }
    });
  }, []);

  const handleSendMessage = useCallback(async (values: { content: string }, { resetForm }: { resetForm: () => void }) => {
    if (!activeChannel || !user) return;

    const content = values.content.trim();
    if (!content) return;

    // Clear the input field immediately
    resetForm();
    
    // Отправляем статус прекращения печати
    sendTypingStatus(false);
    
    try {
      const tempId = Date.now();
      const tempMessage: ExtendedMessage = {
        id: -1, // Temporary ID
        content: values.content,
        author: user,
        created_at: new Date().toISOString(),
        last_modified_at: undefined,
        attachments: [], // Required by Message interface
        status: MessageStatus.SENT,
        read_by_count: 0,
        channel_id: activeChannel.id, // Добавляем для проверки канала
        reply_to: replyingToMessage || undefined // Преобразуем null в undefined
      };
      
      // Add temporary message to the UI
      setTempMessages(prev => {
        const newMap = new Map(prev);
        newMap.set(String(tempId), tempMessage);
        return newMap;
      });
      
      // Scroll to bottom immediately after adding the temporary message
      setTimeout(() => {
        scrollToBottom();
      }, 10);
      
      resetForm();
      
      // Clear the reply state after sending
      setReplyingToMessage(null);
      
      // Send the message to the server
      const result = await createMessage({
        channelId: activeChannel.id,
        content: values.content,
        // Add replyToId if supported by your API
        ...(replyingToMessage?.id ? { replyToId: replyingToMessage.id } : {})
      }).unwrap();
      
      // Remove the temporary message once we get confirmation
      setTempMessages(prev => {
        const newMap = new Map(prev);
        newMap.delete(String(tempId));
        return newMap;
      });
      
      // Add the real message with server-generated ID
      // Create a properly typed ExtendedMessage from the API result
      const newMessage: ExtendedMessage = {
        ...result,
        status: MessageStatus.SENT,
        channel_id: activeChannel.id, // Добавляем для проверки канала
        reply_to: replyingToMessage || undefined // Преобразуем null в undefined
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      // No need to scroll again here as we already scrolled after adding the temporary message
    } catch (error) {
      console.error('Failed to send message:', error);
      // Type guard for error object
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403 && 'data' in error && typeof error.data === 'object' && error.data !== null && 'type' in error.data && error.data.type === 'ACCESS_DENIED') {
        notify('Недостаточно прав для отправки сообщения', 'error');
      } else {
        notify('Ошибка при отправке сообщения', 'error');
        console.error('Failed to send message:', error);
      }
    }
  }, [activeChannel, user, createMessage, focusMessageInput, notify, sendTypingStatus, replyingToMessage]);

  const handleEditMessage = useCallback(async (values: { content: string }, { resetForm }: { resetForm: () => void }) => {
    if (!editingMessageId || !activeChannel) return;

    const content = values.content.trim();
    if (!content) return;

    // Find the original message
    const originalMessage = messages.find(msg => msg.id === editingMessageId);
    if (!originalMessage) return;

    // Check if content has actually changed
    if (content === originalMessage.content) {
      setEditingMessageId(null);
      resetForm();
      focusMessageInput();
      return;
    }

    // Создаем обновленную версию сообщения для оптимистичного обновления
    const optimisticMessage: ExtendedMessage = {
      ...originalMessage,
      content: content,
      last_modified_at: new Date().toISOString()
    };
    
    // Сразу обновляем UI с оптимистичным обновлением
    setMessages(prev => prev.map(msg => 
      msg.id === editingMessageId ? optimisticMessage : msg
    ));
    
    // Закрываем форму редактирования
    setEditingMessageId(null);
    resetForm();
    focusMessageInput();
    
    try {
      // Отправляем запрос на сервер
      const updatedMessage = await updateMessage({
        channelId: activeChannel.id,
        messageId: editingMessageId,
        content
      }).unwrap();
      
      // Обновляем сообщение с данными от сервера
      setMessages(prev => prev.map(msg => 
        msg.id === editingMessageId ? convertToExtendedMessage(updatedMessage) : msg
      ));
      
    } catch (error) {
      console.error('Failed to edit message:', error);
      
      // Возвращаем оригинальное сообщение в случае ошибки
      setMessages(prev => prev.map(msg => 
        msg.id === editingMessageId ? originalMessage : msg
      ));
      
      // Показываем уведомление об ошибке
      notify('Ошибка при обновлении сообщения', 'error');
    }
  }, [editingMessageId, activeChannel, updateMessage, focusMessageInput, messages, notify]);

  const handleDeleteMessage = useCallback(async (messageId: number) => {
    if (!activeChannel) return;
    
    // Находим сообщение, которое будем удалять
    const messageToDelete = messages.find(msg => msg.id === messageId);
    if (!messageToDelete) return;
    
    // Оптимистично удаляем сообщение из UI
    setMessages(prev => prev.filter(m => m.id !== messageId));
    
    try {
      // Отправляем запрос на удаление на сервер
      await deleteMessage({
        channelId: activeChannel.id,
        messageId,
      }).unwrap();
      
      // Если успешно, ничего дополнительно не делаем, т.к. уже удалили сообщение из UI
      
    } catch (error) {
      console.error('Ошибка при удалении сообщения', error);
      
      // Возвращаем сообщение обратно в список в случае ошибки
      setMessages(prev => {
        // Проверяем, что сообщение еще не было добавлено обратно
        if (!prev.some(m => m.id === messageId)) {
          // Находим правильную позицию для вставки сообщения
          const messages = [...prev];
          const index = messages.findIndex(m => new Date(m.created_at) > new Date(messageToDelete.created_at));
          
          if (index === -1) {
            // Если это самое новое сообщение, добавляем в конец
            return [...messages, messageToDelete];
          } else {
            // Вставляем сообщение в нужную позицию
            messages.splice(index, 0, messageToDelete);
            return messages;
          }
        }
        return prev;
      });
      
      // Показываем уведомление об ошибке
      notify('Ошибка при удалении сообщения', 'error');
    }
  }, [activeChannel, deleteMessage, messages, notify]);

  // Handle scroll and date label display
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Clear any existing timeout
      if (dateLabelTimeoutRef.current) {
        clearTimeout(dateLabelTimeoutRef.current);
      }

      // Check if we should show scroll button
      setShowScrollButton(container.scrollTop + container.clientHeight < container.scrollHeight - 400);
      if (container.scrollTop < container.scrollHeight / 2 && !isLoadingMoreRef.current && hasMoreMessages && messagesData.length > 0) {
        // Only load more if the previous response had exactly MESSAGES_PER_PAGE messages
        if (messagesData.length === MESSAGES_PER_PAGE) {
          isLoadingMoreRef.current = true;
          // Get the ID of the oldest message in the current view
          const oldestMessage = messagesData[messagesData.length - 1];
          if (oldestMessage) {
            setBeforeId(oldestMessage.id);
          }
        } else {
          // If we got less than MESSAGES_PER_PAGE messages, we've reached the end
          setHasMoreMessages(false);
        }
      }
      
      // Check for unread messages in the viewport to highlight them and find date label
      const visibleElements = container.querySelectorAll('.message-item');
      if (!visibleElements.length) return;
      
      let visibleDate: string | null = null;
      let firstVisibleElement: Element | null = null;
      
      // Process visible elements
      visibleElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const isVisible = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
        
        if (isVisible) {
          // Find first visible element for date label
          if (!firstVisibleElement) {
            firstVisibleElement = element;
            const dateAttr = element.getAttribute('data-date');
            if (dateAttr) {
              visibleDate = formatDateForGroup(dateAttr);
            }
          }
          
          // Highlight unread messages (but only for messages from other users)
          const messageId = parseInt(element.getAttribute('data-msg-id') || '0', 10);
          if (messageId) {
            const message = messages.find(m => m.id === messageId);
            // Only highlight messages from other users that are NEW
            if (message && message.author.id !== user?.id && message.status === MessageStatus.NEW) {
              // Add to highlighted set for visual effect
              setHighlightedMessages(prev => {
                const newSet = new Set(prev);
                newSet.add(messageId);
                return newSet;
              });
              
              // Remove highlight after 1.5 seconds
              setTimeout(() => {
                setHighlightedMessages(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(messageId);
                  return newSet;
                });
              }, 1500);
            }
          }
        }
      });

      if (visibleDate) {
        setCurrentDateLabel(visibleDate);
        setShowDateLabel(true);
        
        // Hide the date label after 1 second
        dateLabelTimeoutRef.current = setTimeout(() => {
          setShowDateLabel(false);
        }, 1000);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (dateLabelTimeoutRef.current) {
        clearTimeout(dateLabelTimeoutRef.current);
      }
    };
    // Removed messages from dependencies to avoid infinite loops
  }, [messagesData, hasMoreMessages, activeChannel?.id]);

  // Handle loading more messages
  useEffect(() => {
    if (messagesData && messagesData.length > 0 && beforeId !== null) {
      const container = messagesContainerRef.current;
      if (!container) return;
  
      // Save the first visible element before the update
      const allMessages = container.querySelectorAll('.message-item');
      let firstVisibleElement = null;
      let offsetFromTop = 0;
      
      // Find the first element that's at least partially visible
      for (const element of allMessages) {
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
          firstVisibleElement = element;
          offsetFromTop = rect.top - containerRect.top;
          break;
        }
      }
      
      const firstVisibleMessageId = firstVisibleElement?.getAttribute('data-msg-id');
      
      // Check if we received less messages than requested
      if (messagesData.length < MESSAGES_PER_PAGE) {
        setHasMoreMessages(false);
      }
      
      // Disable scrolling temporarily
      const currentScrollBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = 'auto';
      
      // Create a promise to handle DOM updates
      const updatePromise = new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          observer.disconnect();
          resolve();
        });
        
        observer.observe(container, {
          childList: true,
          subtree: true
        });
        
        // Update the messages
        setMessages((prev: ExtendedMessage[]) => {
          // Create a map of existing messages for quick lookup
          const existingMessagesMap = new Map(prev.map(msg => [msg.id, msg]));
          
          // Add new messages that don't exist yet
          messagesData.forEach(newMsg => {
            if (!existingMessagesMap.has(newMsg.id)) {
              // Convert Message to ExtendedMessage by adding the required status property
              existingMessagesMap.set(newMsg.id, {
                ...newMsg,
                status: 'status' in newMsg ? (newMsg as any).status : 
                        (newMsg.author.id === user?.id ? MessageStatus.SENT : MessageStatus.NEW)
              });
            }
          });
    
          // Convert map back to array and sort by creation date
          return Array.from(existingMessagesMap.values())
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      });
      
      // Wait for DOM to update then restore scroll position
      updatePromise.then(() => {
        // Use setTimeout to ensure all layout calculations are complete
        setTimeout(() => {
          if (firstVisibleMessageId) {
            const sameMessage = container.querySelector(`[data-msg-id="${firstVisibleMessageId}"]`);
            if (sameMessage) {
              const rect = sameMessage.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const newOffsetFromTop = rect.top - containerRect.top;
              const scrollAdjustment = newOffsetFromTop - offsetFromTop;
              
              // Apply the scroll adjustment with overflow hidden temporarily
              container.style.overflow = 'hidden';
              container.scrollTop += scrollAdjustment;
              
              // Force a reflow
              void container.offsetHeight;
              
              // Restore overflow
              container.style.overflow = 'auto';
            }
          }
          
          // Restore scroll behavior
          container.style.scrollBehavior = currentScrollBehavior;
          isLoadingMoreRef.current = false;
        }, 0);
      });
    }
  }, [messagesData, beforeId]);

  // Sort messages to display oldest first (for column layout)
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages]);

  // Add effect to track scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
      const isAtBottom = scrollPosition < 100;
      setIsScrolledToBottom(isAtBottom);
      
      // Log scroll position for debugging
      console.log('Scroll position:', {
        isAtBottom,
        scrollPosition,
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight
      });
      
      // If scrolled to bottom, mark all messages as read
      if (isAtBottom && activeChannel) {
        // Send bulk-read-all request when scrolling to bottom
        webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
        
        // Update all messages to READ status
        setMessages(prev => prev.map(msg => (
          msg.author.id !== user?.id 
            ? { ...msg, status: MessageStatus.READ }
            : msg
        )));
        
        // Clear all unread indicators
        setUnreadMessages(new Set());
        setUnreadCount(0);
        setHasNewMessage(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNewMessage = useCallback((data: { 
    type: 'MESSAGE_CREATE' | 'MESSAGE_UPDATE' | 'MESSAGE_DELETE' | 'MESSAGE_READ_STATUS';
    message?: Message;
    messageId?: number;
    channelId?: number;
    message_range?: { from: number; to: number };
  }) => {
    if (data.type === 'MESSAGE_CREATE' && data.message) {
      const newMessage = convertToExtendedMessage(data.message);
      
      // Skip processing if the message is from the current user
      if (newMessage.author.id === user?.id) {
        return;
      }
      
      setMessages(prevMessages => {
        // Check if message already exists
        const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
        if (messageExists) return prevMessages;

        // Add new message
        return [...prevMessages, newMessage];
      });
      
      // Add message to highlighted set for temporary visual effect
      setHighlightedMessages(prev => {
        const newSet = new Set(prev);
        newSet.add(newMessage.id);
        return newSet;
      });
      
      // Remove highlight after 1.5 seconds
      setTimeout(() => {
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(newMessage.id);
          return newSet;
        });
      }, 1500);
      
      // Only process if message is from another user
      if (newMessage.author.id !== user?.id) {
        const container = messagesContainerRef.current;
        if (container) {
          const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
          const isAtBottom = scrollPosition < 100;
          
          console.log('New message received:', {
            isAtBottom,
            scrollPosition,
            messageId: newMessage.id,
            status: newMessage.status
          });

          if (isAtBottom) {
            // User is at bottom - immediately mark as read
            setMessages(prev => prev.map(msg => 
              msg.id === newMessage.id
                ? { ...msg, status: MessageStatus.READ }
                : msg
            ));
            
            // Add to buffer for marking as read on server
            unreadMessagesBufferRef.current.add(newMessage.id);
            
            // Auto-scroll to keep at bottom
            requestAnimationFrame(() => {
              if (container) {
                container.scrollTop = container.scrollHeight;
              }
            });
          } else {
            // User is scrolled up - add to unread messages
            setHasNewMessage(true);
            setUnreadMessages(prev => {
              const newSet = new Set(prev);
              newSet.add(newMessage.id);
              return newSet;
            });
            setUnreadCount(prev => {
              const newCount = prev + 1;
              
              // Check if the message is visible despite being scrolled up
              setTimeout(() => {
                const messageElement = document.querySelector(`[data-msg-id="${newMessage.id}"]`);
                if (messageElement && container) {
                  const rect = messageElement.getBoundingClientRect();
                  const containerRect = container.getBoundingClientRect();
                  const isVisible = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
                  
                  if (isVisible) {
                    // If visible, mark as read and update counters
                    unreadMessagesBufferRef.current.add(newMessage.id);
                    
                    setMessages(prev => prev.map(msg => 
                      msg.id === newMessage.id
                        ? { ...msg, status: MessageStatus.READ }
                        : msg
                    ));
                    
                    setUnreadMessages(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(newMessage.id);
                      return newSet;
                    });
                    
                    setUnreadCount(prev => {
                      const updatedCount = Math.max(0, prev - 1);
                      // If this was the last unread message, hide the indicator
                      if (updatedCount === 0) {
                        setHasNewMessage(false);
                      }
                      return updatedCount;
                    });
                  }
                }
              }, 100);
              
              return newCount;
            });
          }
        }
      }
    } else if (data.type === 'MESSAGE_UPDATE' && data.message) {
      const updatedMessage = convertToExtendedMessage(data.message);
      
      setMessages(prevMessages => {
        // Check if message exists in our list
        const messageExists = prevMessages.some(msg => msg.id === updatedMessage.id);
        if (!messageExists) return prevMessages;

        // Update the message
        return prevMessages.map(msg => 
          msg.id === updatedMessage.id ? updatedMessage : msg
        );
      });

      // Update unread status if message status changed
      if (updatedMessage.status === MessageStatus.READ) {
        setUnreadMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(updatedMessage.id);
          return newSet;
        });
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } else if (data.type === 'MESSAGE_DELETE' && data.messageId) {
      const { messageId } = data;
      
      setMessages(prevMessages => {
        // Check if message exists in our list
        const messageExists = prevMessages.some(msg => msg.id === messageId);
        if (!messageExists) return prevMessages;

        // Remove the message
        return prevMessages.filter(msg => msg.id !== messageId);
      });

      // Remove from unread messages if it was there
      setUnreadMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
      setUnreadCount(prev => Math.max(0, prev - 1));
    } else if (data.type === 'MESSAGE_READ_STATUS' && data.message_range) {
      // Обработка сообщения о прочтении сообщений
      const { from, to } = data.message_range;
      
      // Увеличиваем read_by_count для всех сообщений в диапазоне от from до to включительно
      setMessages(prevMessages => {
        return prevMessages.map(msg => {
          // Проверяем, что сообщение входит в диапазон и принадлежит текущему пользователю
          if (msg.id >= from && msg.id <= to && msg.author.id === user?.id) {
            // Увеличиваем счетчик прочтений на 1
            const currentCount = msg.read_by_count || 0;
            return {
              ...msg,
              read_by_count: currentCount + 1
            };
          }
          return msg;
        });
      });
      
      console.log(`Обновлены счетчики прочтений для сообщений в диапазоне ${from}-${to}`);
    }
  }, [isScrolledToBottom, user?.id, activeChannel, convertToExtendedMessage]);

  // Обработчик сообщений о печати
  const handleTypingMessage = useCallback((message: any) => {
    // Проверяем, что сообщение имеет правильный формат
    if (!message || !message.user || !message.user.id || !message.type || message.channelId !== activeChannel?.id) {
      return;
    }
    
    const typingUser = message.user;
    
    // Не показываем собственный статус печати
    if (typingUser.id === user?.id) {
      return;
    }
    
    // Обрабатываем TYPING_STARTED
    if (message.type === 'TYPING_STARTED') {
      setTypingUsers(prev => {
        // Проверяем, есть ли уже пользователь в списке
        const existingUserIndex = prev.findIndex(u => u.id === typingUser.id);
        if (existingUserIndex !== -1) {
          return prev;
        }
        // Добавляем нового пользователя в конец списка
        const newUsers = [...prev, typingUser];
        // Сортируем по времени добавления (последние добавленные в конце)
        return newUsers;
      });
    } 
    // Обрабатываем TYPING_STOPPED
    else if (message.type === 'TYPING_STOPPED') {
      setTypingUsers(prev => prev.filter(u => u.id !== typingUser.id));
    }
  }, [user?.id, activeChannel?.id]);

  // Subscribe to user-specific queue
  useWebSocket(
    activeChannel && user ? `/v1/user/${user?.id}/queue/channels/${activeChannel.id}/messages` : null,
    handleNewMessage
  );

  // Subscribe to channel topic
  useWebSocket(
    activeChannel ? `/v1/topic/channels/${activeChannel.id}/messages` : null,
    handleNewMessage
  );
  
  // Subscribe to typing indicator updates
  useWebSocket(
    activeChannel ? `/v1/topic/channels/${activeChannel.id}/typing` : null,
    handleTypingMessage
  );
  
  // Component unmount cleanup
  useEffect(() => {
    return () => {
      // This will run only when the component unmounts completely
      console.log('MainChatArea component unmounting');
      
      // Clear any remaining timers
      if (readMessagesTimeoutRef.current) {
        clearTimeout(readMessagesTimeoutRef.current);
      }
      if (dateLabelTimeoutRef.current) {
        clearTimeout(dateLabelTimeoutRef.current);
      }
    };
  }, []);

  // Setup debounced sending of unread messages
  useEffect(() => {
    if (!activeChannel) return;

    // Function to send buffered unread messages
    const sendBufferedUnreadMessages = () => {
      if (unreadMessagesBufferRef.current.size > 0) {
        const messageIds = Array.from(unreadMessagesBufferRef.current);
        webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read`, { message_ids: messageIds });
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

  // Setup intersection observer for message visibility
  useEffect(() => {
    if (!messagesContainerRef.current || !activeChannel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const messageId = parseInt(entry.target.getAttribute('data-msg-id') || '0', 10);
          if (messageId) {
            if (entry.isIntersecting) {
              // Message is visible
              visibleMessagesRef.current.add(messageId);
              
              // If message is from other user and has status that is not READ
              const message = messages.find(m => m.id === messageId);
              // Never highlight messages from current user
              if (message && message.author.id !== user?.id && message.status === MessageStatus.NEW) {
                // Add to buffer for debounced sending
                unreadMessagesBufferRef.current.add(messageId);
                
                // Add message to highlighted set for temporary visual effect
                setHighlightedMessages(prev => {
                  const newSet = new Set(prev);
                  newSet.add(messageId);
                  return newSet;
                });
                
                // Remove highlight after 1.5 seconds
                setTimeout(() => {
                  setHighlightedMessages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(messageId);
                    return newSet;
                  });
                }, 1500);
                
                // Update message status locally
                setMessages(prev => prev.map(msg => 
                  msg.id === messageId 
                    ? { ...msg, status: MessageStatus.READ }
                    : msg
                ));
                
                // Update unread message counters
                setUnreadMessages(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(messageId);
                  return newSet;
                });
                setUnreadCount(prev => Math.max(0, prev - 1));
                      }
              
              // If this was the last unread message, hide the notification
              if (unreadCount <= 1) {
                setHasNewMessage(false);
              }
            } else {
              // Message is not visible
              visibleMessagesRef.current.delete(messageId);
            }
          }
        });
      },
      {
        root: messagesContainerRef.current,
        threshold: 0.5, // Message is considered visible when 50% is in view
      }
    );

    // Observe all message elements
    const messageElements = messagesContainerRef.current.querySelectorAll('.message-item');
    messageElements.forEach(element => observer.observe(element));

    return () => {
      observer.disconnect();
      if (readMessagesTimeoutRef.current) {
        clearTimeout(readMessagesTimeoutRef.current);
      }
    };
  }, [messages, user?.id, activeChannel]);

  // Remove old scroll-based read status handling
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setIsScrolledToBottom(isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);


  // Add effect to handle scroll to bottom
  useEffect(() => {
    if (isScrolledToBottom && activeChannel) {
      // When user scrolls to bottom, mark all messages as read
      webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
      
      // Update all messages to READ status
      setMessages(prev => prev.map(msg => (
        msg.author.id !== user?.id 
          ? { ...msg, status: MessageStatus.READ }
          : msg
      )));
      
      // Clear all unread indicators
      setUnreadMessages(new Set());
      setUnreadCount(0);
      setHasNewMessage(false);
    }
  }, [isScrolledToBottom, activeChannel, user?.id]);



  const renderSkeleton = () => (
    <Box sx={{ 
      flex: 1, 
      p: 3, 
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      {[...Array(5)].map((_, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={120} height={24} sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 1 }} />
            <Skeleton variant="text" width="80%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
            <Skeleton variant="text" width="60%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
          </Box>
        </Box>
      ))}
    </Box>
  );

  // Функция рендеринга отдельного сообщения для виртуальной прокрутки
  const renderVirtualizedMessage = useCallback((message: ExtendedMessage, index: number, style: React.CSSProperties) => {
    const isFirstOfGroup = index === 0 || 
      sortedMessages[index - 1]?.author.id !== message.author.id ||
      !isWithinTimeThreshold(sortedMessages[index - 1]?.created_at, message.created_at);
    
    const isTempMessage = message.id === -1;
    
    return (
      <Box
        style={style}
        sx={{
          px: 3,
        }}
      >
        <Box
          className="message-item"
          data-date={message.created_at}
          data-msg-id={message.id.toString()}
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'flex-start',
            position: 'relative',
            borderRadius: '10px',
            transition: 'background-color 0.3s ease',
            opacity: isTempMessage ? 0.6 : 1,
            backgroundColor: focusedMessageId === message.id
              ? 'rgba(0, 207, 255, 0.25)'
              : highlightedMessages.has(message.id)
                ? 'rgba(255,105,180,0.2)'
                : unreadMessages.has(message.id)
                  ? 'rgba(25,118,210,0.1)'
                  : 'transparent',
            '&:hover': {
              backgroundColor: focusedMessageId === message.id
                ? 'rgba(0, 207, 255, 0.3)'
                : highlightedMessages.has(message.id)
                  ? 'rgba(255,105,180,0.25)'
                  : unreadMessages.has(message.id) 
                    ? 'rgba(25,118,210,0.15)' 
                    : 'rgba(255,255,255,0.03)',
            },
            '&:hover .message-actions': {
              opacity: isTempMessage ? 0 : 1,
              pointerEvents: isTempMessage ? 'none' : 'auto',
            },
          }}
        >
          {/* Avatar */}
          {isFirstOfGroup ? (
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'flex-start', 
                width: 40,
                ml: 1,
                mt: 1,
              }}
            >
              <div style={{ cursor: 'pointer' }}>
                <UserAvatar 
                  src={message.author.avatar || undefined} 
                  alt={message.author.login} 
                  userId={message.author.id}
                  hubId={hubId}
                />
              </div>
            </Box>
          ) : (
            <Box sx={{ width: 40, ml: 1, mt: 1 }} />
          )}
          
          {/* Message content */}
          <Box sx={{ flex: 1, position: 'relative' }}>
            <Box sx={{ maxWidth: '100%' }}>
              <Box sx={{ py: '5px', px: '0px', pl: 0 }}>
                {isFirstOfGroup && (
                  <Typography sx={{ color: '#00CFFF', fontWeight: 700, mb: 0.5, fontSize: '1rem', letterSpacing: 0.2 }}>
                    {message.author.login}
                  </Typography>
                )}
                {editingMessageId === message.id ? (
                  // Edit form
                  <Formik
                    initialValues={{ content: message.content }}
                    validationSchema={messageSchema}
                    onSubmit={handleEditMessage}
                  >
                    {({ handleSubmit, values }) => (
                      <Form>
                        <Box sx={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 1,
                          background: 'rgba(30,30,47,0.9)',
                          borderRadius: '8px',
                          padding: '8px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        }}>
                          <Field
                            name="content"
                            component={Input}
                            multiline
                            fullWidth
                            size="small"
                            inputRef={editInputRef}
                            onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingMessageId(null);
                              }
                            }}
                          />
                          <Box sx={{ 
                            display: 'flex', 
                            gap: 1, 
                            justifyContent: 'flex-end',
                            padding: '4px 8px',
                          }}>
                            <IconButton 
                              size="small" 
                              onClick={() => setEditingMessageId(null)}
                              sx={{ 
                                color: '#d32f2f',
                                '&:hover': { background: 'rgba(211,47,47,0.1)' }
                              }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              onClick={() => handleSubmit()}
                              disabled={!values.content}
                              sx={{ 
                                color: values.content ? '#1976D2' : 'rgba(255,255,255,0.3)',
                                transition: 'color 0.25s cubic-bezier(.4,0,.2,1)',
                                '&:hover': {
                                  color: values.content ? '#1976D2' : 'rgba(255,255,255,0.3)',
                                }
                              }}
                            >
                              <SendIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      </Form>
                    )}
                  </Formik>
                ) : (
                  // Message display
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    position: 'relative'
                  }}>
                    <Typography
                      sx={{ 
                        color: 'rgba(255,255,255,0.85)', 
                        wordBreak: 'break-word', 
                        fontSize: '1.01rem',
                        whiteSpace: 'pre-wrap',
                        pr: '120px',
                        pl: 0,
                        lineHeight: 1.4
                      }}
                      component="span"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                          message.content.replace(/\r\n/g, '\n').replace(/\n/g, '<br>')
                        )
                      }}
                    />
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      position: 'absolute',
                      top: 0,
                      right: 0,
                    }}>
                      {message.last_modified_at && message.last_modified_at !== message.created_at && (
                        <span style={{ 
                          color: '#90caf9', 
                          fontSize: '0.85em', 
                          fontStyle: 'italic',
                          fontWeight: 500
                        }}>ред.</span>
                      )}
                      {message.author.id === user?.id && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mr: 0.5
                          }}
                        >
                          <DoneAllIcon 
                            sx={{ 
                              fontSize: '1rem',
                              color: message.read_by_count && message.read_by_count > 0 ? '#FF69B4' : 'rgba(255,255,255,0.35)'
                            }} 
                          />
                        </Box>
                      )}
                      <Typography sx={{ 
                        color: 'rgba(255,255,255,0.35)', 
                        fontSize: '0.78rem', 
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5
                      }}>
                        {formatMessageTime(message.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
            
            {/* Message actions */}
            {!isTempMessage && (
              <Box
                className="message-actions"
                sx={{
                  position: 'absolute',
                  top: -38,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: 1,
                  opacity: 0,
                  pointerEvents: 'none',
                  transition: 'opacity 0.2s',
                  zIndex: 10,
                  background: 'rgba(20,20,35,0.85)',
                  borderRadius: 2,
                  boxShadow: '0 8px 24px 0 rgba(0,0,0,0.3), 0 0 12px 0 rgba(149,128,255,0.2)',
                  px: 1.5,
                  py: 0.5,
                  border: '1px solid rgba(149,128,255,0.25)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <IconButton 
                  size="small" 
                  onClick={() => setReplyingToMessage(message)} 
                  sx={{ 
                    color: '#00FFBA', 
                    transition: 'all 0.2s ease',
                    padding: '6px',
                    backgroundColor: 'rgba(0, 255, 186, 0.12)',
                    '&:hover': { 
                      color: '#00FFBA',
                      backgroundColor: 'rgba(0, 255, 186, 0.25)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 8px rgba(0, 255, 186, 0.3)'
                    } 
                  }}
                >
                  <ReplyIcon fontSize="small" />
                </IconButton>
                
                {message.author.id === user?.id && (
                  <>
                    <IconButton 
                      size="small" 
                      onClick={() => setEditingMessageId(message.id)} 
                      sx={{ 
                        color: '#00CFFF', 
                        transition: 'all 0.2s ease',
                        padding: '6px',
                        backgroundColor: 'rgba(0, 207, 255, 0.12)',
                        '&:hover': { 
                          color: '#00CFFF',
                          backgroundColor: 'rgba(0, 207, 255, 0.25)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 8px rgba(0, 207, 255, 0.3)'
                        } 
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeleteMessage(message.id)} 
                      sx={{ 
                        color: '#FF3D71', 
                        transition: 'all 0.2s ease',
                        padding: '6px',
                        backgroundColor: 'rgba(255, 61, 113, 0.12)',
                        '&:hover': { 
                          color: '#FF3D71',
                          backgroundColor: 'rgba(255, 61, 113, 0.25)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 8px rgba(255, 61, 113, 0.3)'
                        } 
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  }, [user?.id, hubId, focusedMessageId, highlightedMessages, unreadMessages, editingMessageId, sortedMessages, handleEditMessage, setEditingMessageId, setReplyingToMessage, handleDeleteMessage]);

  const renderMessages = () => {
    // Combine real and temporary messages
    const allMessages = [...sortedMessages, ...Array.from(tempMessages.values())];
    
    if (allMessages.length === 0) {
      return (
        <Box sx={{ 
          flex: 1,
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          gap: 2
        }}>
          <Typography variant="h6">
            Нет сообщений
          </Typography>
          <Typography variant="body2">
            Начните общение, отправив первое сообщение
          </Typography>
        </Box>
      );
    }
    
    return (
      <VirtualizedChatArea
        ref={virtualizedChatRef}
        messages={allMessages}
        isLoading={isLoading}
        hasMore={hasMoreMessages}
        onLoadMore={() => {
          const oldestMessage = sortedMessages[0];
          if (oldestMessage && !isLoadingMoreRef.current) {
            setBeforeId(oldestMessage.id);
          }
        }}
        currentUserId={user.id}
        hubId={hubId}
        renderMessage={renderVirtualizedMessage}
        onScrollStateChange={(isAtBottom) => {
          setIsScrolledToBottom(isAtBottom);
          setShowScrollButton(!isAtBottom);
        }}
      />
    );
  };

  const renderOldMessages = () => (
    <Box 
      ref={messagesContainerRef}
      className="messages-container"
      sx={{ 
        flex: 1, 
        minHeight: 0,
        pt: 3,
        px: 3,
        pb: 8, // Увеличенный нижний padding
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        position: 'relative',
        contain: 'layout', // Добавляем contain для оптимизации
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '4px',
          '&:hover': {
            background: 'rgba(255,255,255,0.15)',
          },
        },
      }}
    >
      {sortedMessages.length === 0 && tempMessages.size === 0 ? (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100%',
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          gap: 2
        }}>
          <Typography variant="h6">
            Нет сообщений
          </Typography>
          <Typography variant="body2">
            Начните общение, отправив первое сообщение
          </Typography>
        </Box>
      ) : (
        <>
          {/* Floating date label */}
          <Fade in={showDateLabel} timeout={{ enter: 300, exit: 500 }}>
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                alignSelf: 'center',
                backgroundColor: 'rgba(30,30,47,0.85)',
                backdropFilter: 'blur(8px)',
                borderRadius: '16px',
                px: 2,
                py: 0.75,
                mb: 1,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.3s ease',
              }}
            >
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                {currentDateLabel}
              </Typography>
            </Box>
          </Fade>

          {/* Messages */}
          {(() => {
            let result: React.ReactElement[] = [];
            let prevAuthorId: number | null = null;
            let prevMessageTime: string | null = null;
            let currentGroup: React.ReactElement[] = [];
            let currentDateString: string | null = null;
            let processedDates = new Set<string>();
            
            // Combine real and temporary messages
            const allMessages = [...sortedMessages, ...Array.from(tempMessages.values())];
            
            allMessages.forEach((msg) => {
              const messageDate = new Date(msg.created_at);
              const messageDateString = messageDate.toDateString();
              
              // Check if this is a new date
              const isNewDate = currentDateString !== messageDateString;
              if (isNewDate && !processedDates.has(messageDateString)) {
                // Add date separator for new date groups
                if (currentGroup.length > 0) {
                  result.push(...currentGroup);
                  currentGroup = [];
                }
                
                result.push(
                  <Box
                    key={`date-${messageDateString}`}
                    className="date-separator"
                    data-date={msg.created_at}
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      my: 2,
                      position: 'relative',
                    }}
                  >
                    <Box
                      sx={{
                        backgroundColor: 'rgba(30,30,47,0.85)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '16px',
                        px: 2,
                        py: 0.75,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        zIndex: 2,
                      }}
                    >
                      <Typography
                        sx={{
                          color: 'rgba(255,255,255,0.9)',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                        }}
                      >
                        {formatDateForGroup(msg.created_at)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        position: 'absolute',
                        height: '1px',
                        width: '100%',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        zIndex: 1,
                      }}
                    />
                  </Box>
                );
                
                currentDateString = messageDateString;
                processedDates.add(messageDateString);
              }
              
              const isFirstOfGroup = prevAuthorId !== msg.author.id || 
                (prevMessageTime && !isWithinTimeThreshold(prevMessageTime, msg.created_at));

              const isTempMessage = msg.id === -1;

              const messageElement = (
                <Box
                  key={isTempMessage ? `temp-${msg.created_at}` : msg.id}
                  className="message-item"
                  data-date={msg.created_at}
                  data-msg-id={msg.id.toString()}
                  sx={{
                    display: 'flex',
                    gap: 2,
                    alignItems: 'flex-start',
                    position: 'relative',
                    borderRadius: '10px',
                    transition: 'background-color 0.3s ease',
                    opacity: isTempMessage ? 0.6 : 1,
                    backgroundColor: focusedMessageId === msg.id
                      ? 'rgba(0, 207, 255, 0.25)' // Bright blue highlight for focused message (reply source)
                      : highlightedMessages.has(msg.id)
                        ? 'rgba(255,105,180,0.2)' // Bright pink highlight for newly visible unread messages
                        : unreadMessages.has(msg.id)
                          ? 'rgba(25,118,210,0.1)' // Blue for unread messages
                          : 'transparent',
                    '&:hover': {
                      backgroundColor: focusedMessageId === msg.id
                        ? 'rgba(0, 207, 255, 0.3)'
                        : highlightedMessages.has(msg.id)
                          ? 'rgba(255,105,180,0.25)'
                          : unreadMessages.has(msg.id) 
                            ? 'rgba(25,118,210,0.15)' 
                            : 'rgba(255,255,255,0.03)',
                    },
                    '&:hover .message-actions': {
                      opacity: isTempMessage ? 0 : 1,
                      pointerEvents: isTempMessage ? 'none' : 'auto',
                    },
                  }}
                >
                  {isFirstOfGroup ? (
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'flex-start', 
                        width: 40,
                        ml: 1,
                        mt: 1,
                      }}
                    >
                      <div
                        style={{ cursor: 'pointer' }}
                      >
                        <UserAvatar 
                          src={msg.author.avatar || undefined} 
                          alt={msg.author.login} 
                          userId={msg.author.id}
                          hubId={hubId}
                        />
                      </div>
                    </Box>
                  ) : (
                    <Box sx={{ width: 40, ml: 1, mt: 1 }} />
                  )}
                  <Box sx={{ flex: 1, position: 'relative' }}>
                    <Box sx={{ maxWidth: '100%' }}>
                      <Box sx={{ py: '5px', px: '0px', pl: 0 }}>
                        {isFirstOfGroup && (
                          <Typography sx={{ color: '#00CFFF', fontWeight: 700, mb: 0.5, fontSize: '1rem', letterSpacing: 0.2 }}>
                            {msg.author.login}
                          </Typography>
                        )}
                        {editingMessageId === msg.id ? (
                          <Formik
                            initialValues={{ content: msg.content }}
                            validationSchema={messageSchema}
                            onSubmit={handleEditMessage}
                          >
                            {({ handleSubmit, values }) => (
                              <Form>
                                <Box sx={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: 1,
                                  background: 'rgba(30,30,47,0.9)',
                                  borderRadius: '8px',
                                  padding: '8px',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                }}>
                                  <Field
                                    name="content"
                                    component={Input}
                                    multiline
                                    fullWidth
                                    size="small"
                                    inputRef={editInputRef}
                                    onKeyDown={(e: React.KeyboardEvent) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit();
                                      } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setEditingMessageId(null);
                                      }
                                    }}
                                  />
                                  <Box sx={{ 
                                    display: 'flex', 
                                    gap: 1, 
                                    justifyContent: 'flex-end',
                                    padding: '4px 8px',
                                  }}>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => {
                                        setEditingMessageId(null);
                                      }}
                                      sx={{ 
                                        color: '#d32f2f',
                                        '&:hover': { background: 'rgba(211,47,47,0.1)' }
                                      }}
                                    >
                                      <CloseIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleSubmit()}
                                      disabled={!values.content}
                                      sx={{ 
                                        color: values.content ? '#1976D2' : 'rgba(255,255,255,0.3)',
                                        transition: 'color 0.25s cubic-bezier(.4,0,.2,1)',
                                        '&:hover': {
                                          color: values.content ? '#1976D2' : 'rgba(255,255,255,0.3)',
                                        }
                                      }}
                                    >
                                      <SendIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </Box>
                              </Form>
                            )}
                          </Formik>
                        ) : (
                          <Box sx={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            position: 'relative'
                          }}>
                            <Typography
                              sx={{ 
                                color: 'rgba(255,255,255,0.85)', 
                                wordBreak: 'break-word', 
                                fontSize: '1.01rem',
                                whiteSpace: 'pre-wrap',
                                pr: '120px',
                                pl: 0,
                                lineHeight: 1.4
                              }}
                              component="span"
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(
                                  msg.content.replace(/\r\n/g, '\n').replace(/\n/g, '<br>')
                                )
                              }}
                            />
                            <Box sx={{ 
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              position: 'absolute',
                              top: 0,
                              right: 0,
                            }}>
                              {msg.last_modified_at && msg.last_modified_at !== msg.created_at && (
                                <span style={{ 
                                  color: '#90caf9', 
                                  fontSize: '0.85em', 
                                  fontStyle: 'italic',
                                  fontWeight: 500
                                }}>ред.</span>
                              )}
                              {msg.author.id === user?.id && (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    mr: 0.5
                                  }}
                                >
                                  <DoneAllIcon 
                                    sx={{ 
                                      fontSize: '1rem',
                                      color: msg.read_by_count && msg.read_by_count > 0 ? '#FF69B4' : 'rgba(255,255,255,0.35)'
                                    }} 
                                  />
                                </Box>
                              )}
                              <Typography sx={{ 
                                color: 'rgba(255,255,255,0.35)', 
                                fontSize: '0.78rem', 
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                              }}>
                                {formatMessageTime(msg.created_at)}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                    {!isTempMessage && (
                      <Box
                        className="message-actions"
                        sx={{
                          position: 'absolute',
                          top: -38,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          display: 'flex',
                          gap: 1,
                          opacity: 0,
                          pointerEvents: 'none',
                          transition: 'opacity 0.2s',
                          zIndex: 10,
                          background: 'rgba(20,20,35,0.85)',
                          borderRadius: 2,
                          boxShadow: '0 8px 24px 0 rgba(0,0,0,0.3), 0 0 12px 0 rgba(149,128,255,0.2)',
                          px: 1.5,
                          py: 0.5,
                          border: '1px solid rgba(149,128,255,0.25)',
                          backdropFilter: 'blur(12px)',
                        }}
                      >
                        <IconButton 
                          size="small" 
                          onClick={() => setReplyingToMessage(msg)} 
                          sx={{ 
                            color: '#00FFBA', 
                            transition: 'all 0.2s ease',
                            padding: '6px',
                            backgroundColor: 'rgba(0, 255, 186, 0.12)',
                            '&:hover': { 
                              color: '#00FFBA',
                              backgroundColor: 'rgba(0, 255, 186, 0.25)',
                              transform: 'translateY(-2px)',
                              boxShadow: '0 4px 8px rgba(0, 255, 186, 0.3)'
                            } 
                          }}
                        >
                          <ReplyIcon fontSize="small" />
                        </IconButton>
                        
                        {msg.author.id === user?.id && (
                          <>
                            <IconButton 
                              size="small" 
                              onClick={() => setEditingMessageId(msg.id)} 
                              sx={{ 
                                color: '#00CFFF', 
                                transition: 'all 0.2s ease',
                                padding: '6px',
                                backgroundColor: 'rgba(0, 207, 255, 0.12)',
                                '&:hover': { 
                                  color: '#00CFFF',
                                  backgroundColor: 'rgba(0, 207, 255, 0.25)',
                                  transform: 'translateY(-2px)',
                                  boxShadow: '0 4px 8px rgba(0, 207, 255, 0.3)'
                                } 
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              onClick={() => handleDeleteMessage(msg.id)} 
                              sx={{ 
                                color: '#FF3D71', 
                                transition: 'all 0.2s ease',
                                padding: '6px',
                                backgroundColor: 'rgba(255, 61, 113, 0.12)',
                                '&:hover': { 
                                  color: '#FF3D71',
                                  backgroundColor: 'rgba(255, 61, 113, 0.25)',
                                  transform: 'translateY(-2px)',
                                  boxShadow: '0 4px 8px rgba(255, 61, 113, 0.3)'
                                } 
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              );

              currentGroup.push(messageElement);
              prevAuthorId = msg.author.id;
              prevMessageTime = msg.created_at;
            });

            if (currentGroup.length > 0) {
              result.push(...currentGroup);
            }

            return result;
          })()}
          
          
          {/* For properly tracking the end of messages for scrolling */}
          <div ref={messagesEndRef} />
        </>
      )}
    </Box>
  );

  return (
    <Box
      sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'rgba(30,30,47,0.95)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
      }}
    >
      <Box sx={{ 
        height: 60, 
        px: 3,
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
          {activeChannel?.name || 'Select a channel'}
        </Typography>
      </Box>

      {isLoading && !beforeId ? renderSkeleton() : renderMessages()}

      {/* New messages count indicator */}
      <Fade in={unreadCount > 0}>
        <Box
          sx={{
            position: 'absolute',
            bottom: replyingToMessage ? 160 : 100, // Increased bottom margin when reply panel is visible
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            transition: 'bottom 0.2s ease-out', // Smooth transition for position change
          }}
        >
          <Paper
            sx={{
              backgroundColor: '#FF69B4',
              color: '#fff',
              px: 2,
              py: 1,
              borderRadius: '20px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255,105,180,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover': {
                backgroundColor: '#FF1493',
              },
            }}
            onClick={handleScrollToBottom}
          >
            <KeyboardArrowDownIcon />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {unreadCount} {unreadCount === 1 ? 'новое сообщение' : 'новых сообщений'}
            </Typography>
          </Paper>
        </Box>
      </Fade>

      <Box sx={{ p: 2, position: 'relative' }}>
        {/* Индикатор типающих пользователей над полем ввода */}
        {typingUsers.length > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: -40,
              left: 20,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#002B3D', // Темный непрозрачный фон
              borderRadius: '24px',
              padding: '6px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: '1px solid #00CFFF',
              boxShadow: '0 4px 20px rgba(0, 207, 255, 0.3)',
              zIndex: 10,
              '&:hover': {
                backgroundColor: '#003D52',
                transform: 'translateY(-2px) scale(1.02)',
                boxShadow: '0 6px 24px rgba(0, 207, 255, 0.4)',
              }
            }}
            onClick={() => setShowTypingUsersModal(true)}
          >
            <Stack direction="row" spacing={-1.2} mr={1}>
              {typingUsers.slice(0, 2).map((user, index) => (
                <Box
                  key={user.id}
                  sx={{
                    position: 'relative',
                    zIndex: 2 - index,
                  }}
                >
                  <UserAvatar
                    src={user.avatar || undefined}
                    alt={user.login}
                    sx={{
                      width: 28,
                      height: 28,
                      border: '2px solid #002B3D',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: '#00FF94',
                      border: '2px solid #002B3D',
                    }}
                  />
                </Box>
              ))}
            </Stack>
            <Box sx={{ display: 'flex', gap: '2px', ml: 0.5 }}>
              {[1, 2, 3].map((dot) => (
                <Box
                  key={dot}
                  sx={{
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    backgroundColor: '#00CFFF',
                    animation: 'bubble 1.4s ease-in-out infinite',
                    animationDelay: `${(dot - 1) * 0.2}s`,
                    '@keyframes bubble': {
                      '0%, 60%, 100%': { 
                        transform: 'scale(1)',
                        opacity: 0.3,
                      },
                      '30%': { 
                        transform: 'scale(1.4)',
                        opacity: 1,
                      },
                    }
                  }}
                />
              ))}
            </Box>
            {typingUsers.length > 2 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#00CFFF',
                  color: '#002B3D',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  ml: 0.5,
                  minWidth: '28px',
                  height: '24px',
                }}
              >
                +{typingUsers.length - 2}
              </Box>
            )}
          </Box>
        )}
        
        {canSendMessages ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {replyingToMessage && (
              <Paper
                sx={{
                  p: '8px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  background: 'rgba(30,30,47,0.95)',
                  border: '1px solid rgba(149,128,255,0.25)',
                  borderRadius: 2,
                  position: 'relative',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  mb: 1,
                  pl: 3
                }}
              >
                <Box 
                  sx={{ 
                    position: 'absolute', 
                    left: 0, 
                    top: 0, 
                    bottom: 0, 
                    width: '4px', 
                    backgroundColor: '#00CFFF',
                    borderTopLeftRadius: 2,
                    borderBottomLeftRadius: 2
                  }}
                />
                <Box 
                  sx={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => {
                    // Find and scroll to the original message
                    if (replyingToMessage && replyingToMessage.id) {
                      const messageElement = document.querySelector(`[data-msg-id='${replyingToMessage.id}']`);
                      if (messageElement) {
                        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        // Highlight the message
                        setFocusedMessageId(replyingToMessage.id);
                        
                        // Add to highlighted set for visual effect
                        setHighlightedMessages(prev => {
                          const newSet = new Set(prev);
                          newSet.add(replyingToMessage.id);
                          return newSet;
                        });
                        
                        // Remove highlight after 3 seconds
                        setTimeout(() => {
                          setHighlightedMessages(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(replyingToMessage.id);
                            return newSet;
                          });
                          setFocusedMessageId(null);
                        }, 3000);
                      }
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <ReplyIcon sx={{ color: '#00CFFF', fontSize: '0.9rem' }} />
                    <Typography sx={{ color: '#00CFFF', fontWeight: 600, fontSize: '0.9rem' }}>
                      {replyingToMessage.author.login}
                    </Typography>
                  </Box>
                  <Typography 
                    sx={{ 
                      color: 'rgba(255,255,255,0.7)', 
                      fontSize: '0.85rem',
                      maxWidth: '500px', // Fixed maximum width
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxHeight: '1.5em'
                    }}
                  >
                    {(() => {
                      // Handle extremely long messages with no spaces
                      const content = replyingToMessage.content;
                      // First check if content is too long
                      if (content.length > 150) {
                        // Check if it's a long string with no spaces (which causes layout issues)
                        const hasSpaces = content.indexOf(' ') !== -1;
                        if (!hasSpaces && content.length > 100) {
                          // For long strings with no spaces, be more aggressive with truncation
                          return content.substring(0, 100) + '...';
                        } else {
                          // Normal truncation for text with spaces
                          return content.substring(0, 150) + '...';
                        }
                      }
                      return content;
                    })()}
                  </Typography>
                </Box>
                <IconButton 
                  size="small" 
                  onClick={() => setReplyingToMessage(null)}
                  sx={{ 
                    color: 'rgba(255,255,255,0.5)',
                    '&:hover': { color: 'rgba(255,255,255,0.8)' }
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Paper>
            )}
            <Paper
              sx={{
                p: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 3,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
            <Formik
              initialValues={{ content: '' }}
              validationSchema={messageSchema}
              onSubmit={handleSendMessage}
            >
              {({ handleSubmit, values, setFieldValue }) => (
                <>
                  <Form style={{ width: '100%' }}>
                    <Field
                      name="content"
                      component={Input}
                      placeholder="Type a message..."
                      multiline
                      maxRows={4}
                      size="small"
                      disabled={!activeChannel || sending}
                      inputRef={inputRef}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'transparent',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'transparent',
                          },
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'transparent',
                          },
                        },
                      }}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                          // Прекращаем печать при отправке сообщения
                          sendTypingStatus(false);
                        }
                      }}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const content = e.target.value;
                        setFieldValue('content', content);
                        
                        // Отправляем статус печати если есть текст
                        if (content.trim().length > 0) {
                          sendTypingStatus(true);
                        } else {
                          sendTypingStatus(false);
                        }
                      }}
                    />
                  </Form>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton size="small" sx={{ color: '#FF69B4' }}>
                      <EmojiEmotionsIcon />
                    </IconButton>
                    <IconButton size="small" sx={{ color: '#1E90FF' }}>
                      <AttachFileIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{
                        color: values.content ? '#1976D2' : 'rgba(255,255,255,0.3)',
                        transition: 'color 0.25s cubic-bezier(.4,0,.2,1)',
                        '&:hover': {
                          color: values.content ? '#1976D2' : 'rgba(255,255,255,0.3)',
                        }
                      }}
                      onClick={() => handleSubmit()}
                      disabled={sending || !values.content}
                    >
                      <SendIcon />
                    </IconButton>
                  </Stack>
                </>
              )}
            </Formik>
          </Paper>
          </Box>
        ) : (
          <Paper
            sx={{
              p: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 3,
            }}
          >
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
              Недостаточно прав для отправки сообщений
            </Typography>
          </Paper>
        )}
      </Box>
      
      {/* Модальное окно со всеми типающими пользователями */}
      <AppModal
        open={showTypingUsersModal}
        onClose={() => setShowTypingUsersModal(false)}
        title="Пользователи, которые печатают"
        
      >
        <List 
          sx={{ 
            pt: 0,
            maxHeight: '400px',
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '4px',
              '&:hover': {
                background: 'rgba(255,255,255,0.15)',
              },
            },
          }}
        >
          {typingUsers.map((user) => (
            <ListItem key={user.id}>
              <ListItemAvatar>
                <UserAvatar 
                  src={user.avatar || undefined}
                  alt={user.login}
                  sx={{ width: 40, height: 40 }}
                />
              </ListItemAvatar>
              <ListItemText 
                primary={
                  <Typography sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    {user.login}
                  </Typography>
                }
                secondary={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Box component="span" sx={{ display: 'flex', gap: '2px' }}>
                      {[1, 2, 3].map((dot) => (
                        <Box
                          component="span"
                          key={dot}
                          sx={{
                            display: 'inline-block',
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            backgroundColor: '#00CFFF',
                            animation: 'bubble 1.4s ease-in-out infinite',
                            animationDelay: `${(dot - 1) * 0.2}s`,
                            '@keyframes bubble': {
                              '0%, 60%, 100%': { 
                                transform: 'scale(1)',
                                opacity: 0.3,
                              },
                              '30%': { 
                                transform: 'scale(1.4)',
                                opacity: 1,
                              },
                            }
                          }}
                        />
                      ))}
                    </Box>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                      печатает...
                    </span>
                  </Box>
                }
              />
            </ListItem>
          ))}
          {typingUsers.length === 0 && (
            <ListItem>
              <ListItemText 
                primary={
                  <Typography sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Никто не печатает
                  </Typography>
                }
                secondary={
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
                    В данный момент никто не набирает сообщение
                  </Typography>
                }
              />
            </ListItem>
          )}
        </List>
      </AppModal>
    </Box>
  );
};

export default MainChatArea;