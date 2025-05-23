import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, IconButton, Paper, Stack, Typography, Fade, Skeleton, Tooltip, Button, Checkbox } from '@mui/material';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ReplyIcon from '@mui/icons-material/Reply';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Channel, Message, ChannelType, useGetMessagesQuery, useLazyGetMessagesQuery, useSearchMessagesQuery, useCreateMessageMutation, useUpdateMessageMutation, useDeleteMessageMutation } from '../../../api/channels';
import UserAvatar from '../../UserAvatar';
import Input from '../../common/Input';
import DOMPurify from 'dompurify';
import { useNotification } from '@/context/NotificationContext';
import { hasPermission } from '@/utils/rolePermissions';
import { useWebSocket } from '@/websocket/useWebSocket';
import { webSocketService } from '@/websocket/WebSocketService';
import AppModal from '../../AppModal';

enum MessageStatus {
  SENT = 0,
  READ = 1,
  NEW = 2
}

interface ExtendedMessage extends Message {
  status: MessageStatus;
  channel_id?: number; // Добавляем channel_id для проверки канала
  // reply field is already inherited from Message interface
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


const MainChatArea: React.FC<MainChatAreaProps> = ({ activeChannel, user, hubId, userPermissions, isOwner }) => {
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<ExtendedMessage | null>(null);
  const replyingToMessageRef = useRef<ExtendedMessage | null>(null);
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTriggeredMiddleMessageIdRef = useRef<number | null>(null);
  const loadMoreDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Поисковые состояния
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchResultsRef = useRef<HTMLDivElement | null>(null);
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Состояние для управления автопрокруткой
  const [disableAutoScroll, setDisableAutoScroll] = useState(false);
  
  // Состояние для навигации к конкретному сообщению
  const [aroundMessageId, setAroundMessageId] = useState<number | null>(null);
  const [aroundMessagesContext, setAroundMessagesContext] = useState<number[]>([]);
  const [isNavigatingToMessage, setIsNavigatingToMessage] = useState(false);
  const [lastNavigatedMessageId, setLastNavigatedMessageId] = useState<number | null>(null);
  const [blockInitialLoad, setBlockInitialLoad] = useState(false);

  // Состояния для заполнения пробелов в пагинации
  const [afterId, setAfterId] = useState<number | null>(null);
  const [isFillingGapDown, setIsFillingGapDown] = useState(false);
  const [isFillingGapUp, setIsFillingGapUp] = useState(false);
  const [gapBoundaries, setGapBoundaries] = useState<{
    lower: number | null;
    upper: number | null;
  }>({ lower: null, upper: null });
  const [isGapFillingActive, setIsGapFillingActive] = useState(false);
  
  const MESSAGES_PER_PAGE = 60;
  
  // Декларации функций объявлены заранее для React useCallback

  const { data: messagesData = [], isLoading } = useGetMessagesQuery(
    activeChannel?.type === ChannelType.TEXT ? {
      channelId: activeChannel?.id ?? 0,
      params: {
        size: MESSAGES_PER_PAGE,
        before: beforeId || undefined,
        around: aroundMessageId || undefined
      }
    } : { channelId: 0, params: {} },
    { 
      skip: !activeChannel || activeChannel.type !== ChannelType.TEXT || 
            (!beforeId && !aroundMessageId && blockInitialLoad),
      refetchOnMountOrArgChange: true // Force refresh on channel change
    }
  );
  
  // Хук для поиска сообщений с использованием API
  const { data: searchResultsData = [], isLoading: isSearchLoading } = useSearchMessagesQuery(
    { 
      channelId: activeChannel?.id ?? 0, 
      search: debouncedSearchQuery 
    },
    { 
      skip: !activeChannel || !debouncedSearchQuery || activeChannel.type !== ChannelType.TEXT
    }
  );

  // Хук для загрузки сообщений с параметром "after" для заполнения пробелов
  const [triggerAfterQuery, { data: afterMessagesData = [], isLoading: isAfterLoading }] = useLazyGetMessagesQuery();

  const [createMessage] = useCreateMessageMutation();
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const { notify } = useNotification();

  const canSendMessages = hasPermission(userPermissions, 'SEND_MESSAGES', isOwner);
  const canManageMessages = hasPermission(userPermissions, 'MANAGE_MESSAGES', isOwner);

  // Функция для определения пробелов между загруженными сообщениями и around-контекстом
  const detectGaps = useCallback((currentMessages: ExtendedMessage[], aroundContext: number[], targetMessageId: number) => {
    console.log('🔍 Detecting gaps:', { currentMessages: currentMessages.length, aroundContext, targetMessageId });
    
    if (currentMessages.length === 0 || aroundContext.length === 0) {
      console.log('❌ No gap detection needed - empty data');
      return { hasGap: false, gapDirection: null, boundaries: { lower: null, upper: null } };
    }

    const currentIds = currentMessages.map(msg => msg.id).sort((a, b) => a - b);
    const minCurrentId = Math.min(...currentIds);
    const maxCurrentId = Math.max(...currentIds);
    const minAroundId = Math.min(...aroundContext);
    const maxAroundId = Math.max(...aroundContext);

    console.log('📊 ID ranges:', { 
      current: [minCurrentId, maxCurrentId], 
      around: [minAroundId, maxAroundId],
      target: targetMessageId 
    });

    // Определяем направление пробела
    let gapDirection: 'up' | 'down' | null = null;
    let boundaries = { lower: null as number | null, upper: null as number | null };

    // Пробел сверху: around-контекст находится выше текущих сообщений
    if (maxAroundId < minCurrentId) {
      gapDirection = 'up';
      boundaries = { lower: maxAroundId, upper: minCurrentId };
      console.log('⬆️ Gap detected UP:', boundaries);
    }
    // Пробел снизу: around-контекст находится ниже текущих сообщений  
    else if (minAroundId > maxCurrentId) {
      gapDirection = 'down';
      boundaries = { lower: maxCurrentId, upper: minAroundId };
      console.log('⬇️ Gap detected DOWN:', boundaries);
    }
    // Пробел посередине: целевое сообщение не пересекается с текущими
    else if (targetMessageId < minCurrentId || targetMessageId > maxCurrentId) {
      if (targetMessageId < minCurrentId) {
        gapDirection = 'up';
        boundaries = { lower: maxAroundId, upper: minCurrentId };
        console.log('⬆️ Gap detected in MIDDLE (up):', boundaries);
      } else {
        gapDirection = 'down';
        boundaries = { lower: maxCurrentId, upper: minAroundId };
        console.log('⬇️ Gap detected in MIDDLE (down):', boundaries);
      }
    }

    const hasGap = gapDirection !== null;
    console.log('✅ Gap detection result:', { hasGap, gapDirection, boundaries });
    
    return { hasGap, gapDirection, boundaries };
  }, []);

  // Функция для очистки состояний заполнения пробелов
  const clearGapFillingState = useCallback(() => {
    console.log('🧹 Clearing gap filling state');
    setAfterId(null);
    setIsFillingGapDown(false);
    setIsFillingGapUp(false);
    setGapBoundaries({ lower: null, upper: null });
    setIsGapFillingActive(false);
  }, []);

  // Функция для отписки от WebSocket топиков канала
  const unsubscribeFromChannelTopics = useCallback((channel: Channel | null, userId: number | null, callback: (message: any) => void) => {
    if (!channel) return;
        
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
    
    // Clear search state (navigation logic removed)
    
    // Сброс состояния поиска
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setSearchMode(false);
    
    // Clear navigation state
    setAroundMessageId(null);
    setAroundMessagesContext([]);
    console.log('Around messages context cleared');
    setFocusedMessageId(null);
    setHighlightedMessages(new Set());
    
    // Разблокируем автопрокрутку и навигацию при смене канала
    setDisableAutoScroll(false);
    setIsNavigatingToMessage(false);
    setLastNavigatedMessageId(null);
    setBlockInitialLoad(false);
    
    // Clear unread state
    setUnreadMessages(new Set());
    setUnreadCount(0);
    setNewMessagesCount(0);
    setHasNewMessage(false);
    
    // Mark all messages as read when entering a channel
    if (activeChannel) {
      webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
    }
  }, [activeChannel?.id]); // Using id instead of the full object

  const scrollToBottom = useCallback((smooth: boolean = false) => {
    return;
  }, []);
  
  // Функция перехода к сообщению удалена

  // Function to scroll to bottom and mark all messages as read
  const handleScrollToBottom = useCallback(() => {
    // Разрешаем автопрокрутку, так как пользователь явно запросил прокрутку вниз
    setDisableAutoScroll(false);
    
    // Scroll to bottom first with smooth animation
    scrollToBottom(true);
    
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
      // reply field is already preserved via spread operator
    };
  }, []);

