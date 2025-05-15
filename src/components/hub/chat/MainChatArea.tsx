import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, IconButton, Paper, Stack, Typography, Fade, Skeleton } from '@mui/material';
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
import DOMPurify from 'dompurify';
import { useNotification } from '@/context/NotificationContext';
import { hasPermission } from '@/utils/rolePermissions';
import { useWebSocket } from '@/websocket/useWebSocket';
import { webSocketService } from '@/websocket/WebSocketService';

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
  user: { id: number; login: string; avatar: string | null };
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

// Add type definitions for WebSocket messages
interface StompMessage {
  body: string;
  headers: Record<string, string>;
}

interface StompFrame {
  command: string;
  headers: Record<string, string>;
  body: string;
}

const MainChatArea: React.FC<MainChatAreaProps> = ({ activeChannel, user, hubId, userPermissions, isOwner }) => {
  const [sending, setSending] = useState(false);
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
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [highlightedMessages, setHighlightedMessages] = useState<Set<number>>(new Set());
  const [focusedMessageId, setFocusedMessageId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const dateLabelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingMoreRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const messagesLengthRef = useRef(0);
  const [page, setPage] = useState(1);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [readMessages, setReadMessages] = useState<Set<number>>(new Set());
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
  const unsubscribeFromChannelTopics = useCallback((channel: Channel | null, userId: number | null, callback: (message: any) => void) => {
    if (!channel) return;
    
    console.log(`Unsubscribing from all topics for channel ${channel.id}`);
    
    // Отписка от персональной очереди пользователя
    if (userId) {
      const userQueueTopic = `/v1/user/${userId}/queue/channels/${channel.id}/messages`;
      webSocketService.unsubscribe(userQueueTopic, callback);
    }
    
    // Отписка от общего топика канала
    const channelTopic = `/v1/topic/channels/${channel.id}/messages`;
    webSocketService.unsubscribe(channelTopic, callback);
  }, []);
  
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
  }, [activeChannel?.id, user?.id]);
  
  // Инициализация при входе в новый канал
  useEffect(() => {
    // Reset all states when channel changes
    setMessages([]);
    setHasMoreMessages(true);
    setBeforeId(null);
    setEditingMessageId(null);
    setCurrentDateLabel(null);
    setShowDateLabel(false);
    setShowScrollButton(false);
    setTempMessages(new Map());
    setPage(1);
    setIsScrolledToBottom(true);
    isLoadingMoreRef.current = false;
    setReadMessages(new Set());

    // Force scroll to bottom after channel change
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    });
    
    // Mark all messages as read when entering a channel
    if (activeChannel) {
      webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
    }
  }, [activeChannel?.id]); // Using id instead of the full object

  // Simple function to scroll to bottom without marking messages as read
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      setShowScrollButton(false);
    }
  }, []);

  // Function to scroll to bottom and mark all messages as read
  const handleScrollToBottom = useCallback(() => {
    // Scroll to bottom first
    scrollToBottom();
    
    // Send bulk-read-all request when scrolling to bottom
    if (activeChannel) {
      webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
      // Update all messages to READ status
      setMessages(prev => prev.map(msg => (
        msg.author.id !== user.id 
          ? { ...msg, status: MessageStatus.READ }
          : msg
      )));
    }

    // Update local state
    setUnreadMessages(new Set());
    setUnreadCount(0);
    setNewMessagesCount(0);
    setHasNewMessage(false);
  }, [activeChannel, user.id, scrollToBottom]);

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
      return;
    }
    
    // Only set messages on initial load (when beforeId is null)
    if (beforeId === null) {
      const extendedMessages = messagesData.map(convertToExtendedMessage);
      setMessages(extendedMessages);
      messagesLengthRef.current = messagesData.length;
      
      // Check for unread messages in initial load
      const unreadMessages = extendedMessages.filter(
        msg => msg.status === MessageStatus.NEW && msg.author.id !== user.id
      );
      
      if (unreadMessages.length > 0) {
        setUnreadMessages(new Set(unreadMessages.map(msg => msg.id)));
        setUnreadCount(unreadMessages.length);
      }
      
      // Scroll to bottom after loading initial messages
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      });
    }
  }, [activeChannel, messagesData, beforeId, convertToExtendedMessage, user.id]);

  // Add effect to handle auto-scrolling when typing
  useEffect(() => {
    if (messagesContainerRef.current) {
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      });
    }
  }, []); // Remove inputValue dependency since it's not being used

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
  }, [activeChannel, user, createMessage, focusMessageInput, notify]);

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
          
          // Highlight unread messages
          const messageId = parseInt(element.getAttribute('data-msg-id') || '0', 10);
          if (messageId) {
            const message = messages.find(m => m.id === messageId);
            if (message && message.author.id !== user.id && message.status !== MessageStatus.READ) {
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
  
      // Store the scroll height and scroll position BEFORE adding new messages
      const scrollHeightBefore = container.scrollHeight;
      const scrollPositionBefore = container.scrollTop;
      
      // Check if we received less messages than requested
      if (messagesData.length < MESSAGES_PER_PAGE) {
        setHasMoreMessages(false);
      }
  
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
              status: MessageStatus.NEW // Set an appropriate default status
            });
          }
        });
  
        // Convert map back to array and sort by creation date
        return Array.from(existingMessagesMap.values())
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
  
      // Use a more direct approach to maintain scroll position
      // Wait for the DOM to update with the new messages (both frames are critical)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Get the new scroll height after adding messages
          const scrollHeightAfter = container.scrollHeight;
          
          // Calculate how much height was added at the top
          const heightAdded = scrollHeightAfter - scrollHeightBefore;
          
          // Adjust the scroll position by the exact amount of height added
          // This keeps the same content visible as before
          container.scrollTop = scrollPositionBefore + heightAdded;
          
          isLoadingMoreRef.current = false;
        });
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
          msg.author.id !== user.id 
            ? { ...msg, status: MessageStatus.READ }
            : msg
        )));
        
        // Clear all unread indicators
        setUnreadMessages(new Set());
        setUnreadCount(0);
        setNewMessagesCount(0);
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
      if (newMessage.author.id === user.id) {
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
      
      // If user is at the bottom, immediately mark message as read
      const container = messagesContainerRef.current;
      if (container) {
        const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
        const isAtBottom = scrollPosition < 100;
        
        if (isAtBottom && activeChannel) {
          // Update message status to READ immediately
          setMessages(prev => prev.map(msg => 
            msg.id === newMessage.id && msg.author.id !== user.id
              ? { ...msg, status: MessageStatus.READ }
              : msg
          ));
          
          // Add to buffer for marking as read on server
          unreadMessagesBufferRef.current.add(newMessage.id);
        }
      }

      // If message has NEW status
      if (newMessage.status === MessageStatus.NEW) {
        const container = messagesContainerRef.current;
        if (container) {
          const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
          // Check if user is scrolled up significantly (more than 300px from bottom)
          // or just a little bit (less than or equal to 300px from bottom)
          const isScrolledUpSignificantly = scrollPosition > 300;
          
          console.log('New message received:', {
            isScrolledUpSignificantly,
            scrollPosition,
            messageId: newMessage.id
          });

          if (isScrolledUpSignificantly) {
            // Show new message indicator if scrolled up significantly
            setHasNewMessage(true);
            setUnreadMessages(prev => {
              const newSet = new Set(prev);
              newSet.add(newMessage.id);
              return newSet;
            });
            setUnreadCount(prev => prev + 1);
            setNewMessagesCount(prev => prev + 1);
            
            // Check if the message is visible in the viewport despite being scrolled up
            // This can happen if the user is scrolled up but the new message still appears at the bottom of the visible area
            setTimeout(() => {
              const messageElement = document.querySelector(`[data-msg-id="${newMessage.id}"]`);
              if (messageElement) {
                const rect = messageElement.getBoundingClientRect();
                const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
                
                if (isVisible && activeChannel) {
                  // If visible, add to buffer for marking as read
                  unreadMessagesBufferRef.current.add(newMessage.id);
                  
                  // Update message status locally
                  setMessages(prev => prev.map(msg => 
                    msg.id === newMessage.id
                      ? { ...msg, status: MessageStatus.READ }
                      : msg
                  ));
                  
                  // Update unread counters
                  setUnreadMessages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(newMessage.id);
                    return newSet;
                  });
                  setUnreadCount(prev => Math.max(0, prev - 1));
                  setNewMessagesCount(prev => Math.max(0, prev - 1));
                }
              }
            }, 100); // Small delay to ensure DOM is updated
          } else {
            // If at bottom or only scrolled up a little, auto-scroll to bottom and mark as read
            if (activeChannel) {
              // Add to buffer for marking as read
              unreadMessagesBufferRef.current.add(newMessage.id);
              
              // Auto-scroll to bottom
              requestAnimationFrame(() => {
                if (container) {
                  container.scrollTop = container.scrollHeight;
                  
                  // Find the message element after scrolling
                  setTimeout(() => {
                    const messageElement = document.querySelector(`[data-msg-id="${newMessage.id}"]`);
                    if (messageElement) {
                      // Ensure the message is visible in the viewport
                      messageElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                  }, 50);
                }
              });
              
              webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
              // Update all messages to READ status
              setMessages(prev => prev.map(msg => (
                msg.author.id !== user.id 
                  ? { ...msg, status: MessageStatus.READ }
                  : msg
              )));
              
              // Clear all unread indicators
              setUnreadMessages(new Set());
              setUnreadCount(0);
              setNewMessagesCount(0);
              setHasNewMessage(false);
            }
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
        setNewMessagesCount(prev => Math.max(0, prev - 1));
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
      setNewMessagesCount(prev => Math.max(0, prev - 1));
    } else if (data.type === 'MESSAGE_READ_STATUS' && data.message_range) {
      // Обработка сообщения о прочтении сообщений
      const { from, to } = data.message_range;
      
      // Увеличиваем read_by_count для всех сообщений в диапазоне от from до to включительно
      setMessages(prevMessages => {
        return prevMessages.map(msg => {
          // Проверяем, что сообщение входит в диапазон и принадлежит текущему пользователю
          if (msg.id >= from && msg.id <= to && msg.author.id === user.id) {
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
  }, [isScrolledToBottom, user.id, activeChannel, convertToExtendedMessage]);

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
              if (message && message.author.id !== user.id && message.status !== MessageStatus.READ) {
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
                setNewMessagesCount(prev => Math.max(0, prev - 1));
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
  }, [messages, user.id, activeChannel]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Очищаем таймеры
      if (readMessagesTimeoutRef.current) {
        clearTimeout(readMessagesTimeoutRef.current);
      }
      
      // Отписываемся от всех подписок при размонтировании компонента
      if (activeChannel && user) {
        console.log(`Component unmounting - unsubscribing from all topics for channel ${activeChannel.id}`);
        
        // Используем функцию отписки от топиков
        unsubscribeFromChannelTopics(activeChannel, user.id, handleNewMessage);
      }
    };
  }, [activeChannel, user, handleNewMessage, unsubscribeFromChannelTopics]);

  // Add effect to handle scroll to bottom
  useEffect(() => {
    if (isScrolledToBottom) {
      setHasNewMessage(false);
      setNewMessagesCount(0);
    }
  }, [isScrolledToBottom]);



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

  const renderMessages = () => (
    <Box 
      ref={messagesContainerRef}
      className="messages-container"
      sx={{ 
        flex: 1, 
        p: 3, 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        position: 'relative',
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
            
            allMessages.forEach((msg, idx) => {
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
                    {isFirstOfGroup ? (
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
                    ) : null}
                  </Box>
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
                            {({ handleSubmit, values, setFieldValue }) => (
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
                                      onClick={(e: React.FormEvent) => {
                                        e.preventDefault();
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
                                      onClick={(e: React.FormEvent) => handleSubmit()}
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
                              {msg.author.id === user.id && (
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
                        
                        {msg.author.id === user.id && (
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

      {/* Scroll to bottom button */}
      <Fade in={showScrollButton}>
        <IconButton
          onClick={handleScrollToBottom}
          sx={{
            position: 'absolute',
            bottom: replyingToMessage ? 160 : 100, // Increased bottom margin when reply panel is visible
            right: 20,
            backgroundColor: 'rgba(30,30,47,0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            '&:hover': {
              backgroundColor: 'rgba(40,40,57,0.95)',
            },
            zIndex: 1000,
            transition: 'bottom 0.2s ease-out', // Smooth transition for position change
          }}
        >
          <KeyboardArrowDownIcon sx={{ color: '#fff' }} />
        </IconButton>
      </Fade>

      {/* Removed duplicate unread messages indicator */}

      {/* New messages count indicator */}
      <Fade in={newMessagesCount > 0 || unreadCount > 0}>
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
              {(newMessagesCount || unreadCount)} {(newMessagesCount || unreadCount) === 1 ? 'новое сообщение' : 'новых сообщений'}
            </Typography>
          </Paper>
        </Box>
      </Fade>

      <Box sx={{ p: 2 }}>
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
                        }
                      }}
                    />
                  </Form>
                  <Stack direction="row" spacing={1}>
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
    </Box>
  );
};

export default MainChatArea;