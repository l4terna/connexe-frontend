import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Box, Skeleton } from '@mui/material';
import MessageList from './components/MessageList';
import ChatHeader from './components/ChatHeader';
import DeleteMessageDialog from './components/DeleteMessageDialog';
import NewMessagesIndicator from './components/NewMessagesIndicator';
import ChatFooter from './components/ChatFooter';
import { useNotification } from '@/context/NotificationContext';
import { hasPermission } from '@/utils/rolePermissions';

import { 
  useGetMessagesQuery, 
  useCreateMessageMutation, 
  useUpdateMessageMutation, 
  useDeleteMessageMutation,
  Channel,
  Message,
  ChannelType 
} from '../../../api/channels';
import { useMessagePagination } from './hooks/useMessagePagination';
import { useMessageReadStatus } from './hooks/useMessageReadStatus';
import { useMessageScroll } from './hooks/useMessageScroll';
import { useMessageSearch } from './hooks/useMessageSearch';
import { useMessageWebSocket } from './hooks/useMessageWebSocket';
import { useMessageState } from './hooks/useMessageState';
import { ExtendedMessage, MessageStatus } from './types/message';

// These utility functions have been moved to the MessageList component

interface MainChatAreaProps {
  activeChannel: Channel | null;
  user: {
    id: number;
    login: string;
    avatar: string | null;
  };
  hubId: number;
  userPermissions: string[];
  isOwner: boolean;
}