  // Handle initial messages load
  useEffect(() => {
    if (!activeChannel || activeChannel.type !== ChannelType.TEXT) return;
    
    if (aroundMessageId && !isLoading) {
      // Сначала проверяем, есть ли сообщение уже на текущей странице
      const currentMessageIds = messages.map(m => m.id);
      const messageAlreadyExists = currentMessageIds.includes(aroundMessageId);
      
      if (messageAlreadyExists) {        
        // Блокируем все автопрокрутки
        setIsNavigatingToMessage(true);
        setDisableAutoScroll(true);
        
        // Запоминаем ID сообщения, к которому перешли
        setLastNavigatedMessageId(aroundMessageId);
        
        // Подсвечиваем сообщение
        setHighlightedMessages(new Set([aroundMessageId]));
        
        // Убираем подсветку через 1.5 секунды, но НЕ разблокируем навигацию
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedMessages(new Set());
          setFocusedMessageId(null);
          setAroundMessageId(null);
          // НЕ разблокируем isNavigatingToMessage - пользователь должен сам начать скроллить
          highlightTimeoutRef.current = null;
        }, 1500);
        
        setTimeout(() => {
          const messageElement = document.querySelector(`[data-msg-id="${aroundMessageId}"]`);
          if (messageElement) {
            messageElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
            console.log(`Scrolled to existing message ${aroundMessageId}`);
          }
        }, 100);
        
        return; // Выходим из функции, не делаем запрос around
      }
      
      // Если сообщения нет на странице, делаем запрос around
      // Получаем ID из новых данных с around
      const newAroundIds = messagesData.map(m => m.id);
      
      // Проверяем, есть ли целевое сообщение в полученных данных
      const hasTargetMessage = newAroundIds.includes(aroundMessageId);
      
      if (hasTargetMessage) {
        // Проверяем, есть ли эти сообщения уже в текущих messages
        const isNewContext = !newAroundIds.every(id => currentMessageIds.includes(id));
        
        if (isNewContext) {
          console.log("Loading around context for message:", aroundMessageId);
          console.log("New around messages:", newAroundIds);
          setAroundMessagesContext(newAroundIds);
          console.log('Around messages context updated:', newAroundIds);
        }
      }
    }

    // Set empty  messages array when data is empty
    if (!messagesData || messagesData.length === 0) {
      setMessages([]);
      // Scroll to bottom even when no messages (но только если не навигируемся к сообщению)
      if (!aroundMessageId) {
        setTimeout(() => {
          scrollToBottom(false); // Use instant scrolling for initial load
        }, 50);
      }
      return;
    }
    
