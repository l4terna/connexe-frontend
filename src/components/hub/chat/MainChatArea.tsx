import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Fade, IconButton, Button, Paper, Skeleton, Checkbox } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchBar from './SearchBar';
import MessageInput from './MessageInput';
import MessageList from './MessageList';
import { useNotification } from '@/context/NotificationContext';
import { hasPermission } from '@/utils/rolePermissions';
import AppModal from '../../AppModal';
import MessageActionsPortal from './MessageActionsPortal';
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
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<ExtendedMessage | null>(null);
  const replyingToMessageRef = useRef<ExtendedMessage | null>(null);
  // Использование хука пагинации
  const { state: paginationState, actions: paginationActions, isLoadingMoreRef, lastBeforeIdRef, lastAfterIdRef } = useMessagePagination();
  
  // Refs должны быть объявлены до использования в хуках
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
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
  const [tempMessages, setTempMessages] = useState<Map<string, ExtendedMessage>>(new Map());
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [newMessagesCount, setNewMessagesCount] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const messagesLengthRef = useRef<number>(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
      setTargetMessageId(messageId);
      paginationActions.setAroundMessageId(messageId);
    }
  });
  
  // Состояние для целевого сообщения при переходе из поиска
  const [targetMessageId, setTargetMessageId] = useState<number | null>(null);
  
  // Helper function to convert Message to ExtendedMessage
  const convertToExtendedMessage = useCallback((message: Message): ExtendedMessage => {
    return {
      ...message,
      status: 'status' in message ? (message as any).status : MessageStatus.SENT // Use existing status or default to SENT
      // reply field is already preserved via spread operator
    };
  }, []);
  
  // Использование хука WebSocket для обработки сообщений
  useMessageWebSocket(
    activeChannel,
    user,
    {
      onMessageCreate: useCallback((newMessage: ExtendedMessage) => {
        setMessages(prevMessages => {
          // Check if message already exists
          const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
          if (messageExists) return prevMessages;
          
          // Add new message
          return [...prevMessages, newMessage];
        });
      }, []),
      
      onMessageUpdate: useCallback((updatedMessage: ExtendedMessage) => {
        setMessages(prevMessages => {
          // Check if message exists in our list
          const messageExists = prevMessages.some(msg => msg.id === updatedMessage.id);
          if (!messageExists) return prevMessages;

          // Update the message
          return prevMessages.map(msg => 
            msg.id === updatedMessage.id ? updatedMessage : msg
          );
        });
      }, []),
      
      onMessageDelete: useCallback((messageId: number) => {
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
      }, []),
      
      onMessageReadStatus: useCallback((range: { from: number; to: number }) => {
        // Увеличиваем read_by_count для всех сообщений в диапазоне от from до to включительно
        setMessages(prevMessages => {
          return prevMessages.map(msg => {
            // Проверяем, что сообщение входит в диапазон и принадлежит текущему пользователю
            if (msg.id >= range.from && msg.id <= range.to && msg.author.id === user.id) {
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
      }, [user.id]),
      
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
        setUnreadMessages(prev => {
          const newSet = new Set(prev);
          newSet.add(messageId);
          return newSet;
        });
        setUnreadCount(prev => prev + 1);
        setNewMessagesCount(prev => prev + 1);
      }, []),
      
      onMarkMessageAsRead: useCallback((messageId: number) => {
        // Update message status visually
        setMessages(prev => prev.map(msg => 
          msg.id === messageId && msg.author.id !== user.id
            ? { ...msg, status: MessageStatus.READ }
            : msg
        ));
        
        // Update unread counters
        setUnreadMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(messageId);
          return newSet;
        });
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNewMessagesCount(prev => Math.max(0, prev - 1));
        
        // Mark message as read using the hook's function
        markMessageAsRead(messageId);
      }, [user.id, markMessageAsRead]),
      
      onNewMessageIndicator: useCallback(() => {
        // This was for setHasNewMessage which we removed
        // We can leave this empty or use it for other indicators
      }, []),
      
      onScrollToBottom: useCallback(() => {
        scrollToBottom();
      }, [scrollToBottom]),
      
      onMarkAllAsRead: useCallback(() => {
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
        
        // Mark all messages as read using the hook's function
        markAllMessagesAsRead();
      }, [user.id, markAllMessagesAsRead]),
      
      onUnreadCountChange: useCallback((change: number) => {
        setUnreadCount(prev => Math.max(0, prev + change));
        setNewMessagesCount(prev => Math.max(0, prev + change));
      }, [])
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
  
  const [createMessage] = useCreateMessageMutation();
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const { notify } = useNotification();

  const canSendMessages = hasPermission(userPermissions, 'SEND_MESSAGES', isOwner);
  const canManageMessages = hasPermission(userPermissions, 'MANAGE_MESSAGES', isOwner);
  
  
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
    setIsScrolledToBottom(true);
    isLoadingMoreRef.current = false;
    lastAfterIdRef.current = null;
    lastBeforeIdRef.current = null;
    
    // Clear search state (navigation logic removed)
    
    // Сброс состояния поиска
    clearSearch();
    
    // Clear unread state
    setUnreadMessages(new Set());
    setUnreadCount(0);
    setNewMessagesCount(0);
    
    // Clear target message state
    setTargetMessageId(null);
    paginationActions.setAroundMessageId(null);
    paginationActions.setLoadingMode('initial');
    paginationActions.setIsJumpingToMessage(false);
    
    // Reset query control
    paginationActions.setSkipMainQuery(false);
    
    // Mark all messages as read when entering a channel
    if (activeChannel) {
      markAllMessagesAsRead();
    }
  }, [activeChannel?.id, markAllMessagesAsRead]); // Using id instead of the full object

  // scrollToBottom function is now provided by useMessageScroll hook
  
  // scrollToMessage function is now provided by useMessageScroll hook
  
  // Функция перехода к сообщению удалена

  // handleScrollToBottom теперь использует функцию из хука, но с дополнительной логикой
  const handleScrollToBottomWithPagination = useCallback(() => {
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
    
    // Update local state
    setUnreadMessages(new Set());
    setUnreadCount(0);
    setNewMessagesCount(0);
    
    // Вызываем функцию из хука, которая прокрутит вниз и отметит сообщения как прочитанные
    handleScrollToBottom();
  }, [paginationState.loadingMode, paginationState.isJumpingToMessage, handleScrollToBottom, paginationActions]);

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
    isLoadingMoreRef.current = true; // Block pagination
    
    // Clear beforeId to avoid conflicts
    paginationActions.setBeforeId(null);
    
    // Clear messages before loading new ones
    // This prevents scroll issues due to message removal
    setMessages([]);
    setTempMessages(new Map());
    messagesLengthRef.current = 0;
    
    // Clear unread message states
    setUnreadMessages(new Set());
    setUnreadCount(0);
    setNewMessagesCount(0);
    
    // Set target message and navigate
    setTargetMessageId(message.id);
    paginationActions.setAroundMessageId(message.id);
  }, [clearSearch, paginationActions, setDisableAutoScroll, isLoadingMoreRef, setMessages, setTempMessages, messagesLengthRef, setUnreadMessages, setUnreadCount, setNewMessagesCount, setTargetMessageId]);

  // Handle scroll pagination
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Используем функцию пагинации из хука
      paginationActions.handleScrollPagination(container, messages, MESSAGES_PER_PAGE);
      
      // Check for unread messages in the viewport to highlight them
      const visibleElements = container.querySelectorAll('.message-item');
      if (!visibleElements.length) return;
      
      // Process visible elements for highlighting
      visibleElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const isVisible = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
        
        if (isVisible) {
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
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [messages, paginationActions, user.id]);

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
        markAllMessagesAsRead();
        
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
          }
      
      // Set a timeout to determine when scrolling has stopped
      scrollTimeoutId = setTimeout(() => {
        scrollTimeoutId = null;
      }, 150);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeChannel, paginationState.enableAfterPagination, paginationState.hasMoreMessagesAfter, messages]);


  // Debounced sending of unread messages is now handled by useMessageReadStatus hook

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);


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
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Add effect to handle scroll to bottom
  useEffect(() => {
    if (isScrolledToBottom) {
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
      hoverTimeoutRef={hoverTimeoutRef}
      isHoveringPortal={isHoveringPortal}
      setHighlightedMessages={setHighlightedMessages}
      setFocusedMessageId={setFocusedMessageId}
      setEditingMessageId={setEditingMessageId}
      setMessages={setMessages}
      setTempMessages={setTempMessages}
      setReplyingToMessage={setReplyingToMessage}
      setHoveredMessage={setHoveredMessage}
      setTargetMessageId={setTargetMessageId}
      paginationActions={paginationActions}
      handleEditMessage={handleEditMessage}
      handleDeleteMessage={handleDeleteMessage}
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
        
        <SearchBar
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
        />
      </Box>

      {isLoading && !paginationState.beforeId ? renderSkeleton() : renderMessages()}

      {/* Scroll to bottom button */}
      <Fade in={showScrollButton}>
        <IconButton
          onClick={handleScrollToBottomWithPagination}
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
            onClick={handleScrollToBottomWithPagination}
          >
            <KeyboardArrowDownIcon />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {(newMessagesCount || unreadCount)} {(newMessagesCount || unreadCount) === 1 ? 'новое сообщение' : 'новых сообщений'}
            </Typography>
          </Paper>
        </Box>
      </Fade>

      <MessageInput
        activeChannel={activeChannel}
        canSendMessages={canSendMessages}
        sending={sending}
        replyingToMessage={replyingToMessage}
        onSendMessage={handleSendMessage}
        onReplyCancel={() => setReplyingToMessage(null)}
        onReplyClick={(messageId) => {
          // Find and scroll to the original message
          const messageElement = document.querySelector(`[data-msg-id='${messageId}']`);
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
            setFocusedMessageId(messageId);
            
            // Add to highlighted set for visual effect
            setHighlightedMessages(() => {
              const newSet = new Set<number>();
              newSet.add(messageId);
              return newSet;
            });
            
            // Remove highlight after 3 seconds
            highlightTimeoutRef.current = setTimeout(() => {
              setHighlightedMessages(prev => {
                const newSet = new Set(prev);
                newSet.delete(messageId);
                return newSet;
              });
              setFocusedMessageId(null);
              highlightTimeoutRef.current = null;
            }, 3000);
          }
        }}
      />
      
      {/* Portal for message actions */}
      {hoveredMessage && (
        <MessageActionsPortal
          targetElement={hoveredMessage.element}
          messageId={hoveredMessage.message.id}
          authorId={hoveredMessage.message.author.id}
          currentUserId={user.id}
          onReply={() => {
            setReplyingToMessage(hoveredMessage.message);
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