const MainChatArea: React.FC<MainChatAreaProps> = ({ activeChannel, user, hubId, userPermissions, isOwner }) => {

  const [sending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<ExtendedMessage | null>(null);
  const replyingToMessageRef = useRef<ExtendedMessage | null>(null);
  
  // Использование хука для управления состоянием сообщений
  const {
    messages,
    setMessages,
    tempMessages,
    setTempMessages,
    unreadMessages,
    setUnreadMessages,
    unreadCount,
    newMessagesCount,
    convertToExtendedMessage,
    resetMessageStates,
    updateMessageReadStatus,
    markAllMessagesAsReadInState,
    updateMessageReadByCount,
    deleteMessageFromState,
    updateMessageInState,
    addMessageToState,
    addUnreadMessage,
    removeUnreadMessage,
    updateUnreadCount,
    resetUnreadCounts
  } = useMessageState();
  
  // Использование хука пагинации
  const { state: paginationState, actions: paginationActions, isLoadingMoreRef, lastBeforeIdRef, lastAfterIdRef, setLoadingWithTimeout } = useMessagePagination();
  
  // Refs должны быть объявлены до использования в хуках
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollCorrectionRef = useRef<{
    prepareScrollCorrection: () => void;
    setDisableSmoothScroll: (value: boolean) => void;
  }>(null);
  
  // Использование хука для работы с прочитанными сообщениями
  const { markMessageAsRead, markAllMessagesAsRead, addToReadBuffer, unreadMessagesBufferRef } = useMessageReadStatus({
    activeChannel,
    user
  });
  
  // Использование хука для работы со скроллом
  const {
    isScrolledToBottom,
    setIsScrolledToBottom,
    showScrollButton,
    setShowScrollButton,
    showDateLabel,
    setShowDateLabel,
    currentDateLabel,
    setCurrentDateLabel,
    setDisableAutoScroll,
    scrollToBottom,
    scrollToMessage,
    handleScrollToBottom
  } = useMessageScroll({
    messagesContainerRef,
    messages,
    activeChannel,
    user,
    onMarkAllAsRead: markAllMessagesAsRead
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const messagesLengthRef = useRef<number>(0);
  const scrollToMessageIdRef = useRef<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [forceScrollToMessageId, setForceScrollToMessageId] = useState<number | null>(null);
  
  // Использование хука поиска
  const {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    searchMode,
    setSearchMode,
    showSearchResults,
    setShowSearchResults,
    searchResults,
    isSearching,
    handleSearchInputChange,
    clearSearch,
    highlightedMessages,
    setHighlightedMessages,
    focusedMessageId,
    setFocusedMessageId,
    searchInputRef,
    searchResultsRef
  } = useMessageSearch({
    channelId: activeChannel?.id,
    onSearchResultClick: (messageId: number) => {
      // Check if message exists in current list
      const messageExists = messages.some(msg => msg.id === messageId);
      
      if (messageExists) {
        // Message is in current view, scroll to it directly
        scrollToMessageIdRef.current = messageId;
        
        // Clear any existing highlights
        setHighlightedMessages(new Set());
        setFocusedMessageId(null);
        
        // Highlight the message
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          newSet.add(messageId);
          return newSet;
        });
        setFocusedMessageId(messageId);
        
        // Remove highlight after delay
        setTimeout(() => {
          setHighlightedMessages(prev => {
            const newSet = new Set(prev);
            newSet.delete(messageId);
            return newSet;
          });
          setFocusedMessageId(null);
        }, 1500);
      } else {
        // Message not in current view, load around it
        paginationActions.setIsJumpingToMessage(true);
        paginationActions.setSkipMainQuery(true);
        
        // Clear previous states
        setMessages([]);
        setTempMessages(new Map());
        paginationActions.setBeforeId(null);
        paginationActions.setAfterId(null);
        paginationActions.setHasMoreMessages(true);
        paginationActions.setHasMoreMessagesAfter(true);
        paginationActions.setEnableAfterPagination(true);
        
        // Set target message and loading mode
        setTargetMessageId(messageId);
        paginationActions.setAroundMessageId(messageId);
        paginationActions.setLoadingMode('around');
      }
    }
  });
  
  // Состояние для целевого сообщения при переходе из поиска
  const [targetMessageId, setTargetMessageId] = useState<number | null>(null);
  // Храним ID последнего around запроса, чтобы не дублировать загрузку
  const [lastAroundId, setLastAroundId] = useState<number | null>(null);
  
  // Использование хука WebSocket для обработки сообщений
  useMessageWebSocket(
    activeChannel,
    user,
    {
      onMessageCreate: useCallback((newMessage: ExtendedMessage) => {
        addMessageToState(newMessage);
      }, [addMessageToState]),
      
      onMessageUpdate: useCallback((updatedMessage: ExtendedMessage) => {
        updateMessageInState(updatedMessage);
      }, [updateMessageInState]),
      
      onMessageDelete: useCallback((messageId: number) => {
        deleteMessageFromState(messageId);
      }, [deleteMessageFromState]),
      
      onMessageReadStatus: useCallback((range: { from: number; to: number }) => {
        updateMessageReadByCount(range, user.id);
      }, [updateMessageReadByCount, user.id]),
      
      onHighlightMessage: useCallback((messageId: number, duration: number = 1500) => {
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          newSet.add(messageId);
          return newSet;
        });
        
        // Remove highlight after duration
        setTimeout(() => {
          setHighlightedMessages(prev => {
            const newSet = new Set(prev);
            newSet.delete(messageId);
            return newSet;
          });
        }, duration);
      }, [setHighlightedMessages]),
      
      onUnreadMessage: useCallback((messageId: number) => {
        addUnreadMessage(messageId);
      }, [addUnreadMessage]),
      
      onMarkMessageAsRead: useCallback((messageId: number) => {
        // Update message status visually
        updateMessageReadStatus(messageId, user.id);
        
        // Update unread counters
        removeUnreadMessage(messageId);
        
        // Mark message as read using the hook's function
        markMessageAsRead(messageId);
      }, [updateMessageReadStatus, removeUnreadMessage, user.id, markMessageAsRead]),
      
      onNewMessageIndicator: useCallback(() => {
        // This was for setHasNewMessage which we removed
        // We can leave this empty or use it for other indicators
      }, []),
      
      onScrollToBottom: useCallback(() => {
        scrollToBottom();
      }, [scrollToBottom]),
      
      onMarkAllAsRead: useCallback(() => {
        // Update all messages to READ status and clear unread indicators
        markAllMessagesAsReadInState(user.id);
        
        // Mark all messages as read using the hook's function
        markAllMessagesAsRead();
      }, [markAllMessagesAsReadInState, user.id, markAllMessagesAsRead]),
      
      onUnreadCountChange: useCallback((change: number) => {
        updateUnreadCount(change);
      }, [updateUnreadCount])
    },
    {
      messagesContainerRef: messagesContainerRef as React.RefObject<HTMLElement>,
      convertToExtendedMessage,
      isScrolledToBottom,
      isJumpingToMessage: paginationState.isJumpingToMessage,
      loadingMode: paginationState.loadingMode,
      unreadMessagesBufferRef,
      addToReadBuffer
    }
  );
  
  
  const MESSAGES_PER_PAGE = 50;
  
  // Декларации функций объявлены заранее для React useCallback

  
  // Радикальное изменение: основной запрос только для initial загрузки и пагинации
  const shouldRunMainQuery = (activeChannel?.type === ChannelType.TEXT || activeChannel?.type === ChannelType.PRIVATE) && 
    !paginationState.skipMainQuery && 
    (paginationState.loadingMode === 'initial' || 
     paginationState.loadingMode === 'pagination' ||
     (paginationState.loadingMode === null && (paginationState.beforeId !== null || paginationState.afterId !== null)));
     
     
  const queryParams = shouldRunMainQuery ? {
    channelId: activeChannel?.id ?? 0,
    params: {
      size: MESSAGES_PER_PAGE,
      // При initial загрузке не передаем beforeId/afterId чтобы получить последние сообщения
      ...(paginationState.loadingMode !== 'initial' && paginationState.beforeId ? { before: paginationState.beforeId } : {}),
      ...(paginationState.loadingMode !== 'initial' && paginationState.afterId ? { after: paginationState.afterId } : {}),
    }
  } : { channelId: 0, params: {} };
  
  const { data: messagesData = [], isLoading, isFetching } = useGetMessagesQuery(
    queryParams,
    { 
      skip: !shouldRunMainQuery,
      refetchOnMountOrArgChange: true,
      // Форсируем новый запрос при изменении
      refetchOnReconnect: true,
      // Не используем кешированные данные для пагинации
      refetchOnFocus: false
    }
  );
  
  // Отдельный хук для around запроса
  const { data: aroundMessagesData, isLoading: isLoadingAround } = useGetMessagesQuery(
    (activeChannel?.type === ChannelType.TEXT || activeChannel?.type === ChannelType.PRIVATE) && paginationState.aroundMessageId && paginationState.loadingMode === 'around' ? {
      channelId: activeChannel?.id ?? 0,
      params: {
        size: MESSAGES_PER_PAGE,
        around: paginationState.aroundMessageId
      }
    } : { channelId: 0, params: {} },
    { 
      skip: !activeChannel || (activeChannel.type !== ChannelType.TEXT && activeChannel.type !== ChannelType.PRIVATE) || !paginationState.aroundMessageId || paginationState.loadingMode !== 'around'
    }
  );
  
  const [createMessage] = useCreateMessageMutation();
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const { notify } = useNotification();

  const canSendMessages = hasPermission(userPermissions, 'SEND_MESSAGES', isOwner);
  const canManageMessages = hasPermission(userPermissions, 'MANAGE_MESSAGES', isOwner);
  
  
  // Инициализация при входе в новый канал
  useEffect(() => {
    // Reset all states when channel changes
    resetMessageStates();
    paginationActions.setHasMoreMessages(true);
    paginationActions.setHasMoreMessagesAfter(true);
    paginationActions.setEnableAfterPagination(false);
    paginationActions.setBeforeId(null);
    paginationActions.setAfterId(null);
    setEditingMessageId(null);
    setCurrentDateLabel(null);
    setShowDateLabel(false);
    setShowScrollButton(false);
    setIsScrolledToBottom(true);
    setLoadingWithTimeout(false);
    lastAfterIdRef.current = null;
    lastBeforeIdRef.current = null;
    
    // Clear search state (navigation logic removed)
    
    // Сброс состояния поиска
    clearSearch();
    
    // Clear target message state
    setTargetMessageId(null);
    paginationActions.setAroundMessageId(null);
    paginationActions.setLoadingMode('initial');
    paginationActions.setIsJumpingToMessage(false);
    paginationActions.setInitialLoadComplete(false); // Reset initial load flag
    setLastAroundId(null);
    
    // Reset query control
    paginationActions.setSkipMainQuery(false);
    
    // Mark all messages as read when entering a channel
    if (activeChannel) {
      markAllMessagesAsRead();
    }
  }, [activeChannel?.id, markAllMessagesAsRead, resetMessageStates]); // Using id instead of the full object

  // scrollToBottom function is now provided by useMessageScroll hook
  
  // scrollToMessage function is now provided by useMessageScroll hook
  
  // Функция перехода к сообщению удалена

  // handleScrollToBottom теперь использует функцию из хука, но с дополнительной логикой
  const handleScrollToBottomWithPagination = useCallback(() => {    
    // Очищаем все состояния и сообщения для чистой загрузки
    setMessages([]);
    setTempMessages(new Map());
    messagesLengthRef.current = 0;
    
    // Сбрасываем все состояния пагинации
    paginationActions.setLoadingMode('initial');
    paginationActions.setIsJumpingToMessage(false);
    paginationActions.setBeforeId(null);
    paginationActions.setAfterId(null);
    paginationActions.setAroundMessageId(null);
    paginationActions.setSkipMainQuery(false);
    paginationActions.setHasMoreMessages(true);
    paginationActions.setHasMoreMessagesAfter(false); // Отключаем после пагинацию, так как мы в самом низу
    paginationActions.setEnableAfterPagination(false);
    
    // Очищаем ref'ы
    lastBeforeIdRef.current = null;
    lastAfterIdRef.current = null;
    setTargetMessageId(null);
    setLastAroundId(null);
    
    // Очищаем состояния непрочитанных сообщений
    setUnreadMessages(new Set());
    resetUnreadCounts();
    
    // Блокируем пагинацию на время загрузки
    setLoadingWithTimeout(true);
    
    // Сбрасываем disableAutoScroll чтобы разрешить прокрутку
    setDisableAutoScroll(false);
    
    // Даем время React обработать очистку сообщений, затем загружаем новые
    setTimeout(() => {
      // Форсируем новый запрос изменением loadingMode
      paginationActions.setLoadingMode('initial');
      
      // Прокручиваем вниз после загрузки (будет вызвано в эффекте)
      // handleScrollToBottom вызовется автоматически после загрузки initial сообщений
    }, 50);
  }, [paginationActions, setMessages, setTempMessages, setUnreadMessages, resetUnreadCounts, setTargetMessageId, setLastAroundId, setLoadingWithTimeout]);

  // Handle around messages
  useEffect(() => {
    if (aroundMessagesData && aroundMessagesData.length > 0 && paginationState.loadingMode === 'around') {      
      // Блокируем пагинацию на время обработки
      setLoadingWithTimeout(true);
      
      const newExtendedMessages = aroundMessagesData.map(convertToExtendedMessage);
      
      // Устанавливаем новые сообщения (старые уже очищены при клике на результат поиска)
      setMessages(newExtendedMessages);
      messagesLengthRef.current = newExtendedMessages.length;
      
      // Запоминаем ID around запроса
      setLastAroundId(paginationState.aroundMessageId);
      
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
        resetUnreadCounts(); // Reset first
        updateUnreadCount(unreadMessages.length); // Then set to correct value
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
      
      // НЕ сбрасываем isJumpingToMessage здесь - оставляем блокировку до завершения анимации
    }
  }, [aroundMessagesData, paginationState.loadingMode, convertToExtendedMessage, user.id, paginationActions]);

  // Handle messages load based on loading mode (excluding around)
  useEffect(() => {
    if (!activeChannel || (activeChannel.type !== ChannelType.TEXT && activeChannel.type !== ChannelType.PRIVATE)) return;
    
    // Пропускаем обработку для around режима (он обрабатывается отдельно)
    if (paginationState.loadingMode === 'around') return;
    
    // Пропускаем обработку если данные еще загружаются
    if (isLoading || isFetching) return;
    
    // Пропускаем если происходит переход к сообщению
    if (paginationState.isJumpingToMessage) return;
    
    // Пропускаем обработку если у нас есть beforeId или afterId (это пагинация)
    if (paginationState.beforeId !== null || paginationState.afterId !== null) return;
    
    // Пропускаем если мы только что загрузили данные через around
    if (lastAroundId !== null && messages.length > 0) return;
    
    // Set empty messages array when data is empty
    if (!messagesData || messagesData.length === 0) {
      setMessages([]);
      // Scroll to bottom only for initial load
      if (paginationState.loadingMode === 'initial') {
        setTimeout(() => {
          scrollToBottom();
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
        resetUnreadCounts(); // Reset first
        updateUnreadCount(unreadMessages.length); // Then set to correct value
      }
      
      // useLayoutEffect уже установил скролл, теперь только разблокируем пагинацию
      setTimeout(() => {
        // Вызываем scrollToBottom для обновления состояний и маркировки сообщений как прочитанных
        scrollToBottom();
        paginationActions.setLoadingMode(null); // Сбрасываем режим после обработки
        paginationActions.setInitialLoadComplete(true); // Устанавливаем флаг завершения initial загрузки
        setLoadingWithTimeout(false); // Разблокируем пагинацию
      }, 100); // Небольшая задержка для гарантии завершения всех обновлений
    }
  }, [activeChannel, messagesData, isLoading, isFetching, convertToExtendedMessage, user.id, scrollToBottom, paginationState.loadingMode, paginationState.isJumpingToMessage, paginationState.beforeId, paginationState.afterId, paginationActions, lastAroundId, messages.length]);

  // Store target message ID to pass to MessageList
  const targetMessageIdRef = useRef<number | null>(null);
  
  // Use useLayoutEffect to set scroll position before paint during initial load
  useLayoutEffect(() => {
    if (paginationState.loadingMode === 'initial' && messages.length > 0 && messagesContainerRef.current) {
      const container = messagesContainerRef.current;      
      // Temporarily disable smooth scrolling for instant positioning
      const originalScrollBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = 'auto';
      
      // Immediately set scroll to bottom before browser paints
      container.scrollTop = container.scrollHeight;
      
      // Also force update scroll position to handle virtual scrolling
      requestAnimationFrame(() => {
        if (container.scrollTop < container.scrollHeight - container.clientHeight - 10) {
          container.scrollTop = container.scrollHeight;
        }
        
        // Restore smooth scrolling after positioning
        container.style.scrollBehavior = originalScrollBehavior;
      });
    }
  }, [messages, paginationState.loadingMode]); // Changed to messages instead of messages.length for virtual scroll
  
  // Effect to handle target message navigation after around loading
  useEffect(() => {
    
    if (targetMessageId && messages.length > 0 && paginationState.loadingMode === 'around' && !isLoadingAround) {
      const targetExists = messages.some(msg => msg.id === targetMessageId);
      
      if (targetExists) {        
        // Продолжаем блокировать пагинацию во время анимации
        setLoadingWithTimeout(true);
        
        // Форсируем обновление виртуализации
        requestAnimationFrame(() => {
          // Устанавливаем ref для MessageList
          scrollToMessageIdRef.current = targetMessageId;
          
          // Триггерим обновление через изменение состояния
          setMessages(prev => [...prev]); // Форсируем пересчет виртуализации
          
        });
        
        // Highlight the target message
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          newSet.add(targetMessageId);
          return newSet;
        });
        setFocusedMessageId(targetMessageId);
        
        // Remove highlight after delay
        setTimeout(() => {
          setHighlightedMessages(prev => {
            const newSet = new Set(prev);
            newSet.delete(targetMessageId);
            return newSet;
          });
          setFocusedMessageId(null);
        }, 1500);
        
        // Даем время DOM обновиться
        setTimeout(() => {
          // Сбрасываем состояния после прокрутки
          setTargetMessageId(null);
          targetMessageIdRef.current = null;
          // НЕ очищаем scrollToMessageIdRef здесь - пусть MessageList сам это делает
          paginationActions.setAroundMessageId(null);
          
          // Подготавливаем пагинацию для нормальной работы после around
          if (messages.length > 0) {
            // Сбрасываем lastBeforeIdRef и lastAfterIdRef чтобы пагинация могла работать
            lastBeforeIdRef.current = null;
            lastAfterIdRef.current = null;
            
            // Включаем обе стороны пагинации, чтобы пользователь мог скроллить и вверх, и вниз
            paginationActions.setHasMoreMessages(true);
            paginationActions.setHasMoreMessagesAfter(true);
            paginationActions.setEnableAfterPagination(true);
          }
          
          // Разблокируем автопрокрутку и пагинацию через большую задержку
          setTimeout(() => {
            // Только теперь сбрасываем режим загрузки и skipMainQuery
            paginationActions.setLoadingMode(null);
            paginationActions.setIsJumpingToMessage(false);
            paginationActions.setSkipMainQuery(false);
            setDisableAutoScroll(false);
            setLoadingWithTimeout(false); // Разблокируем пагинацию
          }, 300); // Уменьшенная задержка для быстрой разблокировки пагинации
        }, 200);
      } 
    }
  }, [messages.length, targetMessageId, paginationState.loadingMode, isLoadingAround, paginationActions, setHighlightedMessages, setFocusedMessageId, setMessages]);

  // Remove old auto-scroll effect - now handled in main message loading effect

  
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
        clearSearch();
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


  const handleSendMessage = useCallback(async (values: { content: string, images?: File[] }, { resetForm }: { resetForm: () => void }) => {
    if (!activeChannel || !user) return;

    const content = values.content.trim();
    const hasImages = values.images && values.images.length > 0;
    
    // Require either content or images
    if (!content && !hasImages) return;

    // Clear the input field immediately
    resetForm();
    
    // Declare tempId and capture reply message outside try block
    const tempId = Date.now();
    const replyMessage = replyingToMessageRef.current; // Use ref to get current value
    
    // Clear the reply state immediately after capturing the value
    setReplyingToMessage(null);
    
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
        scrollToBottom();
      }, 10);
      
      resetForm();

      // Prepare payload for API request
      const apiPayload = {
        channelId: activeChannel.id,
        content: values.content,
        ...(hasImages ? { attachments: values.images } : {}),
        ...(replyMessage?.id ? { replyId: replyMessage.id } : {})
      };
      
      // Send message to the server
      const result = await createMessage(apiPayload).unwrap();
      
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
      
      // Type guard for error object
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403 && 'data' in error && typeof error.data === 'object' && error.data !== null && 'type' in error.data && error.data.type === 'ACCESS_DENIED') {
        notify('Недостаточно прав для отправки сообщения', 'error');
      } else {
        notify('Ошибка при отправке сообщения', 'error');
      }
    }
  }, [activeChannel, user, createMessage, notify, scrollToBottom]);

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
  }, [editingMessageId, activeChannel, updateMessage, messages, notify]);

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

  // Handle search result click
  const handleSearchResultClick = useCallback((message: Message) => {
    // Check if message exists in current list
    const messageExists = messages.some(msg => msg.id === message.id);
    
    if (messageExists) {      
      // Close search panel
      clearSearch();
      
      // Force scroll using state to trigger re-render
      setForceScrollToMessageId(message.id);
      
      // Also set the ref for backup
      requestAnimationFrame(() => {
        scrollToMessageIdRef.current = message.id;
      });
      
      // Clear any existing highlights
      setHighlightedMessages(new Set());
      setFocusedMessageId(null);
      
      // Highlight the message
      setHighlightedMessages(prev => {
        const newSet = new Set(prev);
        newSet.add(message.id);
        return newSet;
      });
      setFocusedMessageId(message.id);
      
      // Remove highlight after delay
      setTimeout(() => {
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(message.id);
          return newSet;
        });
        setFocusedMessageId(null);
      }, 1500);
    } else {      
      // Set loading mode around
      paginationActions.setLoadingMode('around');

      // Block main query
      paginationActions.setSkipMainQuery(true);
      
      // Block all queries
      paginationActions.setIsJumpingToMessage(true);
      
      // Close search panel
      clearSearch();
      
      // Block auto-scroll and pagination
      setDisableAutoScroll(true);
      setLoadingWithTimeout(true); // Block pagination
      
      // Clear beforeId to avoid conflicts
      paginationActions.setBeforeId(null);
      
      // Clear messages before loading new ones
      // This prevents scroll issues due to message removal
      setMessages([]);
      setTempMessages(new Map());
      messagesLengthRef.current = 0;
      
      // Clear unread message states
      setUnreadMessages(new Set());
      resetUnreadCounts();
      
      // Set target message and navigate
      setTargetMessageId(message.id);
      paginationActions.setAroundMessageId(message.id);
    }
  }, [messages, clearSearch, paginationActions, setDisableAutoScroll, setLoadingWithTimeout, setMessages, setTempMessages, messagesLengthRef, setUnreadMessages, resetUnreadCounts, setTargetMessageId, scrollToMessageIdRef, setHighlightedMessages, setFocusedMessageId]);

  // Handle scroll pagination - DISABLED because virtual scroll handles it
  // useEffect(() => {
  //   const container = messagesContainerRef.current;
  //   if (!container) return;

  //   let scrollThrottle = false;
    
  //   const handleScroll = () => {
  //     // Throttle scroll updates
  //     if (scrollThrottle) return;
  //     scrollThrottle = true;
      
  //     requestAnimationFrame(() => {
  //       // Используем функцию пагинации из хука
  //       paginationActions.handleScrollPagination(container, messages, MESSAGES_PER_PAGE);
        
  //       // Check for unread messages in the viewport to highlight them (less frequently)
  //       const visibleElements = container.querySelectorAll('.message-item');
  //       if (visibleElements.length) {
  //         // Process visible elements for highlighting
  //         visibleElements.forEach(element => {
  //           const rect = element.getBoundingClientRect();
  //           const containerRect = container.getBoundingClientRect();
  //           const isVisible = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
            
  //           if (isVisible) {
  //             // Highlight unread messages
  //             const messageId = parseInt(element.getAttribute('data-msg-id') || '0', 10);
  //             if (messageId) {
  //               const message = messages.find(m => m.id === messageId);
  //               if (message && message.author.id !== user.id && message.status !== MessageStatus.READ) {
  //                 // Add to highlighted set for visual effect
  //                 setHighlightedMessages(prev => {
  //                   const newSet = new Set(prev);
  //                   newSet.add(messageId);
  //                   return newSet;
  //                 });
                  
  //                 // Remove highlight after 1.5 seconds
  //                 setTimeout(() => {
  //                   setHighlightedMessages(prev => {
  //                     const newSet = new Set(prev);
  //                     newSet.delete(messageId);
  //                     return newSet;
  //                   });
  //                 }, 1500);
  //               }
  //             }
  //           }
  //         });
  //       }
        
  //       scrollThrottle = false;
  //     });
  //   };

  //   container.addEventListener('scroll', handleScroll, { passive: true });
  //   return () => {
  //     container.removeEventListener('scroll', handleScroll);
  //   };
  // }, [messages, paginationActions, user.id]);

  // Handle pagination loading
  useEffect(() => {
    if (messagesData && messagesData.length > 0 && paginationState.beforeId !== null && paginationState.afterId === null && paginationState.loadingMode === 'pagination' && !isLoading && !isFetching) {
      try {
      // Проверяем, что данные действительно соответствуют запросу
      const firstMessageId = messagesData[0]?.id;
      if (firstMessageId && firstMessageId >= paginationState.beforeId) {
        // Сбрасываем состояние пагинации при ошибке
        setLoadingWithTimeout(false);
        paginationActions.setLoadingMode(null);
        paginationActions.setBeforeId(null);
        return;
      }
      
      const container = messagesContainerRef.current;
      if (!container) return;
      
      // Prepare scroll correction before updating messages
      if (scrollCorrectionRef.current) {
        scrollCorrectionRef.current.prepareScrollCorrection();
        scrollCorrectionRef.current.setDisableSmoothScroll(true);
      }
      
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

      // Re-enable smooth scroll after a delay
      setTimeout(() => {
        if (scrollCorrectionRef.current) {
          scrollCorrectionRef.current.setDisableSmoothScroll(false);
        }
        setLoadingWithTimeout(false);
        paginationActions.setLoadingMode(null);
      }, 100);
      } catch (error) {
        console.error('Error in pagination loading (before):', error);
        setLoadingWithTimeout(false);
        paginationActions.setLoadingMode(null);
      }
    }
  }, [messagesData, paginationState.beforeId, convertToExtendedMessage, paginationState.loadingMode, isLoading, isFetching, paginationActions, setLoadingWithTimeout]);

  // Handle pagination loading for after (scroll down)
  useEffect(() => {
    if (messagesData && messagesData.length > 0 && paginationState.afterId !== null && paginationState.beforeId === null && paginationState.loadingMode === 'pagination' && !isLoading && !isFetching) {
      try {
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
          setLoadingWithTimeout(false);
          paginationActions.setLoadingMode(null);
          paginationActions.setAfterId(null);
          lastAfterIdRef.current = null;
          return;
        }
        
        // Если есть новые сообщения, продолжаем с ними
        dataToProcess = newMessages;
      }
      
      const container = messagesContainerRef.current;
      if (!container) {
        setLoadingWithTimeout(false);
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
        setLoadingWithTimeout(false);
        paginationActions.setLoadingMode(null);
        // Сбрасываем afterId если достигли конца
        if (!paginationState.hasMoreMessagesAfter) {
          paginationActions.setAfterId(null);
          lastAfterIdRef.current = null;
        }
        
        // Сбрасываем кулдаун через небольшую задержку чтобы дать время UI обновиться
        setTimeout(() => {
          paginationActions.clearAfterPaginationCooldown();
        }, 500);
      });
      } catch (error) {
        console.error('Error in pagination loading (after):', error);
        setLoadingWithTimeout(false);
        paginationActions.setLoadingMode(null);
        paginationActions.clearAfterPaginationCooldown();
      }
    }
  }, [messagesData, paginationState.afterId, convertToExtendedMessage, paginationState.loadingMode, isLoading, isFetching, paginationActions, paginationState.hasMoreMessagesAfter, lastAfterIdRef, setLoadingWithTimeout]);


  // Messages rendering logic has been moved to the MessageList component

  // Add effect to track scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Для обнаружения намеренного скролла вверх
    let lastScrollTop = container.scrollTop;
    let intentionalScrollUp = false;
    let scrollMovementStartTime = 0;
    let scrollTimeoutId: NodeJS.Timeout | null = null;
    let scrollThrottle = false;

    const handleScroll = () => {
      // Throttle scroll updates
      if (scrollThrottle) return;
      scrollThrottle = true;
      
      requestAnimationFrame(() => {
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
        markAllMessagesAsRead();
        
        // Update all messages to READ status
        setMessages(prev => prev.map(msg => (
          msg.author.id !== user.id 
            ? { ...msg, status: MessageStatus.READ }
            : msg
        )));
        
        // Clear all unread indicators
        setUnreadMessages(new Set());
        resetUnreadCounts();
          }
      
        // Set a timeout to determine when scrolling has stopped
        scrollTimeoutId = setTimeout(() => {
          scrollTimeoutId = null;
        }, 150);
        
        scrollThrottle = false;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeChannel, paginationState.enableAfterPagination, paginationState.hasMoreMessagesAfter, messages]);


  // Debounced sending of unread messages is now handled by useMessageReadStatus hook




  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Очищаем таймеры
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Add effect to handle scroll to bottom
  useEffect(() => {
    if (isScrolledToBottom && newMessagesCount > 0) {
        resetUnreadCounts();
    }
  }, [isScrolledToBottom, newMessagesCount, resetUnreadCounts]);

  // Effect to handle forced scroll to message
  useEffect(() => {
    if (forceScrollToMessageId !== null) {
      scrollToMessageIdRef.current = forceScrollToMessageId;
      
      // Clear the force scroll state after a short delay
      setTimeout(() => {
        setForceScrollToMessageId(null);
      }, 100);
    }
  }, [forceScrollToMessageId]);

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
            scrollToBottom();
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

  // Define a component to render message list
  const renderMessages = () => (
    <MessageList
      activeChannel={activeChannel}
      messages={messages}
      tempMessages={tempMessages}
      searchMode={searchMode}
      searchQuery={searchQuery}
      highlightedMessages={highlightedMessages}
      focusedMessageId={focusedMessageId}
      unreadMessages={unreadMessages}
      isLoadingMore={isLoadingMoreRef.current}
      isLoadingAround={isLoadingAround}
      editingMessageId={editingMessageId}
      user={user}
      hubId={hubId}
      paginationState={paginationState}
      messagesPerPage={MESSAGES_PER_PAGE}
      showDateLabel={showDateLabel}
      currentDateLabel={currentDateLabel}
      messagesContainerRef={messagesContainerRef}
      messagesEndRef={messagesEndRef}
      editInputRef={editInputRef}
      highlightTimeoutRef={highlightTimeoutRef}
      scrollToMessageIdRef={scrollToMessageIdRef}
      setHighlightedMessages={setHighlightedMessages}
      setFocusedMessageId={setFocusedMessageId}
      setEditingMessageId={setEditingMessageId}
      setMessages={setMessages}
      setTempMessages={setTempMessages}
      setReplyingToMessage={setReplyingToMessage}
      setTargetMessageId={setTargetMessageId}
      paginationActions={paginationActions}
      handleEditMessage={handleEditMessage}
      handleDeleteMessage={handleDeleteMessage}
      scrollCorrectionRef={scrollCorrectionRef}
      forceScrollToMessageId={forceScrollToMessageId}
    />
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
      {/* Delete Message Dialog */}
      <DeleteMessageDialog
        open={deleteModalOpen}
        messageToDelete={messageToDelete}
        deleteForEveryone={deleteForEveryone}
        canManageMessages={canManageMessages}
        messages={messages}
        userId={user.id}
        onClose={() => {
          setDeleteModalOpen(false);
          setMessageToDelete(null);
          setDeleteForEveryone(false);
        }}
        onConfirm={confirmDeleteMessage}
        onDeleteForEveryoneChange={(value) => setDeleteForEveryone(value)}
      />
      <ChatHeader
        activeChannel={activeChannel}
        searchMode={searchMode}
        setSearchMode={setSearchMode}
        searchQuery={searchQuery}
        searchInputRef={searchInputRef}
        searchResultsRef={searchResultsRef}
        showSearchResults={showSearchResults}
        setShowSearchResults={setShowSearchResults}
        searchResults={searchResults}
        isSearching={isSearching}
        debouncedSearchQuery={debouncedSearchQuery}
        handleSearchInputChange={handleSearchInputChange}
        clearSearch={clearSearch}
        onSearchResultClick={handleSearchResultClick}
        isLoadingMessages={isLoading || isFetching}
        isLoadingAround={isLoadingAround}
        paginationState={{
          loadingMode: paginationState.loadingMode,
          beforeId: paginationState.beforeId,
          afterId: paginationState.afterId,
          isJumpingToMessage: paginationState.isJumpingToMessage,
        }}
      />

      {isLoading && !paginationState.beforeId ? renderSkeleton() : renderMessages()}

      {/* New messages indicator and scroll button */}
      <NewMessagesIndicator
        showScrollButton={showScrollButton}
        newMessagesCount={newMessagesCount}
        unreadCount={unreadCount}
        replyingToMessage={!!replyingToMessage}
        onScrollToBottom={handleScrollToBottomWithPagination}
      />

      <ChatFooter
        activeChannel={activeChannel}
        canSendMessages={canSendMessages}
        sending={sending}
        replyingToMessage={replyingToMessage}
        onSendMessage={handleSendMessage}
        onReplyCancel={() => setReplyingToMessage(null)}
        onReplyClick={scrollToMessage}
      />
      
    </Box>
  );
};

export default MainChatArea;