    // Only set messages on initial load (when beforeId is null) or when navigating to specific message
    if (beforeId === null || aroundMessageId !== null) {
      const newExtendedMessages = messagesData.map(convertToExtendedMessage);
      
      // For initial load, also use Map to handle any potential existing messages
      // Create map for messages with ID as key
      const messagesMap = new Map<number, ExtendedMessage>();
      
      // First add any existing messages (though there shouldn't be any for initial load)
      if (messages.length > 0) {
        messages.forEach(msg => {
          if (typeof msg.id === 'number' && msg.id > 0) {
            messagesMap.set(msg.id, msg);
          }
        });
      }
      
      // Then add new messages, replacing any duplicates
      newExtendedMessages.forEach(msg => {
        if (typeof msg.id === 'number' && msg.id > 0) {
          messagesMap.set(msg.id, msg);
        }
      });
      
      // Convert map back to array and sort by creation date
      const mergedMessages = Array.from(messagesMap.values())
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      setMessages(mergedMessages);
      messagesLengthRef.current = mergedMessages.length;
      
      // Reset disableAutoScroll on initial channel load
      setDisableAutoScroll(false);
      
      // Check for unread messages in initial load
      const unreadMessages = mergedMessages.filter(
        msg => msg.status === MessageStatus.NEW && msg.author.id !== user.id
      );
      
      if (unreadMessages.length > 0) {
        setUnreadMessages(new Set(unreadMessages.map(msg => msg.id)));
        setUnreadCount(unreadMessages.length);
      }
      
      // Scroll to bottom after loading initial messages with delay for DOM to settle
      // Но только если мы не навигируемся к конкретному сообщению
      if (!aroundMessageId) {
        setTimeout(() => {
          scrollToBottom(false); // Use instant scrolling for initial load
        }, 150);
      }
    }
  }, [activeChannel, messagesData, beforeId, aroundMessageId, convertToExtendedMessage, user.id, scrollToBottom]);

  // Auto-scroll to bottom when changing channels (with or without messages)
  useEffect(() => {
    if (activeChannel && !beforeId && !aroundMessageId) {
      // Give DOM time to render
      const timeoutId = setTimeout(() => {
        scrollToBottom(false); // Use instant scrolling when changing channels
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [activeChannel?.id, beforeId, aroundMessageId, scrollToBottom]);

  // Effect to scroll to focused message when using "around" parameter
  useEffect(() => {
    if (aroundMessageId && focusedMessageId && messagesData.length > 0) {
      // Блокируем все автопрокрутки во время навигации
      setIsNavigatingToMessage(true);
      setDisableAutoScroll(true);
      
      // Find the target message in the DOM and scroll to it
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-msg-id="${focusedMessageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          console.log(`Scrolled to message ${focusedMessageId}`);
          
          // Сбрасываем aroundMessageId через 1.5 секунды, но НЕ разблокируем навигацию
          setTimeout(() => {
            setAroundMessageId(null);
            // НЕ разблокируем isNavigatingToMessage - пользователь должен сам начать скроллить
          }, 1500);
        }
      }, 200); // Give DOM time to render
    }
  }, [aroundMessageId, focusedMessageId, messagesData]);

  // Reset lastTriggeredMiddleMessageIdRef when aroundMessagesContext changes
  useEffect(() => {
    lastTriggeredMiddleMessageIdRef.current = null;
    console.log('Reset lastTriggeredMiddleMessageIdRef due to aroundMessagesContext change');
  }, [aroundMessagesContext]);

  // Add effect to focus input when chat is opened
  useEffect(() => {
    if (activeChannel && inputRef.current) {
      inputRef.current.focus();
      // Place cursor at the end
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [activeChannel]);
  
  // Обработчик нажатия Ctrl+F для активации поиска
  useEffect(() => {
    if (!activeChannel) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Если пользователь нажимает Ctrl+F
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault(); // Предотвращаем стандартное поведение браузера
        
        // Активируем режим поиска
        setSearchMode(true);
        
        // Фокусируемся на поле ввода после небольшой задержки для отрисовки UI
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 100);
      }
      
      // Закрытие поиска по Escape
      if (e.key === 'Escape' && searchMode) {
        setSearchMode(false);
        setHighlightedMessages(new Set());
        setFocusedMessageId(null);
        // Разблокируем автопрокрутку при закрытии поиска
        setDisableAutoScroll(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeChannel, searchMode]);

  // Add effect to focus edit input when editing starts
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
      // Place cursor at the end
      const length = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(length, length);
    }
  }, [editingMessageId]);

  // Update ref whenever replyingToMessage changes
  useEffect(() => {
    replyingToMessageRef.current = replyingToMessage;
  }, [replyingToMessage]);

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
    
    // Declare tempId and capture reply message outside try block
    const tempId = Date.now();
    const replyMessage = replyingToMessageRef.current; // Use ref to get current value
    
    console.log('Reply message at start:', replyMessage);
    console.log('Reply message ID:', replyMessage?.id);
    
    try {
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
        reply: replyMessage || undefined // Преобразуем null в undefined
      };
      
      // Add temporary message to the UI
      setTempMessages(prev => {
        const newMap = new Map(prev);
        newMap.set(String(tempId), tempMessage);
        return newMap;
      });
      
      
      resetForm();

      // Send the message to the server
      const apiPayload = {
        channelId: activeChannel.id,
        content: values.content,
        ...(replyMessage?.id ? { replyId: replyMessage.id } : {})
      };
      console.log('API payload:', apiPayload);
      
      const result = await createMessage(apiPayload).unwrap();
      
      // Clear the reply state after successful sending
      setReplyingToMessage(null);
      
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
        reply: result.reply // Use the reply from the server response
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      // No need to scroll again here as we already scrolled after adding the temporary message
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove the temporary message on error
      setTempMessages(prev => {
        const newMap = new Map(prev);
        newMap.delete(String(tempId));
        return newMap;
      });
      
      // Clear the reply state on error
      setReplyingToMessage(null);
      
      // Type guard for error object
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403 && 'data' in error && typeof error.data === 'object' && error.data !== null && 'type' in error.data && error.data.type === 'ACCESS_DENIED') {
        notify('Недостаточно прав для отправки сообщения', 'error');
      } else {
        notify('Ошибка при отправке сообщения', 'error');
      }
    }
  }, [activeChannel, user, createMessage, focusMessageInput, notify, scrollToBottom]);

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

  const handleDeleteMessage = useCallback((messageId: number) => {
    setMessageToDelete(messageId);
    setDeleteModalOpen(true);
    setDeleteForEveryone(false);
    
    // Find the message to check if it belongs to the current user
    const message = messages.find(msg => msg.id === messageId);
    // We'll use this info in the modal to determine if we should show the "Delete for everyone" option
  }, [messages]);
  
  const confirmDeleteMessage = useCallback(async () => {
    if (!activeChannel || !messageToDelete) return;
    
    // Находим сообщение, которое будем удалять
    const messageToDeleteObj = messages.find(msg => msg.id === messageToDelete);
    if (!messageToDeleteObj) return;
    
    // Закрываем модалку
    setDeleteModalOpen(false);
    
    // Оптимистично удаляем сообщение из UI и обновляем ответы на это сообщение
    setMessages(prev => {
      // Удаляем само сообщение
      const filtered = prev.filter(m => m.id !== messageToDelete);
      
      // Обновляем все сообщения, которые были ответами на удаленное сообщение
      return filtered.map(msg => {
        if (msg.reply && msg.reply.id === messageToDelete) {
          // Если это был ответ на удаленное сообщение, убираем ссылку на ответ
          return { ...msg, reply: undefined };
        }
        return msg;
      });
    });
    
    try {
      // Отправляем запрос на удаление на сервер с параметром forEveryone, если нужно
      await deleteMessage({
        channelId: activeChannel.id,
        messageId: messageToDelete,
        forEveryone: deleteForEveryone
      }).unwrap();
      
      // Если успешно, ничего дополнительно не делаем, т.к. уже удалили сообщение из UI
      
    } catch (error) {
      console.error('Ошибка при удалении сообщения', error);
      
      // Возвращаем сообщение обратно в список и восстанавливаем ссылки на него в случае ошибки
      setMessages(prev => {
        // Проверяем, что сообщение еще не было добавлено обратно
        if (!prev.some(m => m.id === messageToDelete)) {
          // Находим правильную позицию для вставки сообщения
          const messages = [...prev];
          const index = messages.findIndex(m => new Date(m.created_at) > new Date(messageToDeleteObj.created_at));
          
          if (index === -1) {
            // Если это самое новое сообщение, добавляем в конец
            messages.push(messageToDeleteObj);
          } else {
            // Вставляем сообщение в нужную позицию
            messages.splice(index, 0, messageToDeleteObj);
          }
          
          // Восстанавливаем ссылки на это сообщение в ответах
          return messages.map(msg => {
            if (msg.reply && msg.reply.id === messageToDelete) {
              // Восстанавливаем полную информацию об ответе
              return { ...msg, reply: messageToDeleteObj };
            }
            return msg;
          });
        }
        return prev;
      });
      
      // Показываем уведомление об ошибке
      notify('Ошибка при удалении сообщения', 'error');
    }
    
    // Очищаем состояние
    setMessageToDelete(null);
    setDeleteForEveryone(false);
  }, [activeChannel, deleteMessage, messages, notify, messageToDelete, deleteForEveryone]);

  // Функция для навигации к конкретному сообщению
  const handleNavigateToMessage = useCallback((messageId: number) => {
    // Блокируем все автопрокрутки во время навигации к сообщению
    setIsNavigatingToMessage(true);
    setDisableAutoScroll(true);
    setBlockInitialLoad(true); // Блокируем initial load
    
    // Запоминаем ID сообщения, к которому перешли
    setLastNavigatedMessageId(messageId);
    
    // Очищаем предыдущие состояния и устанавливаем aroundMessageId одновременно
    // React 18 автоматически batch'ит эти вызовы, но для надежности делаем их подряд
    React.startTransition(() => {
      setBeforeId(null);
      setAroundMessageId(messageId);
    });
    
    // Устанавливаем фокус на сообщение
    setFocusedMessageId(messageId);
    
    // Подсвечиваем сообщение
    setHighlightedMessages(new Set([messageId]));
    
    // Убираем подсветку через 1.5 секунды, но НЕ разблокируем навигацию
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessages(new Set());
      setFocusedMessageId(null);
      // НЕ разблокируем isNavigatingToMessage - пользователь должен сам начать скроллить
      highlightTimeoutRef.current = null;
    }, 1500);
    
    console.log(`Navigating to message ID: ${messageId}`);
  }, []);

  // Handle scroll and date label display
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // (Navigation tracking removed)
    
    const handleScroll = () => {
      // Clear any existing timeout
      if (dateLabelTimeoutRef.current) {
        clearTimeout(dateLabelTimeoutRef.current);
      }

      // Check if we should show scroll button
      setShowScrollButton(container.scrollTop + container.clientHeight < container.scrollHeight - 400);
      
      // Проверяем наличие флагов блокировки пагинации
      const isPaginationBlocked = isLoadingMoreRef.current;
      
      // Загружаем больше сообщений только если не заблокирована пагинация
      if (container.scrollTop < container.scrollHeight / 4 && !isPaginationBlocked && hasMoreMessages && messagesData.length > 0) {
        // Only load more if the previous response had exactly MESSAGES_PER_PAGE messages
        if (messagesData.length === MESSAGES_PER_PAGE) {
          isLoadingMoreRef.current = true;
          
          // (Jump tracking removed)
          
          // Enable disableAutoScroll when manually scrolling up to load more
          setDisableAutoScroll(false);
          // Get the ID of the oldest message in the current view
          const oldestMessage = messagesData[messagesData.length - 1];
          if (oldestMessage) {
            // setBeforeId(oldestMessage.id);
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

    container.addEventListener('scroll', handleScroll, { passive: true });
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
      
      console.log('Processing additional loaded messages for beforeId:', beforeId);
      console.log('Current messages count before pagination:', messages.length);
      
      // (Search jump logic removed)
  
      // Store the scroll height and scroll position BEFORE adding new messages
      const scrollHeightBefore = container.scrollHeight;
      const scrollPositionBefore = container.scrollTop;
      
      // Check if we received less messages than requested
      if (messagesData.length < MESSAGES_PER_PAGE) {
        setHasMoreMessages(false);
      }
  
      // Temporarily set disableAutoScroll to prevent automatic scrolling to bottom
      setDisableAutoScroll(true);
      
      // Convert new messages to ExtendedMessage
      const newExtendedMessages = messagesData.map(convertToExtendedMessage);
      
      // Update the messages with proper Map-based deduplication
      setMessages((prev: ExtendedMessage[]) => {
        // Create a map for all messages with ID as key
        const messagesMap = new Map<number, ExtendedMessage>();
        
        // First add all existing messages
        prev.forEach(msg => {
          if (typeof msg.id === 'number' && msg.id > 0) {
            messagesMap.set(msg.id, msg);
          }
        });
        
        // Then add new messages, replacing any duplicates
        newExtendedMessages.forEach(msg => {
          if (typeof msg.id === 'number' && msg.id > 0) {
            messagesMap.set(msg.id, msg);
          }
        });
        
        // Convert map back to array and sort by creation date
        const mergedMessages = Array.from(messagesMap.values())
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        console.log(`Pagination: Combined ${prev.length} existing and ${newExtendedMessages.length} new messages into ${mergedMessages.length} total`);
        
        return mergedMessages;
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
          console.log('Adjusting scroll position:', {
            before: scrollPositionBefore,
            after: scrollPositionBefore + heightAdded,
            heightAdded
          });
          
          container.scrollTop = scrollPositionBefore + heightAdded;
          
          isLoadingMoreRef.current = false;
        });
      });
    }
  }, [messagesData, beforeId, convertToExtendedMessage, messages.length]);

  // Добавляем эффект для debounce поискового запроса
  useEffect(() => {
    // Очищаем предыдущий таймер, если он был
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    
    // Если строка поиска пустая, сразу устанавливаем пустой debouncedSearchQuery
    if (!searchQuery.trim()) {
      setDebouncedSearchQuery('');
      return;
    }
    
    // Устанавливаем новый таймер для debounce (300ms)
    searchDebounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      // Показываем результаты поиска после установки debounced значения
      setShowSearchResults(true);
    }, 300);
    
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Обработчик для сообщений, загруженных с параметром "after"
  useEffect(() => {
    if (afterMessagesData && afterMessagesData.length > 0) {      
      // Временно блокируем автоскролл во время обработки after сообщений
      setDisableAutoScroll(true);
      console.log("swag", afterMessagesData, messages);
      // Проверяем на дублирование с уже загруженными сообщениями  
      const existingMessageIds = new Set(messages.map(msg => msg.id));
      const newMessages = afterMessagesData.filter(msg => !existingMessageIds.has(msg.id));
      const duplicateMessages = afterMessagesData.filter(msg => existingMessageIds.has(msg.id));

      if (duplicateMessages.length > 0) {
          // Не очищаем контекст полностью, а фильтруем только обработанные сообщения
          const remainingContext = aroundMessagesContext.filter(
              id => id > afterId
          );
          setAroundMessagesContext(remainingContext);
          setAfterId(null);
          setDisableAutoScroll(false);
          return;
      }
      
      if (newMessages.length > 0) {
        const newExtendedMessages = newMessages.map(convertToExtendedMessage);
        
        // Обновляем сообщения
        setMessages(currentMessages => {
          // Создаем Map для эффективного объединения
          const messagesMap = new Map<number, ExtendedMessage>();
          
          // Добавляем существующие сообщения
          currentMessages.forEach(msg => {
            if (typeof msg.id === 'number' && msg.id > 0) {
              messagesMap.set(msg.id, msg);
            }
          });
          
          console.log('📥 Добавляем новые сообщения:', newExtendedMessages.map(m => m.id));
          
          // Добавляем новые сообщения
          newExtendedMessages.forEach(msg => {
            if (typeof msg.id === 'number' && msg.id > 0) {
              messagesMap.set(msg.id, msg);
            }
          });
          
          // Преобразуем обратно в массив и сортируем
          const result = Array.from(messagesMap.values()).sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          
          console.log('✨ setMessages result: всего сообщений:', result.length);
          return result;
        });
        
        // Обновляем aroundMessagesContext - заменяем на новые ID полученных сообщений
        const newMessageIds = newMessages.map(msg => msg.id);
        setAroundMessagesContext(newMessageIds);
      } else {
        console.log('❌ Нет новых сообщений для добавления');
      }
      
      setDisableAutoScroll(false);
      setAfterId(null);
    }
  }, [afterMessagesData, convertToExtendedMessage]);

  // Sort messages for display in the chat
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages]);
  
  // Используем результаты поиска из API напрямую
  const searchResults = useMemo(() => {
    if (!searchMode || !debouncedSearchQuery) {
      return [];
    }
    
    // Возвращаем результаты, полученные через API
    return searchResultsData;
  }, [searchMode, debouncedSearchQuery, searchResultsData]);

  // Add effect to track scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Для обнаружения намеренного скролла вверх
    let lastScrollTop = container.scrollTop;
    let intentionalScrollUp = false;
    let scrollMovementStartTime = 0;
    let isUserScrolling = false; // Flag to track if user is actively scrolling
    let scrollTimeoutId: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // Разблокируем навигацию когда пользователь начинает скроллить
      if (isNavigatingToMessage) {
        setIsNavigatingToMessage(false);
      }
      
      // Проверяем, если пользователь ушел далеко от сообщения - сбрасываем lastNavigatedMessageId
      if (lastNavigatedMessageId) {
        const targetElement = document.querySelector(`[data-msg-id="${lastNavigatedMessageId}"]`);
        if (targetElement) {
          const container = messagesContainerRef.current!;
          const targetRect = targetElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Если сообщение не видно, сбрасываем lastNavigatedMessageId
          const isVisible = targetRect.bottom > containerRect.top && targetRect.top < containerRect.bottom;
          if (!isVisible) {
            setLastNavigatedMessageId(null);
          }
        }
      }
      
      // Clear previous timeout if exists
      if (scrollTimeoutId) {
        clearTimeout(scrollTimeoutId);
      }

      // Set user scrolling flag
      isUserScrolling = true;

      const currentScrollTop = container.scrollTop;
      const scrollPosition = container.scrollHeight - currentScrollTop - container.clientHeight;
      const isAtBottom = scrollPosition < 100;
      
      // Определяем направление скролла
      if (currentScrollTop < lastScrollTop) {
        // Скролл вверх
        if (!intentionalScrollUp) {
          intentionalScrollUp = true;
          scrollMovementStartTime = Date.now();
        }
      } else if (currentScrollTop > lastScrollTop) {
        // Скролл вниз
        if (isAtBottom) {
          intentionalScrollUp = false;
        }
      }
      
      // Проверяем пересечение viewport с сообщением на 25% от начала aroundMessagesContext при скролле вниз      
      if (aroundMessagesContext.length > 0 && currentScrollTop > lastScrollTop) {
        // Находим индекс на 25% от начала массива
        const quarterIndex = Math.floor(aroundMessagesContext.length * 0.25);
        const quarterAroundMessageId = aroundMessagesContext[quarterIndex];
        const quarterAroundMessageElement = document.querySelector(`[data-msg-id="${quarterAroundMessageId}"]`);
        
        if (quarterAroundMessageElement) {
          const containerRect = container.getBoundingClientRect();
          const messageRect = quarterAroundMessageElement.getBoundingClientRect();
          
          // Проверяем, пересекается ли сообщение с viewport
          const isIntersecting = messageRect.bottom > containerRect.top && messageRect.top < containerRect.bottom;
          
          if (isIntersecting && lastTriggeredMiddleMessageIdRef.current !== quarterAroundMessageId) {
            // Отменяем предыдущий таймер если он существует
            if (loadMoreDebounceRef.current) {
              clearTimeout(loadMoreDebounceRef.current);
            }
            
            // Устанавливаем новый таймер с дебаунсом
            loadMoreDebounceRef.current = setTimeout(() => {
              // Запоминаем ID, чтобы не триггерить повторно для того же сообщения
              lastTriggeredMiddleMessageIdRef.current = quarterAroundMessageId;
              
              // Но передаем последний ID для загрузки сообщений после него
              const lastAroundMessageId = aroundMessagesContext[aroundMessagesContext.length - 1];
              console.log('🎯 25% message reached, triggering lazy query with after:', lastAroundMessageId);
              triggerAfterQuery({
                channelId: activeChannel?.id ?? 0,
                params: {
                  size: MESSAGES_PER_PAGE,
                  after: lastAroundMessageId
                }
              });
            }, 300); // 300ms дебаунс
          }
        }
      }
      
      // Обновляем последнюю позицию скролла ПОСЛЕ проверки
      lastScrollTop = currentScrollTop;
      
      // Устанавливаем состояние только если юзер не скроллит вверх или прошло достаточно времени
      const scrollTimeElapsed = Date.now() - scrollMovementStartTime;
      if (!intentionalScrollUp || scrollTimeElapsed > 1000) {
        setIsScrolledToBottom(isAtBottom);
      }
      
      // If scrolled to bottom, mark all messages as read and re-enable auto-scroll
      if (isAtBottom && activeChannel) {
        // Если пользователь прокрутил до конца вручную, снова включаем автопрокрутку
        setDisableAutoScroll(false);
        
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
      
      // Set a timeout to determine when scrolling has stopped
      scrollTimeoutId = setTimeout(() => {
        isUserScrolling = false;
        scrollTimeoutId = null;
      }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      // Очищаем таймер дебаунса при размонтировании
      if (loadMoreDebounceRef.current) {
        clearTimeout(loadMoreDebounceRef.current);
      }
    };
  }, [activeChannel, isNavigatingToMessage, lastNavigatedMessageId, aroundMessagesContext]);

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
            
            if (activeChannel) {
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

        // Remove the message and update replies to that message
        const filtered = prevMessages.filter(msg => msg.id !== messageId);
        
        // Update all messages that were replies to the deleted message
        return filtered.map(msg => {
          if (msg.reply && msg.reply.id === messageId) {
            // If this was a reply to the deleted message, remove the reply reference
            return { ...msg, reply: undefined };
          }
          return msg;
        });
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

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Очищаем таймеры
      if (readMessagesTimeoutRef.current) {
        clearTimeout(readMessagesTimeoutRef.current);
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      
      // Отписываемся от всех подписок при размонтировании компонента
      if (activeChannel && user) {        
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

  // Handle search mode changes
  useEffect(() => {
    if (!searchMode) {
      // When search mode is disabled, clear search results
      setSearchQuery('');
      setShowSearchResults(false);
      
      // After exiting search, make sure UI is in a good state
      // Но только если мы не находимся в режиме навигации к сообщению
      if (!aroundMessageId && !focusedMessageId) {
        setTimeout(() => {
          // If we're near the bottom, scroll to bottom
          if (messagesContainerRef.current) {
            const { scrollHeight, scrollTop, clientHeight } = messagesContainerRef.current;
            const scrollPosition = scrollHeight - scrollTop - clientHeight;
            if (scrollPosition < 200) {
              scrollToBottom(true);
            }
          }
        }, 100);
      }
    }
  }, [searchMode, aroundMessageId, focusedMessageId, scrollToBottom]);
  
  // Handle click outside to close search results dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showSearchResults &&
        searchResultsRef.current &&
        searchInputRef.current &&
        !searchResultsRef.current.contains(event.target as Node) &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);



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
          {searchMode && searchQuery.trim() ? (
            <>
              <Typography variant="h6">
                Нет результатов поиска
              </Typography>
              <Typography variant="body2">
                Попробуйте изменить поисковый запрос
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="h6">
                Нет сообщений
              </Typography>
              <Typography variant="body2">
                Начните общение, отправив первое сообщение
              </Typography>
            </>
          )}
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
                    transition: 'background-color 0.3s ease, box-shadow 0.5s ease',
                    opacity: isTempMessage ? 0.6 : 1,
                    backgroundColor: focusedMessageId === msg.id
                      ? 'rgba(0, 207, 255, 0.25)' // Bright blue highlight for focused message (reply source)
                      : highlightedMessages.has(msg.id)
                        ? 'rgba(33, 150, 243, 0.25)' // Bright blue highlight for search results
                        : unreadMessages.has(msg.id)
                          ? 'rgba(25,118,210,0.1)' // Blue for unread messages
                          : 'transparent',
                    '&.highlight-pulse': {
                      animation: 'pulse 2s infinite',
                    },
                    '&:hover': {
                      backgroundColor: focusedMessageId === msg.id
                        ? 'rgba(0, 207, 255, 0.35)'
                        : highlightedMessages.has(msg.id)
                          ? 'rgba(33, 150, 243, 0.35)'
                          : unreadMessages.has(msg.id) 
                            ? 'rgba(25,118,210,0.15)' 
                            : 'rgba(255,255,255,0.05)',
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
                        {msg.reply && (
                          <Box 
                            sx={{ 
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1,
                              mb: 1,
                              cursor: 'pointer',
                              p: '4px 8px',
                              width: '100%',
                              ml: -1,
                              mr: -1,
                              borderRadius: 1,
                              backgroundColor: 'rgba(0, 207, 255, 0.05)',
                              borderLeft: '3px solid #00CFFF',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 207, 255, 0.1)'
                              }
                            }}
                            onClick={() => {
                              // Find and scroll to the original message
                              const messageElement = document.querySelector(`[data-msg-id='${msg.reply!.id}']`);
                              if (messageElement) {
                                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                
                                // Clear any existing highlight timeout
                                if (highlightTimeoutRef.current) {
                                  clearTimeout(highlightTimeoutRef.current);
                                  highlightTimeoutRef.current = null;
                                }
                                
                                // Clear existing highlights and focused message
                                setFocusedMessageId(null);
                                setHighlightedMessages(new Set());
                                
                                // Highlight the new message
                                setFocusedMessageId(msg.reply!.id);
                                
                                // Add to highlighted set for visual effect
                                setHighlightedMessages(prev => {
                                  const newSet = new Set<number>();
                                  newSet.add(msg.reply!.id);
                                  return newSet;
                                });
                                
                                // Remove highlight after 1.5 seconds
                                highlightTimeoutRef.current = setTimeout(() => {
                                  setHighlightedMessages(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(msg.reply!.id);
                                    return newSet;
                                  });
                                  setFocusedMessageId(null);
                                  highlightTimeoutRef.current = null;
                                }, 1500);
                              }
                            }}
                          >
                            <ReplyIcon sx={{ color: '#00CFFF', fontSize: '0.85rem', mt: '2px' }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ color: '#00CFFF', fontWeight: 600, fontSize: '0.85rem', mb: 0.25 }}>
                                {msg.reply.author.login}
                              </Typography>
                              <Typography 
                                sx={{ 
                                  color: 'rgba(255,255,255,0.6)', 
                                  fontSize: '1rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical'
                                }}
                              >
                                {msg.reply.content}
                              </Typography>
                            </Box>
                          </Box>
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
                                  (() => {
                                    // Process content to highlight search terms
                                    let content = msg.content.replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
                                    
                                    // Highlight search terms if in search mode with non-empty query
                                    if (searchMode && searchQuery.trim()) {
                                      const query = searchQuery.trim();
                                      // Escape special regex characters in the search query
                                      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                      // Create a regular expression that matches the whole word case-insensitive
                                      const regex = new RegExp(`(${escapedQuery})`, 'gi');
                                      // Replace with highlighted version
                                      content = content.replace(regex, '<span style="background-color: rgba(0, 207, 255, 0.3); color: #fff; border-radius: 2px; padding: 0; font-weight: 600;">$1</span>');
                                    }
                                    
                                    return content;
                                  })()
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
                        <Tooltip title="Ответить" enterDelay={1000} placement="top">
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              console.log('Setting reply message:', msg);
                              setReplyingToMessage(msg);
                              focusMessageInput();
                            }} 
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
                        </Tooltip>
                        
                        {/* Edit button only for user's own messages */}
                        {msg.author.id === user.id && (
                          <Tooltip title="Редактировать" enterDelay={1000} placement="top">
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
                          </Tooltip>
                        )}
                        
                        {/* Delete button for all messages */}
                        <Tooltip title="Удалить" enterDelay={1000} placement="top">
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
                        </Tooltip>
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
          
          {/* Loading indicator when fetching more messages after aroundMessagesContext */}
          {isAfterLoading && aroundMessagesContext.length > 0 && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              py: 3,
              gap: 2
            }}>
              <Box sx={{
                display: 'flex',
                gap: 1
              }}>
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0, 207, 255, 0.8)',
                      animation: 'pulse 1.4s ease-in-out infinite',
                      animationDelay: `${i * 0.16}s`,
                      '@keyframes pulse': {
                        '0%, 60%, 100%': {
                          transform: 'scale(0.8)',
                          opacity: 0.5
                        },
                        '30%': {
                          transform: 'scale(1.1)',
                          opacity: 1
                        }
                      }
                    }}
                  />
                ))}
              </Box>
              <Typography sx={{ 
                color: 'rgba(255,255,255,0.6)', 
                fontSize: '0.9rem'
              }}>
                Загрузка сообщений...
              </Typography>
            </Box>
          )}
          
          {/* For properly tracking the end of messages for scrolling */}
          <div ref={messagesEndRef} />
        </>
      )}
    </Box>
  );

  // Removed search navigator
  
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
      {/* Delete Message Modal */}
      <AppModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setMessageToDelete(null);
          setDeleteForEveryone(false);
        }}
        title="Удалить сообщение"
      >
        <Box sx={{ 
          p: 2, 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {messageToDelete && (() => {
            const message = messages.find(msg => msg.id === messageToDelete);
            const isOwnMessage = message && message.author.id === user.id;
            const showDeleteForEveryoneOption = isOwnMessage || canManageMessages;
            
            return (
              <Box sx={{ mb: 3, width: '100%', maxWidth: 300 }}>
                {showDeleteForEveryoneOption && (
                  <Box 
                    onClick={() => setDeleteForEveryone(!deleteForEveryone)}
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 1.5,
                      mb: 1.5,
                      borderRadius: 2,
                      cursor: 'pointer',
                      backgroundColor: deleteForEveryone ? 'rgba(255, 61, 113, 0.1)' : 'rgba(0,0,0,0.15)',
                      border: `1px solid ${deleteForEveryone ? 'rgba(255, 61, 113, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: deleteForEveryone ? 'rgba(255, 61, 113, 0.15)' : 'rgba(0,0,0,0.2)',
                        transform: 'translateY(-2px)',
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <Checkbox
                        checked={deleteForEveryone}
                        onChange={(e) => setDeleteForEveryone(e.target.checked)}
                        sx={{ 
                          color: 'rgba(255,255,255,0.5)',
                          p: 0.5,
                          mr: 1,
                          '&.Mui-checked': {
                            color: '#FF3D71',
                          }
                        }}
                      />
                      <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                        Удалить у всех
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255,255,255,0.6)', 
                      fontStyle: 'italic',
                      fontSize: '0.75rem',
                      textAlign: 'center'
                    }}>
                      {deleteForEveryone 
                        ? "Сообщение исчезнет у всех участников чата" 
                        : "Сообщение останется видимым для других"}
                    </Typography>
                  </Box>
                )}
                
                <Typography sx={{ 
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  mt: 1
                }}>
                  {!showDeleteForEveryoneOption 
                    ? "Сообщение будет скрыто только для вас" 
                    : deleteForEveryone 
                      ? "" 
                      : "Сообщение будет скрыто только в вашем интерфейсе"}
                </Typography>
              </Box>
            );
          })()}
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => {
                setDeleteModalOpen(false);
                setMessageToDelete(null);
                setDeleteForEveryone(false);
              }}
              sx={{
                color: 'rgba(255,255,255,0.7)',
                borderColor: 'rgba(255,255,255,0.2)',
                borderRadius: 2,
                px: 3,
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.4)',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={confirmDeleteMessage}
              sx={{
                backgroundColor: '#FF3D71',
                color: '#fff',
                borderRadius: 2,
                px: 3,
                '&:hover': {
                  backgroundColor: '#FF1744',
                },
              }}
            >
              Удалить
            </Button>
          </Box>
        </Box>
      </AppModal>
      <Box sx={{ 
        height: 60, 
        px: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
          {activeChannel?.name || 'Select a channel'}
        </Typography>
        
        {searchMode ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            position: 'relative',
            zIndex: 1050
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              background: 'rgba(255,255,255,0.05)',
              borderRadius: showSearchResults && searchQuery.trim() && searchResults.length > 0 ? '20px 20px 0 0' : '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderBottom: showSearchResults && searchQuery.trim() && searchResults.length > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)',
              paddingLeft: 2,
              paddingRight: 1,
              width: '300px',
              transition: 'all 0.3s ease'
            }}>
              <Formik
                initialValues={{ query: searchQuery }}
                onSubmit={() => {}}
                enableReinitialize
              >
                {({ values, setFieldValue }) => (
                  <Form style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                      <Field name="query">
                        {({ field, form }: any) => (
                          <input
                            {...field}
                            ref={searchInputRef}
                            onChange={(e) => {
                              // Use Formik's field.onChange which will handle setting the value in form state
                              field.onChange(e);
                              
                              // Update our local state for integration with non-Formik components
                              setSearchQuery(e.target.value);
                              
                              // Check if we should show search results
                              const hasResults = e.target.value.trim() && messages.filter(msg => 
                                msg.content.toLowerCase().includes(e.target.value.toLowerCase().trim()) || 
                                msg.author.login.toLowerCase().includes(e.target.value.toLowerCase().trim())
                              ).length > 0;
                              
                              setShowSearchResults(hasResults ? true : false);
                            }}
                            onFocus={() => {
                              // Show results when focusing if we already have results
                              if (field.value?.trim() && searchResults.length > 0) {
                                setShowSearchResults(true);
                              }
                            }}
                            onBlur={(e) => {
                              // Prevent default Formik blur handling which can reset value
                              e.preventDefault();
                            }}
                            placeholder="Поиск сообщений..."
                            style={{
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: '#fff',
                              width: '100%',
                              fontSize: '0.9rem',
                              padding: '8px 0'
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                if (showSearchResults) {
                                  setShowSearchResults(false);
                                } else {
                                  setSearchMode(false);
                                  setSearchQuery('');
                                  form.resetForm();
                                  // Разблокируем автопрокрутку
                                  setDisableAutoScroll(false);
                                }
                              }
                            }}
                          />
                        )}
                      </Field>
                      {searchQuery.trim() && (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            position: 'absolute',
                            right: 0,
                            top: '-18px',
                            color: searchResults.length > 0 ? '#00FFBA' : '#FF69B4',
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(0,0,0,0.3)'
                          }}
                        >
                          {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
                        </Typography>
                      )}
                    </Box>
                    <IconButton 
                      type="button"
                      size="small" 
                      onClick={() => {
                        if (showSearchResults) {
                          setShowSearchResults(false);
                        } else {
                          setSearchMode(false);
                          setSearchQuery('');
                          setFieldValue('query', '');
                          // Разблокируем автопрокрутку
                          setDisableAutoScroll(false);
                        }
                      }}
                      sx={{ 
                        color: 'rgba(255,255,255,0.5)',
                        '&:hover': {
                          color: 'rgba(255,255,255,0.9)',
                          background: 'rgba(255,255,255,0.1)'
                        }
                      }}
                    >
                      {showSearchResults ? <KeyboardArrowDownIcon fontSize="small" /> : <CloseIcon fontSize="small" />}
                    </IconButton>
                  </Form>
                )}
              </Formik>
            </Box>
            
            {/* Search Results Dropdown */}
            {showSearchResults && searchQuery.trim() && (
              <Box
                ref={searchResultsRef}
                sx={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  width: '100%',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  background: 'rgba(20,20,35,0.95)',
                  borderRadius: '0 0 10px 10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderTop: 'none',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                  zIndex: 1051,
                  backdropFilter: 'blur(10px)',
                  '&::-webkit-scrollbar': {
                    width: '6px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'rgba(255,255,255,0.05)',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '3px',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.15)',
                    },
                  },
                }}
              >
                {/* Индикатор загрузки */}
                {isSearchLoading && (
                  <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        width: 24, 
                        height: 24, 
                        borderRadius: '50%', 
                        border: '2px solid rgba(255,255,255,0.1)', 
                        borderTop: '2px solid rgba(0,207,255,0.7)',
                        animation: 'spin 1s linear infinite',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' }
                        }
                      }} 
                    />
                    <Typography sx={{ ml: 2, color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                      Поиск сообщений...
                    </Typography>
                  </Box>
                )}
                
                {/* Сообщение, если ничего не найдено */}
                {!isSearchLoading && searchResults.length === 0 && debouncedSearchQuery && (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                      По запросу <Box component="span" sx={{ fontWeight: 'bold', color: '#00CFFF' }}>{debouncedSearchQuery}</Box> ничего не найдено
                    </Typography>
                  </Box>
                )}
                
                {/* Результаты поиска */}
                {!isSearchLoading && searchResults.length > 0 && searchResults.map((msg) => (
                  <Box
                    key={msg.id}
                    onClick={() => {
                      // Закрываем панель поиска
                      setShowSearchResults(false);
                      setSearchMode(false);
                      
                      // Навигация к сообщению
                      handleNavigateToMessage(msg.id);
                    }}
                    sx={{
                      p: 1.5,
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      '&:hover': {
                        background: 'rgba(255,255,255,0.05)',
                      },
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                    }}
                  >
                    {/* Заголовок с автором и датой */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <UserAvatar 
                        src={msg.author.avatar || undefined} 
                        alt={msg.author.login}
                        userId={msg.author.id}
                        hubId={hubId}
                        sx={{ 
                          width: 24, 
                          height: 24,
                          '& span': {
                            fontSize: '1rem !important',
                            top: '2px !important'
                          }
                        }}
                      />
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'rgba(255,255,255,0.95)' }}>
                        {msg.author.login}
                      </Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', ml: 'auto' }}>
                        {formatMessageTime(msg.created_at)}
                      </Typography>
                    </Box>
                    <Typography 
                      sx={{ 
                        fontSize: '0.85rem', 
                        color: 'rgba(255,255,255,0.8)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        '& mark': {
                          backgroundColor: 'rgba(0, 207, 255, 0.25)',
                          color: '#00CFFF',
                          padding: '0 1px',
                          borderRadius: '2px',
                          fontWeight: 'bold'
                        }
                      }}
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                          (() => {
                            // Create a preview of the message content with highlighted search terms
                            let content = msg.content;
                            
                            // Truncate long messages
                            if (content.length > 150) {
                              content = content.substring(0, 150) + '...';
                            }
                            
                            // Convert newlines to spaces for the preview
                            content = content.replace(/\r\n/g, ' ').replace(/\n/g, ' ');
                            
                            // Highlight search terms
                            if (debouncedSearchQuery.trim()) {
                              const query = debouncedSearchQuery.trim();
                              const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              const regex = new RegExp(`(${escapedQuery})`, 'gi');
                              content = content.replace(regex, '<mark>$1</mark>');
                            }
                            
                            return content;
                          })()
                        )
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        ) : (
          <Tooltip title="Поиск сообщений (Ctrl + F)" placement="top">
            <IconButton 
              onClick={() => {
                setSearchMode(true);
                setTimeout(() => {
                  if (searchInputRef.current) {
                    searchInputRef.current.focus();
                  }
                }, 100);
              }}
              sx={{
                color: searchMode ? '#00CFFF' : 'rgba(255,255,255,0.6)',
                '&:hover': {
                  color: searchMode ? '#00CFFF' : 'rgba(255,255,255,0.9)',
                  background: 'rgba(255,255,255,0.05)'
                }
              }}
            >
              <SearchIcon />
            </IconButton>
          </Tooltip>
        )}
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
                  pl: 3,
                  width: '100%'
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
                        
                        // Clear any existing highlight timeout
                        if (highlightTimeoutRef.current) {
                          clearTimeout(highlightTimeoutRef.current);
                          highlightTimeoutRef.current = null;
                        }
                        
                        // Clear existing highlights and focused message
                        setFocusedMessageId(null);
                        setHighlightedMessages(new Set());
                        
                        // Highlight the message
                        setFocusedMessageId(replyingToMessage.id);
                        
                        // Add to highlighted set for visual effect
                        setHighlightedMessages(prev => {
                          const newSet = new Set<number>();
                          newSet.add(replyingToMessage.id);
                          return newSet;
                        });
                        
                        // Remove highlight after 1.5 seconds
                        highlightTimeoutRef.current = setTimeout(() => {
                          setHighlightedMessages(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(replyingToMessage.id);
                            return newSet;
                          });
                          setFocusedMessageId(null);
                          highlightTimeoutRef.current = null;
                        }, 1500);
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