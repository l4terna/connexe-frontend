import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, IconButton, Paper, Stack, Typography, Fade, Tooltip, Button, Checkbox, Skeleton } from '@mui/material';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import ReplyIcon from '@mui/icons-material/Reply';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Channel, Message, ChannelType, useGetMessagesQuery, useSearchMessagesQuery, useCreateMessageMutation, useUpdateMessageMutation, useDeleteMessageMutation } from '../../../api/channels';
import UserAvatar from '../../UserAvatar';
import Input from '../../common/Input';
import DOMPurify from 'dompurify';
import { useNotification } from '@/context/NotificationContext';
import { hasPermission } from '@/utils/rolePermissions';
import { useWebSocket } from '@/websocket/useWebSocket';
import { webSocketService } from '@/websocket/WebSocketService';
import AppModal from '../../AppModal';
import ChatMessageItem from './ChatMessageItem';
import MessageActionsPortal from './MessageActionsPortal';
import { useMessagePagination } from './hooks/useMessagePagination';

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
  // Использование хука пагинации
  const { state: paginationState, actions: paginationActions, isLoadingMoreRef, lastBeforeIdRef, lastAfterIdRef } = useMessagePagination();
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
  
  // Состояние для целевого сообщения при переходе из поиска
  const [targetMessageId, setTargetMessageId] = useState<number | null>(null);
  
  
  // Состояние для портала действий над сообщениями
  const [hoveredMessage, setHoveredMessage] = useState<{
    element: HTMLElement;
    message: ExtendedMessage;
  } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringPortal = useRef(false);
  
  const MESSAGES_PER_PAGE = 40;
  
  // Декларации функций объявлены заранее для React useCallback

  
  const queryParams = activeChannel?.type === ChannelType.TEXT && !paginationState.skipMainQuery ? {
    channelId: activeChannel?.id ?? 0,
    params: {
      size: MESSAGES_PER_PAGE,
      ...(paginationState.beforeId ? { before: paginationState.beforeId } : {}),
      ...(paginationState.afterId ? { after: paginationState.afterId } : {}),
    }
  } : { channelId: 0, params: {} };
  
  const { data: messagesData = [], isLoading, isFetching } = useGetMessagesQuery(
    queryParams,
    { 
      skip: !activeChannel || activeChannel.type !== ChannelType.TEXT || paginationState.skipMainQuery,
      refetchOnMountOrArgChange: true,
      // Форсируем новый запрос при изменении
      refetchOnReconnect: true,
      // Не используем кешированные данные для пагинации
      refetchOnFocus: false
    }
  );
  
  // Отдельный хук для around запроса
  const { data: aroundMessagesData, isLoading: isLoadingAround } = useGetMessagesQuery(
    activeChannel?.type === ChannelType.TEXT && paginationState.aroundMessageId && paginationState.loadingMode === 'around' ? {
      channelId: activeChannel?.id ?? 0,
      params: {
        size: MESSAGES_PER_PAGE,
        around: paginationState.aroundMessageId
      }
    } : { channelId: 0, params: {} },
    { 
      skip: !activeChannel || activeChannel.type !== ChannelType.TEXT || !paginationState.aroundMessageId || paginationState.loadingMode !== 'around'
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
  
  const [createMessage] = useCreateMessageMutation();
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const { notify } = useNotification();

  const canSendMessages = hasPermission(userPermissions, 'SEND_MESSAGES', isOwner);
  const canManageMessages = hasPermission(userPermissions, 'MANAGE_MESSAGES', isOwner);

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
    paginationActions.setHasMoreMessages(true);
    paginationActions.setHasMoreMessagesAfter(true);
    paginationActions.setEnableAfterPagination(false);
    paginationActions.setBeforeId(null);
    paginationActions.setAfterId(null);
    setEditingMessageId(null);
    setCurrentDateLabel(null);
    setShowDateLabel(false);
    setShowScrollButton(false);
    setTempMessages(new Map());
    setPage(1);
    setIsScrolledToBottom(true);
    isLoadingMoreRef.current = false;
    setReadMessages(new Set());
    lastAfterIdRef.current = null;
    lastBeforeIdRef.current = null;
    
    // Clear search state (navigation logic removed)
    
    // Сброс состояния поиска
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setSearchMode(false);
    
    // Clear unread state
    setUnreadMessages(new Set());
    setUnreadCount(0);
    setNewMessagesCount(0);
    setHasNewMessage(false);
    
    // Clear target message state
    setTargetMessageId(null);
    paginationActions.setAroundMessageId(null);
    paginationActions.setLoadingMode('initial');
    paginationActions.setIsJumpingToMessage(false);
    
    // Reset query control
    paginationActions.setSkipMainQuery(false);
    
    // Mark all messages as read when entering a channel
    if (activeChannel) {
      webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
    }
  }, [activeChannel?.id]); // Using id instead of the full object

  // Simple function to scroll to bottom without marking messages as read
  const scrollToBottom = useCallback((smooth: boolean = false) => {
    // Если включен флаг блокировки автопрокрутки, не прокручиваем
    if (disableAutoScroll || paginationState.isJumpingToMessage) {
      return;
    }
    
    if (messagesContainerRef.current) {
      if (smooth) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      setShowScrollButton(false);
    }
  }, [disableAutoScroll, paginationState.isJumpingToMessage]);
  
  // Function to scroll to a specific message and highlight it
  const scrollToMessage = useCallback((messageId: number) => {
    if (!messagesContainerRef.current) return;
    
    const messageElement = document.getElementById(`message-${messageId}`);
    if (!messageElement) {
      return;
    }
    
    // Блокируем автопрокрутку при переходе к сообщению
    setDisableAutoScroll(true);
    
    // Вычисляем позицию для прокрутки (центрируем сообщение в контейнере)
    const container = messagesContainerRef.current;

    const messageTop = messageElement.offsetTop;
    const messageHeight = messageElement.offsetHeight;
    const containerHeight = container.clientHeight;
    
    // Центрируем сообщение в видимой области
    const scrollTop = messageTop - (containerHeight / 2) + (messageHeight / 2);
    
    // Прокручиваем к сообщению
    container.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth'
    });
    
    // Подсвечиваем сообщение
    messageElement.style.transition = 'background-color 0.3s ease-in-out';
    messageElement.style.backgroundColor = 'rgba(0, 207, 255, 0.1)';
    
    // Убираем подсветку через 2 секунды
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    highlightTimeoutRef.current = setTimeout(() => {
      messageElement.style.backgroundColor = '';
      highlightTimeoutRef.current = null;
    }, 1500);
    
  }, []);
  
  // Функция перехода к сообщению удалена

  // Function to scroll to bottom and mark all messages as read
  const handleScrollToBottom = useCallback(() => {
    // Разрешаем автопрокрутку, так как пользователь явно запросил прокрутку вниз
    setDisableAutoScroll(false);
    
    // Если мы находимся в режиме around или jumping, сначала сбрасываем эти состояния
    if (paginationState.loadingMode === 'around' || paginationState.isJumpingToMessage) {
      paginationActions.setLoadingMode('initial');
      paginationActions.setIsJumpingToMessage(false);
      setTargetMessageId(null);
      paginationActions.setAroundMessageId(null);
    }
        
    // Сбрасываем все параметры пагинации для загрузки самых новых сообщений
    paginationActions.setBeforeId(null);
    paginationActions.setAfterId(null);
    lastBeforeIdRef.current = null;
    lastAfterIdRef.current = null;
    paginationActions.setEnableAfterPagination(false);
    paginationActions.setHasMoreMessages(true);
    paginationActions.setHasMoreMessagesAfter(true);
    
    // Очищаем временные сообщения
    setTempMessages(new Map());
    
    // Разблокируем основной запрос ПЕРЕД установкой режима загрузки
    paginationActions.setSkipMainQuery(false);
    
    // Устанавливаем режим загрузки как initial для получения последних сообщений
    paginationActions.setLoadingMode('initial');
    
    // Блокируем пагинацию на время загрузки
    isLoadingMoreRef.current = true;
    
    // Send bulk-read-all request when scrolling to bottom
    if (activeChannel) {
      webSocketService.publish(`/app/v1/channels/${activeChannel.id}/messages/bulk-read-all`, {});
    }

    // Update local state
    setUnreadMessages(new Set());
    setUnreadCount(0);
    setNewMessagesCount(0);
    setHasNewMessage(false);
    
    // Прокручиваем вниз после небольшой задержки
    setTimeout(() => {
      scrollToBottom(false);
    }, 100);
  }, [activeChannel, paginationState.loadingMode, paginationState.isJumpingToMessage, scrollToBottom]);

  // Helper function to convert Message to ExtendedMessage
  const convertToExtendedMessage = useCallback((message: Message): ExtendedMessage => {
    return {
      ...message,
      status: 'status' in message ? (message as any).status : MessageStatus.SENT // Use existing status or default to SENT
      // reply field is already preserved via spread operator
    };
  }, []);

  // Handle around messages
  useEffect(() => {
    if (aroundMessagesData && aroundMessagesData.length > 0 && paginationState.loadingMode === 'around') {      
      // Блокируем пагинацию на время обработки
      isLoadingMoreRef.current = true;
      
      const newExtendedMessages = aroundMessagesData.map(convertToExtendedMessage);
      
      // Устанавливаем новые сообщения (старые уже очищены при клике на результат поиска)
      setMessages(newExtendedMessages);
      messagesLengthRef.current = newExtendedMessages.length;
      
      // НЕ сбрасываем beforeId и afterId после around загрузки
      // Они будут установлены при скролле пользователя
      // Но сбрасываем lastAfterIdRef чтобы пагинация могла работать
      lastAfterIdRef.current = null;
      lastBeforeIdRef.current = null;
      
      // Check for unread messages in the new set
      const unreadMessages = newExtendedMessages.filter(
        msg => msg.status === MessageStatus.NEW && msg.author.id !== user.id
      );
      
      if (unreadMessages.length > 0) {
        setUnreadMessages(new Set(unreadMessages.map(msg => msg.id)));
        setUnreadCount(unreadMessages.length);
      }
      
      
      // Не прокручиваем здесь - ждем следующий эффект
      
      // При around запросе всегда включаем пагинацию вниз
      // так как мы можем быть в середине истории сообщений
      paginationActions.setEnableAfterPagination(true);      
      // При загрузке around всегда предполагаем, что есть больше сообщений в обоих направлениях
      // (если только не получили очень мало сообщений)
      if (newExtendedMessages.length > 5) {
        paginationActions.setHasMoreMessages(true); // Включаем пагинацию вверх
        paginationActions.setHasMoreMessagesAfter(true); // Включаем пагинацию вниз
      }
    }
  }, [aroundMessagesData, paginationState.loadingMode, convertToExtendedMessage, user.id, paginationActions]);

  // Handle messages load based on loading mode (excluding around)
  useEffect(() => {
    if (!activeChannel || activeChannel.type !== ChannelType.TEXT) return;
    
    // Пропускаем обработку для around режима (он обрабатывается отдельно)
    if (paginationState.loadingMode === 'around') return;
    
    // Пропускаем обработку если данные еще загружаются
    if (isLoading || isFetching) return;
    
    // Пропускаем если происходит переход к сообщению
    if (paginationState.isJumpingToMessage) return;
    
    // Пропускаем обработку если у нас есть beforeId или afterId (это пагинация)
    if (paginationState.beforeId !== null || paginationState.afterId !== null) return;
    
    // Set empty messages array when data is empty
    if (!messagesData || messagesData.length === 0) {
      setMessages([]);
      // Scroll to bottom only for initial load
      if (paginationState.loadingMode === 'initial') {
        setTimeout(() => {
          scrollToBottom(false);
        }, 50);
      }
      return;
    }
    
    // Обрабатываем сообщения в зависимости от режима загрузки
    if (paginationState.loadingMode === 'initial') {
      const newExtendedMessages = messagesData.map(convertToExtendedMessage);
            
      // Просто устанавливаем новые сообщения
      setMessages(newExtendedMessages);
      messagesLengthRef.current = newExtendedMessages.length;
      
      // При начальной загрузке, если получили меньше сообщений чем полная страница,
      // значит мы загрузили самые новые сообщения и больше нет
      if (messagesData.length < MESSAGES_PER_PAGE) {
        paginationActions.setHasMoreMessagesAfter(false);
        paginationActions.setEnableAfterPagination(false);
      } else {
        // Если получили полную страницу, есть вероятность что есть еще сообщения
        // Но не включаем пагинацию вниз при начальной загрузке, так как мы в самом низу
        paginationActions.setEnableAfterPagination(false);
      }
      
      // Check for unread messages
      const unreadMessages = newExtendedMessages.filter(
        msg => msg.status === MessageStatus.NEW && msg.author.id !== user.id
      );
      
      if (unreadMessages.length > 0) {
        setUnreadMessages(new Set(unreadMessages.map(msg => msg.id)));
        setUnreadCount(unreadMessages.length);
      }
      
      // Прокручиваем вниз только при начальной загрузке
      setTimeout(() => {
        scrollToBottom(false);
        paginationActions.setLoadingMode(null); // Сбрасываем режим после обработки
        isLoadingMoreRef.current = false; // Разблокируем пагинацию
      }, 150);
    }
  }, [activeChannel, messagesData, isLoading, isFetching, convertToExtendedMessage, user.id, scrollToBottom, paginationState.loadingMode, paginationState.isJumpingToMessage, paginationState.beforeId, paginationState.afterId, paginationActions]);

  // Effect to scroll to target message when loaded
  useEffect(() => {
    if (targetMessageId && messages.length > 0 && paginationState.loadingMode === 'around' && !isLoadingAround) {
      const targetExists = messages.some(msg => msg.id === targetMessageId);
      
      if (targetExists) {        
        // Продолжаем блокировать пагинацию во время анимации
        isLoadingMoreRef.current = true;
        
        // Даем время DOM обновиться
        setTimeout(() => {
          scrollToMessage(targetMessageId);
          
          // Сбрасываем состояния после прокрутки
          setTargetMessageId(null);
          paginationActions.setAroundMessageId(null);
          paginationActions.setLoadingMode(null);
          
          // Разблокируем автопрокрутку и пагинацию через некоторое время
          setTimeout(() => {
            setDisableAutoScroll(false);
            isLoadingMoreRef.current = false; // Разблокируем пагинацию
            // НЕ сбрасываем skipMainQuery здесь - он сбросится когда установится beforeId или afterId
          }, 1500); // Увеличиваем задержку для завершения всех анимаций
        }, 200);
      } 
    }
  }, [messages, targetMessageId, scrollToMessage, paginationState.loadingMode, isLoadingAround, paginationActions]);

  // Remove old auto-scroll effect - now handled in main message loading effect

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
      
      // Scroll to bottom immediately after adding the temporary message
      setTimeout(() => {
        scrollToBottom(true); // Use smooth scrolling when sending a message
      }, 10);
      
      resetForm();

      // Send the message to the server
      const apiPayload = {
        channelId: activeChannel.id,
        content: values.content,
        ...(replyMessage?.id ? { replyId: replyMessage.id } : {})
      };      
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
      
      // Используем функцию пагинации из хука
      paginationActions.handleScrollPagination(container, messages, MESSAGES_PER_PAGE);
      
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
    // Updated dependencies for new loading mode system
  }, [messages, paginationState.hasMoreMessages, paginationState.hasMoreMessagesAfter, paginationState.enableAfterPagination, paginationState.loadingMode]);

  // Handle pagination loading
  useEffect(() => {
    if (messagesData && messagesData.length > 0 && paginationState.beforeId !== null && paginationState.afterId === null && paginationState.loadingMode === 'pagination' && !isLoading && !isFetching) {
      // Проверяем, что данные действительно соответствуют запросу
      const firstMessageId = messagesData[0]?.id;
      if (firstMessageId && firstMessageId >= paginationState.beforeId) {
        // Сбрасываем состояние пагинации при ошибке
        isLoadingMoreRef.current = false;
        paginationActions.setLoadingMode(null);
        paginationActions.setBeforeId(null);
        return;
      }
      
      const container = messagesContainerRef.current;
      if (!container) return;
      
      
      // Store the scroll height and scroll position BEFORE adding new messages
      const scrollHeightBefore = container.scrollHeight;
      const scrollPositionBefore = container.scrollTop;
      
      // Check if we received less messages than requested
      if (messagesData.length < MESSAGES_PER_PAGE) {
        paginationActions.setHasMoreMessages(false);
      }

      // Temporarily set disableAutoScroll to prevent automatic scrolling to bottom
      setDisableAutoScroll(true);
      
      // НЕ включаем пагинацию вниз при обычной загрузке истории
      // Она должна включаться только после around запроса
      
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
          

        return mergedMessages;
      });

      // Корректируем позицию скролла после загрузки
      requestAnimationFrame(() => {
        setTimeout(() => {
          const scrollHeightAfter = container.scrollHeight;
          const heightAdded = scrollHeightAfter - scrollHeightBefore;
          
          // Вычисляем целевую позицию скролла
          const targetScrollTop = scrollPositionBefore + heightAdded;
          
          // Устанавливаем позицию скролла
          container.scrollTop = targetScrollTop;
          
          // Проверяем, не остались ли мы слишком близко к верху после корректировки
          // Если да, сдвигаем немного вниз, чтобы предотвратить повторную загрузку
          if (container.scrollTop < 100) {
            // Сдвигаем скролл на 150 пикселей вниз от верха
            container.scrollTop = 150;
          }
          
          isLoadingMoreRef.current = false;
          paginationActions.setLoadingMode(null);
        }, 50);
      });
    }
  }, [messagesData, paginationState.beforeId, convertToExtendedMessage, paginationState.loadingMode, isLoading, isFetching, paginationActions]);

  // Handle pagination loading for after (scroll down)
  useEffect(() => {
    if (messagesData && messagesData.length > 0 && paginationState.afterId !== null && paginationState.beforeId === null && paginationState.loadingMode === 'pagination' && !isLoading && !isFetching) {
      // Проверяем, что данные действительно соответствуют запросу
      // При after запросе первое сообщение должно иметь ID больше afterId
      let dataToProcess = messagesData;
      const firstMessageId = messagesData[0]?.id;
      if (firstMessageId && firstMessageId <= paginationState.afterId) { 
        // Пытаемся найти новые сообщения в полученном массиве
        const newMessages = messagesData.filter(msg => msg.id > paginationState.afterId!);
        
        if (newMessages.length === 0) {
          // Если нет новых сообщений, значит мы достигли конца
          paginationActions.setHasMoreMessagesAfter(false);
          paginationActions.setEnableAfterPagination(false);
          isLoadingMoreRef.current = false;
          paginationActions.setLoadingMode(null);
          paginationActions.setAfterId(null);
          return;
        }
        
        // Если есть новые сообщения, продолжаем с ними
        dataToProcess = newMessages;
      }
      
      const container = messagesContainerRef.current;
      if (!container) {
        isLoadingMoreRef.current = false;
        paginationActions.setLoadingMode(null);
        return;
      }
      
      // Check if we received less messages than requested
      if (dataToProcess.length < MESSAGES_PER_PAGE) {
        paginationActions.setHasMoreMessagesAfter(false);
        // Если получили меньше сообщений чем запрашивали, значит достигли конца
        // и можно отключить пагинацию вниз
        paginationActions.setEnableAfterPagination(false);
      } 

      // Temporarily set disableAutoScroll to prevent automatic scrolling to bottom
      setDisableAutoScroll(true);
      
      // Convert new messages to ExtendedMessage
      const newExtendedMessages = dataToProcess.map(convertToExtendedMessage);
      
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
          
        return mergedMessages;
      });

      // For scroll down pagination, we don't need to adjust scroll position
      // Messages are added at the bottom, so scroll position naturally stays the same
      requestAnimationFrame(() => {
        isLoadingMoreRef.current = false;
        paginationActions.setLoadingMode(null);
        // Don't reset afterId here - it will cause a duplicate request
        // afterId should only be reset when changing channels or scrolling to bottom
      });
    }
  }, [messagesData, paginationState.afterId, convertToExtendedMessage, paginationState.loadingMode, isLoading, isFetching, paginationActions]);

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
    let scrollTimeoutId: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // Clear previous timeout if exists
      if (scrollTimeoutId) {
        clearTimeout(scrollTimeoutId);
      }


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
      
      // Обновляем последнюю позицию скролла
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
        
        // НЕ отключаем enableAfterPagination здесь!
        // Он отключится только когда получим < MESSAGES_PER_PAGE сообщений
        
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
        scrollTimeoutId = null;
      }, 150);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeChannel, paginationState.enableAfterPagination, paginationState.hasMoreMessagesAfter, messages]);

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
              
              // Auto-scroll to bottom only if not jumping to a message
              if (paginationState.loadingMode !== 'around' && !paginationState.isJumpingToMessage) {
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
              }
              
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
          }
  }, [isScrolledToBottom, user.id, activeChannel, convertToExtendedMessage, paginationState.loadingMode, paginationState.isJumpingToMessage]);

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

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

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
      setTimeout(() => {
        // If we're near the bottom, scroll to bottom (but not if jumping to a message)
        if (messagesContainerRef.current && paginationState.loadingMode !== 'around' && !paginationState.isJumpingToMessage) {
          const { scrollHeight, scrollTop, clientHeight } = messagesContainerRef.current;
          const scrollPosition = scrollHeight - scrollTop - clientHeight;
          if (scrollPosition < 200) {
            scrollToBottom(true);
          }
        }
      }, 100);
    }
  }, [searchMode, scrollToBottom, paginationState.loadingMode, paginationState.isJumpingToMessage]);
  
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
        height: '100%',
        p: 3, 
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {[...Array(MESSAGES_PER_PAGE)].map((_, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Skeleton 
            variant="circular" 
            width={40} 
            height={40} 
            animation="wave"
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.1)',
              flexShrink: 0,
            }} 
          />
          <Box sx={{ flex: 1 }}>
            <Skeleton 
              variant="text" 
              width={120} 
              height={24} 
              animation="wave"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 1 }} 
            />
            <Skeleton 
              variant="text" 
              width="80%" 
              height={20} 
              animation="wave"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} 
            />
            <Skeleton 
              variant="text" 
              width="60%" 
              height={20} 
              animation="wave"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} 
            />
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
          {/* Show loading state when in around loading mode or when jumping to message */}
          {(paginationState.loadingMode === 'around' || paginationState.isJumpingToMessage || isLoadingAround) ? (
            <Box sx={{ 
              width: '100%',
              height: '100%',
              overflowY: 'auto',
              p: 3, 
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              {[...Array(MESSAGES_PER_PAGE)].map((_, index) => (
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
          ) : searchMode && searchQuery.trim() ? (
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

          {/* Loading indicator for upward pagination */}
          {paginationState.loadingMode === 'pagination' && paginationState.beforeId && (
            <Box sx={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              py: 2,
              gap: 1
            }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#00CFFF',
                  animation: 'pulse 1.4s infinite ease-in-out both',
                  animationDelay: '-0.32s',
                  '@keyframes pulse': {
                    '0%, 80%, 100%': {
                      transform: 'scale(0)',
                      opacity: 0.5
                    },
                    '40%': {
                      transform: 'scale(1)',
                      opacity: 1
                    }
                  }
                }}
              />
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#00CFFF',
                  animation: 'pulse 1.4s infinite ease-in-out both',
                  animationDelay: '-0.16s',
                  '@keyframes pulse': {
                    '0%, 80%, 100%': {
                      transform: 'scale(0)',
                      opacity: 0.5
                    },
                    '40%': {
                      transform: 'scale(1)',
                      opacity: 1
                    }
                  }
                }}
              />
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#00CFFF',
                  animation: 'pulse 1.4s infinite ease-in-out both',
                  '@keyframes pulse': {
                    '0%, 80%, 100%': {
                      transform: 'scale(0)',
                      opacity: 0.5
                    },
                    '40%': {
                      transform: 'scale(1)',
                      opacity: 1
                    }
                  }
                }}
              />
            </Box>
          )}

          {/* Messages */}
          {(() => {
            let result: React.ReactElement[] = [];
            let prevAuthorId: number | null = null;
            let prevMessageTime: string | null = null;
            let currentGroup: React.ReactElement[] = [];
            let currentDateString: string | null = null;
            let processedDates = new Set<string>();
            
            // Handle reply click callback
            const handleReplyClick = (replyId: number) => {
              // Check if message exists in current list
              const messageExists = sortedMessages.some(msg => msg.id === replyId);
              
              if (messageExists) {
                // Message is in current view, just scroll to it
                const messageElement = document.querySelector(`[data-msg-id='${replyId}']`);
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
                  setFocusedMessageId(replyId);
                  
                  // Add to highlighted set for visual effect
                  setHighlightedMessages(() => {
                    const newSet = new Set<number>();
                    newSet.add(replyId);
                    return newSet;
                  });
                  
                  // Remove highlight after 1.5 seconds
                  highlightTimeoutRef.current = setTimeout(() => {
                    setHighlightedMessages(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(replyId);
                      return newSet;
                    });
                    setFocusedMessageId(null);
                    highlightTimeoutRef.current = null;
                  }, 1500);
                }
              } else {
                // Message not in current view, load around it
                // Блокируем все операции во время перехода
                paginationActions.setIsJumpingToMessage(true);
                paginationActions.setSkipMainQuery(true);
                isLoadingMoreRef.current = true;
                
                // Очищаем предыдущие состояния
                setMessages([]);
                setTempMessages(new Map());
                paginationActions.setBeforeId(null);
                paginationActions.setAfterId(null);
                lastBeforeIdRef.current = null;
                lastAfterIdRef.current = null;
                paginationActions.setHasMoreMessages(true);
                paginationActions.setHasMoreMessagesAfter(true);
                paginationActions.setEnableAfterPagination(true);
                
                // Устанавливаем целевое сообщение и режим загрузки
                setTargetMessageId(replyId);
                paginationActions.setAroundMessageId(replyId);
                paginationActions.setLoadingMode('around');
                
                // После загрузки around эффект автоматически прокрутит к сообщению
              }
            };
            
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
                (prevMessageTime !== null && !isWithinTimeThreshold(prevMessageTime, msg.created_at));

              const isTempMessage = msg.id === -1;

              const messageElement = editingMessageId === msg.id ? (
                <Box
                  key={isTempMessage ? `temp-${msg.created_at}` : msg.id}
                  id={`message-${msg.id}`}
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
                                    onClick={(_e: React.FormEvent) => handleSubmit()}
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
                      </Box>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <ChatMessageItem
                  key={isTempMessage ? `temp-${msg.created_at}` : msg.id}
                  message={msg}
                  isFirstOfGroup={isFirstOfGroup}
                  isTempMessage={isTempMessage}
                  isHighlighted={highlightedMessages.has(msg.id)}
                  isUnread={unreadMessages.has(msg.id)}
                  isFocused={focusedMessageId === msg.id}
                  isSearchMode={searchMode}
                  searchQuery={searchQuery}
                  currentUserId={user.id}
                  hubId={hubId}
                  onReply={(message) => {
                    setReplyingToMessage(message);
                    focusMessageInput();
                  }}
                  onEdit={(messageId) => setEditingMessageId(messageId)}
                  onDelete={(messageId) => handleDeleteMessage(messageId)}
                  onReplyClick={handleReplyClick}
                  onMouseEnter={(e, message) => {
                    // Отменяем таймер скрытия если он есть
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                    setHoveredMessage({ element: e.currentTarget, message });
                  }}
                  onMouseLeave={() => {
                    // Добавляем задержку перед скрытием
                    hoverTimeoutRef.current = setTimeout(() => {
                      if (!isHoveringPortal.current) {
                        setHoveredMessage(null);
                      }
                    }, 100);
                  }}
                />
              );

              currentGroup.push(messageElement);
              prevAuthorId = msg.author.id;
              prevMessageTime = msg.created_at;
            });

            if (currentGroup.length > 0) {
              result.push(...currentGroup);
            }
            
            // Add loading indicator for downward pagination
            if (paginationState.loadingMode === 'pagination' && paginationState.afterId) {
              result.push(
                <Box key="loading-after" sx={{ 
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  py: 2,
                  gap: 1
                }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#00CFFF',
                      animation: 'pulse 1.4s infinite ease-in-out both',
                      animationDelay: '-0.32s',
                      '@keyframes pulse': {
                        '0%, 80%, 100%': {
                          transform: 'scale(0)',
                          opacity: 0.5
                        },
                        '40%': {
                          transform: 'scale(1)',
                          opacity: 1
                        }
                      }
                    }}
                  />
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#00CFFF',
                      animation: 'pulse 1.4s infinite ease-in-out both',
                      animationDelay: '-0.16s',
                      '@keyframes pulse': {
                        '0%, 80%, 100%': {
                          transform: 'scale(0)',
                          opacity: 0.5
                        },
                        '40%': {
                          transform: 'scale(1)',
                          opacity: 1
                        }
                      }
                    }}
                  />
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#00CFFF',
                      animation: 'pulse 1.4s infinite ease-in-out both',
                      '@keyframes pulse': {
                        '0%, 80%, 100%': {
                          transform: 'scale(0)',
                          opacity: 0.5
                        },
                        '40%': {
                          transform: 'scale(1)',
                          opacity: 1
                        }
                      }
                    }}
                  />
                </Box>
              );
            }

            return result;
          })()}
          
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
                              const hasResults = e.target.value.trim() !== '' && messages.filter(msg => 
                                msg.content.toLowerCase().includes(e.target.value.toLowerCase().trim()) || 
                                msg.author.login.toLowerCase().includes(e.target.value.toLowerCase().trim())
                              ).length > 0;
                              
                              setShowSearchResults(hasResults);
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
                      // Устанавливаем режим загрузки around
                      paginationActions.setLoadingMode('around');

                      // Блокируем основной запрос
                      paginationActions.setSkipMainQuery(true);
                      
                      // Блокируем все запросы
                      paginationActions.setIsJumpingToMessage(true);
                      
                      // Закрываем панель поиска
                      setShowSearchResults(false);
                      setSearchMode(false);
                      setSearchQuery('');
                      setDebouncedSearchQuery('');
                      
                      // Блокируем автопрокрутку и пагинацию
                      setDisableAutoScroll(true);
                      isLoadingMoreRef.current = true; // Блокируем пагинацию
                      
                      // Очищаем beforeId чтобы не было конфликтов
                      paginationActions.setBeforeId(null);
                      
                      // Сразу очищаем сообщения перед загрузкой новых
                      // Это предотвращает проблемы со скроллом из-за удаления сообщений
                      setMessages([]);
                      setTempMessages(new Map());
                      messagesLengthRef.current = 0;
                      
                      // Очищаем состояния непрочитанных сообщений
                      setUnreadMessages(new Set());
                      setUnreadCount(0);
                      setNewMessagesCount(0);
                      setHasNewMessage(false);
                      
                      // Устанавливаем целевое сообщение для перехода
                      setTargetMessageId(msg.id);
                      
                      // Небольшая задержка перед установкой aroundMessageId
                      setTimeout(() => {
                        paginationActions.setAroundMessageId(msg.id);
                        paginationActions.setIsJumpingToMessage(false); // Разблокируем запросы
                        // НЕ включаем enableAfterPagination здесь - around запрос сам включит его
                      }, 100);                      
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

      {isLoading && !paginationState.beforeId ? renderSkeleton() : renderMessages()}

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
                        setHighlightedMessages(() => {
                          const newSet = new Set<number>();
                          newSet.add(replyingToMessage.id);
                          return newSet;
                        });
                        
                        // Remove highlight after 3 seconds
                        highlightTimeoutRef.current = setTimeout(() => {
                          setHighlightedMessages(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(replyingToMessage.id);
                            return newSet;
                          });
                          setFocusedMessageId(null);
                          highlightTimeoutRef.current = null;
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
              {({ handleSubmit, values }) => (
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
      
      {/* Portal for message actions */}
      {hoveredMessage && (
        <MessageActionsPortal
          targetElement={hoveredMessage.element}
          messageId={hoveredMessage.message.id}
          authorId={hoveredMessage.message.author.id}
          currentUserId={user.id}
          onReply={() => {
            setReplyingToMessage(hoveredMessage.message);
            focusMessageInput();
            setHoveredMessage(null);
          }}
          onEdit={() => {
            setEditingMessageId(hoveredMessage.message.id);
            setHoveredMessage(null);
          }}
          onDelete={() => {
            handleDeleteMessage(hoveredMessage.message.id);
            setHoveredMessage(null);
          }}
          onClose={() => setHoveredMessage(null)}
          onPortalMouseEnter={() => {
            isHoveringPortal.current = true;
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
          }}
          onPortalMouseLeave={() => {
            isHoveringPortal.current = false;
            hoverTimeoutRef.current = setTimeout(() => {
              setHoveredMessage(null);
            }, 100);
          }}
        />
      )}
    </Box>
  );
};

export default MainChatArea;