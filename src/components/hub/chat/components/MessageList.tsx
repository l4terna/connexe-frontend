import React from 'react';
import { Box, Typography, Fade, Skeleton, IconButton } from '@mui/material';
import UserAvatar from '../../../UserAvatar';
import ChatMessageItem from './ChatMessageItem';
import { Channel } from '@/api/channels';
import Input from '../../../common/Input';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { ExtendedMessage } from '../types/message';
import { LoadingMode } from '../hooks/useMessagePagination';
import { useSignMediaUrlsMutation } from '@/api/media';
import { useMedia } from '@/context/MediaContext';

// Validation schema for editing messages
const messageSchema = Yup.object().shape({
  content: Yup.string()
  .min(1, 'Message cannot be empty')
  .max(2000, 'Message is too long')
});

// Helper functions with caching
const dateFormatCache = new Map<string, string>();

const formatDateForGroup = (timestamp: string) => {
  const dateString = timestamp.split('T')[0]; // Use date part as cache key
  
  if (dateFormatCache.has(dateString)) {
  return dateFormatCache.get(dateString)!;
  }
  
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let result: string;
  if (date.toDateString() === today.toDateString()) {
  result = 'Сегодня';
  } else if (date.toDateString() === yesterday.toDateString()) {
  result = 'Вчера';
  } else {
  const isCurrentYear = date.getFullYear() === today.getFullYear();
  const formattedDate = date.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(isCurrentYear ? {} : { year: 'numeric' })
  });
  result = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  }
  
  dateFormatCache.set(dateString, result);
  return result;
};

const isWithinTimeThreshold = (timestamp1: string, timestamp2: string, thresholdMinutes: number = 30) => {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  const diffInMinutes = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
  return diffInMinutes <= thresholdMinutes;
};

const isSameDay = (timestamp1: string, timestamp2: string) => {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  return date1.toDateString() === date2.toDateString();
};

interface MessageListProps {
  activeChannel: Channel | null;
  messages: ExtendedMessage[];
  tempMessages: Map<string, ExtendedMessage>;
  searchMode?: boolean;
  searchQuery?: string;
  highlightedMessages: Set<number>;
  focusedMessageId: number | null;
  unreadMessages: Set<number>;
  isLoadingMore: boolean;
  isLoadingAround: boolean;
  editingMessageId: number | null;
  user: { id: number; login: string; avatar: string | null };
  hubId?: number;
  paginationState: {
  loadingMode: LoadingMode;
  isJumpingToMessage: boolean;
  beforeId: number | null;
  afterId: number | null;
  hasMoreMessages: boolean;
  hasMoreMessagesAfter: boolean;
  enableAfterPagination: boolean;
  aroundMessageId: number | null;
  skipMainQuery: boolean;
  };
  messagesPerPage: number;
  showDateLabel: boolean;
  currentDateLabel: string | null;
  
  // Refs
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  highlightTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  scrollToMessageIdRef?: React.MutableRefObject<number | null>;
  hoverTimeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>;
  isHoveringPortal?: React.MutableRefObject<boolean>;
  scrollCorrectionRef?: React.RefObject<{
  prepareScrollCorrection: () => void;
  setDisableSmoothScroll: (value: boolean) => void;
  } | null>;
  forceScrollToMessageId?: number | null;

  // Actions
  setHighlightedMessages: React.Dispatch<React.SetStateAction<Set<number>>>;
  setFocusedMessageId: ((id: number | null) => void) | React.Dispatch<React.SetStateAction<number | null>>;
  setEditingMessageId: React.Dispatch<React.SetStateAction<number | null>>;
  setMessages: React.Dispatch<React.SetStateAction<ExtendedMessage[]>>;
  setTempMessages: React.Dispatch<React.SetStateAction<Map<string, ExtendedMessage>>>;
  setReplyingToMessage: React.Dispatch<React.SetStateAction<ExtendedMessage | null>>;
  setHoveredMessage?: React.Dispatch<React.SetStateAction<{
  element: HTMLElement;
  message: ExtendedMessage;
  } | null>>;
  setTargetMessageId: React.Dispatch<React.SetStateAction<number | null>>;
  paginationActions: {
  setIsJumpingToMessage: (value: boolean) => void;
  setSkipMainQuery: (value: boolean) => void;
  setBeforeId: (value: number | null) => void;
  setAfterId: (value: number | null) => void;
  setAroundMessageId: (value: number | null) => void;
  setLoadingMode: (value: LoadingMode) => void;
  setHasMoreMessages: (value: boolean) => void;
  setHasMoreMessagesAfter: (value: boolean) => void;
  setEnableAfterPagination: (value: boolean) => void;
  };
  
  // Handler functions
  handleEditMessage: (values: { content: string }, { resetForm }: { resetForm: () => void }) => Promise<void>;
  handleDeleteMessage: (messageId: number) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  activeChannel,
  messages,
  tempMessages,
  searchMode,
  searchQuery,
  highlightedMessages,
  focusedMessageId,
  unreadMessages,
  isLoadingMore,
  isLoadingAround,
  editingMessageId,
  user,
  hubId,
  paginationState,
  messagesPerPage,
  showDateLabel,
  currentDateLabel,
  messagesContainerRef,
  messagesEndRef,
  editInputRef,
  highlightTimeoutRef,
  scrollToMessageIdRef,
  hoverTimeoutRef,
  isHoveringPortal,
  scrollCorrectionRef,
  forceScrollToMessageId,
  setHighlightedMessages,
  setFocusedMessageId,
  setEditingMessageId,
  setMessages,
  setTempMessages,
  setReplyingToMessage,
  setHoveredMessage,
  setTargetMessageId,
  paginationActions,
  handleEditMessage,
  handleDeleteMessage
}) => {
  const [signMediaUrls] = useSignMediaUrlsMutation();
  const { setSignedUrls, hasSignedUrl } = useMedia();
  
  // Cache for tracking signing progress to prevent duplicate requests
  const signingInProgress = React.useRef(new Set<string>());
  
  // Sort messages by creation time - memoized for performance
  const sortedMessages = React.useMemo(() => {
  return [...messages].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  }, [messages]);

  // Effect to collect attachments and sign media URLs after messages are loaded
  React.useEffect(() => {
    if (!messages.length) return;

    // Collect unique storage keys from all messages with attachments
    const storageKeys = new Set<string>();
    
    messages.forEach(message => {
      if (message.attachments && message.attachments.length > 0) {
        message.attachments.forEach(attachment => {
          if (attachment.trim()) { // Only add non-empty strings
            storageKeys.add(attachment);
          }
        });
      }
    });

    // Filter out already signed or currently signing URLs
    const unsignedKeys = Array.from(storageKeys).filter(key => 
      !hasSignedUrl(key) && !signingInProgress.current.has(key)
    );

    // If there are new storage keys to sign, make the API call
    if (unsignedKeys.length > 0) {
      // Mark these keys as currently being signed
      unsignedKeys.forEach(key => signingInProgress.current.add(key));
      
      signMediaUrls({ storage_keys: unsignedKeys })
        .unwrap()
        .then(response => {
          console.log('Media URLs signed:', response);
          // Store the signed URLs in context
          setSignedUrls(response);
          // Remove from signing progress
          unsignedKeys.forEach(key => signingInProgress.current.delete(key));
        })
        .catch(error => {
          console.error('Failed to sign media URLs:', error);
          // Remove from signing progress on error
          unsignedKeys.forEach(key => signingInProgress.current.delete(key));
        });
    }
  }, [messages, signMediaUrls, setSignedUrls, hasSignedUrl]);

  // Memoize expensive computations
  const emptyMessages = React.useMemo(() => 
    messages.length === 0 && tempMessages.size === 0, 
    [messages.length, tempMessages.size]
  );

  const shouldShowEmptyState = React.useMemo(() => 
    emptyMessages && 
    !isLoadingMore && 
    !isLoadingAround &&
    paginationState.loadingMode !== 'initial' &&
    paginationState.loadingMode !== 'around' &&
    !paginationState.isJumpingToMessage &&
    !!activeChannel,
    [emptyMessages, isLoadingMore, isLoadingAround, paginationState.loadingMode, paginationState.isJumpingToMessage, activeChannel]
  );

  // Memoize combined messages for performance with temp message marking
  const allMessages = React.useMemo(() => {
    const tempMessageArray = Array.from(tempMessages.entries()).map(([tempId, msg]) => ({
      ...msg,
      __isTemp: true, // Mark temporary messages
      __tempId: tempId // Include the temp ID for unique React keys
    }));
    return [...sortedMessages, ...tempMessageArray];
  }, [sortedMessages, tempMessages]);

  // Add empty state JSX - will be rendered when shouldShowEmptyState is true
  const emptyStateMessage = shouldShowEmptyState && (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Typography variant="body1" color="text.secondary">
        {searchMode ? 'No messages found matching your search.' : 'No messages yet. Start a conversation!'}
      </Typography>
    </Box>
  );

  // Handle reply click function - moved outside component to prevent hook order issues
  const handleReplyClick = React.useCallback((replyId: number) => {
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

      // Очищаем предыдущие состояния
      setMessages([]);
      setTempMessages(new Map());
      paginationActions.setBeforeId(null);
      paginationActions.setAfterId(null);
      paginationActions.setHasMoreMessages(true);
      paginationActions.setHasMoreMessagesAfter(true);
      paginationActions.setEnableAfterPagination(true);

      // Устанавливаем целевое сообщение и режим загрузки
      setTargetMessageId(replyId);
      paginationActions.setAroundMessageId(replyId);
      paginationActions.setLoadingMode('around');

      // После загрузки around эффект автоматически прокрутит к сообщению
    }
  }, [sortedMessages, setFocusedMessageId, setHighlightedMessages, highlightTimeoutRef, paginationActions, setMessages, setTempMessages, setTargetMessageId]);

  // Create stable callbacks for event handlers to prevent re-renders
  const onReplyCallback = React.useCallback((message: ExtendedMessage) => {
    setReplyingToMessage(message);
  }, [setReplyingToMessage]);

  const onEditCallback = React.useCallback((messageId: ExtendedMessage | number) => 
    setEditingMessageId(typeof messageId === 'number' ? messageId : messageId.id), 
    [setEditingMessageId]
  );

  const onDeleteCallback = React.useCallback((messageId: ExtendedMessage | number) => 
    handleDeleteMessage(typeof messageId === 'number' ? messageId : messageId.id), 
    [handleDeleteMessage]
  );

  const onMouseEnterCallback = React.useCallback((e: React.MouseEvent<HTMLDivElement>, message?: ExtendedMessage) => {
    // Отменяем таймер скрытия если он есть
    if (hoverTimeoutRef?.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (setHoveredMessage && message) {
      setHoveredMessage({ element: e.currentTarget, message });
    }
  }, [hoverTimeoutRef, setHoveredMessage]);

  const onMouseLeaveCallback = React.useCallback(() => {
    // Добавляем задержку перед скрытием
    if (hoverTimeoutRef) {
      hoverTimeoutRef.current = setTimeout(() => {
        if (!isHoveringPortal?.current && setHoveredMessage) {
          setHoveredMessage(null);
        }
      }, 100);
    }
  }, [hoverTimeoutRef, isHoveringPortal, setHoveredMessage]);

  // Render empty state (no messages or loading)
  const renderEmptyState = () => (
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
          {[...Array(messagesPerPage)].map((_, index) => (
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
      ) : searchMode && searchQuery && searchQuery.trim() ? (
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
  );

  // Pagination trigger refs
  const topTriggerRef = React.useRef<HTMLDivElement>(null);
  const bottomTriggerRef = React.useRef<HTMLDivElement>(null);

  // Intersection Observer for pagination
  React.useEffect(() => {
    const topTrigger = topTriggerRef.current;
    const bottomTrigger = bottomTriggerRef.current;
    
    if (!topTrigger || !bottomTrigger) return;

    const handleTopIntersection = (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && 
          paginationState.hasMoreMessages && 
          !paginationState.isJumpingToMessage &&
          paginationState.loadingMode !== 'pagination' &&
          paginationState.loadingMode !== 'around') {
        
        const oldestMessage = sortedMessages[0];
        if (oldestMessage) {
          paginationActions.setBeforeId(oldestMessage.id);
          paginationActions.setLoadingMode('pagination');
        }
      }
    };

    const handleBottomIntersection = (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && 
          paginationState.enableAfterPagination &&
          paginationState.hasMoreMessagesAfter && 
          !paginationState.isJumpingToMessage &&
          paginationState.loadingMode !== 'pagination' &&
          paginationState.loadingMode !== 'around') {
        
        const newestMessage = sortedMessages[sortedMessages.length - 1];
        if (newestMessage) {
          paginationActions.setAfterId(newestMessage.id);
          paginationActions.setLoadingMode('pagination');
        }
      }
    };

    // Create observers with different thresholds
    const topObserver = new IntersectionObserver(handleTopIntersection, {
      root: messagesContainerRef.current,
      threshold: 0.1
    });

    const bottomObserver = new IntersectionObserver(handleBottomIntersection, {
      root: messagesContainerRef.current,
      threshold: 0.8
    });

    topObserver.observe(topTrigger);
    bottomObserver.observe(bottomTrigger);

    return () => {
      topObserver.disconnect();
      bottomObserver.disconnect();
    };
  }, [sortedMessages, paginationState, paginationActions, messagesContainerRef]);
  
  // Эффект для прокрутки к сообщению по scrollToMessageIdRef или forceScrollToMessageId
  React.useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // Проверяем, есть ли ID сообщения для прокрутки
    const messageIdToScroll = 
      (forceScrollToMessageId !== null && forceScrollToMessageId !== undefined) ? 
        forceScrollToMessageId : 
        (scrollToMessageIdRef?.current || null);
        
    if (messageIdToScroll === null) return;
    
    // Не прокручиваем автоматически если включена пагинация after (пользователь скроллит вниз)
    if (paginationState.enableAfterPagination && paginationState.loadingMode === 'pagination' && paginationState.afterId) {
      // Сбрасываем значение в ref без прокрутки
      if (scrollToMessageIdRef) {
        scrollToMessageIdRef.current = null;
      }
      // Также сбрасываем forceScrollToMessageId если он есть
      if (forceScrollToMessageId !== null) {
        // Нужно сбросить через prop, но у нас нет setter. Просто возвращаемся без действий
      }
      return;
    }
    
    // Ищем элемент сообщения по ID
    const messageElement = container.querySelector(`[data-msg-id="${messageIdToScroll}"]`);
    
    if (messageElement) {
      // Прокручиваем к сообщению с небольшим отступом
      messageElement.scrollIntoView({ 
        behavior: scrollCorrectionRef?.current?.setDisableSmoothScroll ? 'auto' : 'smooth',
        block: 'center'
      });
      
      // Сбрасываем значение в ref после прокрутки
      if (scrollToMessageIdRef) {
        scrollToMessageIdRef.current = null;
      }
      
      // Добавляем подсветку сообщения, если оно еще не подсвечено
      if (focusedMessageId !== messageIdToScroll) {
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          newSet.add(messageIdToScroll);
          return newSet;
        });
        
        if (setFocusedMessageId) {
          setFocusedMessageId(messageIdToScroll);
        }
        
        // Убираем подсветку через некоторое время
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedMessages(prev => {
            const newSet = new Set(prev);
            newSet.delete(messageIdToScroll);
            return newSet;
          });
          
          if (setFocusedMessageId) {
            setFocusedMessageId(null);
          }
        }, 1500);
      }
    }
  }, [forceScrollToMessageId, scrollToMessageIdRef?.current, focusedMessageId, highlightTimeoutRef, setHighlightedMessages, setFocusedMessageId, scrollCorrectionRef, paginationState.enableAfterPagination, paginationState.loadingMode, paginationState.afterId]);

  // Эффект для очистки подсветки при пагинации
  React.useEffect(() => {
    // Очищаем подсветку при запуске пагинации after (пользователь скроллит вниз)
    if (paginationState.enableAfterPagination && paginationState.loadingMode === 'pagination' && paginationState.afterId) {
      // Очищаем таймер подсветки
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      
      // Убираем подсветку
      setHighlightedMessages(new Set());
      setFocusedMessageId(null);
      
      // Очищаем scroll refs чтобы предотвратить возврат к сообщению
      if (scrollToMessageIdRef) {
        scrollToMessageIdRef.current = null;
      }
    }
  }, [paginationState.enableAfterPagination, paginationState.loadingMode, paginationState.afterId, highlightTimeoutRef, setHighlightedMessages, setFocusedMessageId, scrollToMessageIdRef]);

  return (
    <Box 
      ref={messagesContainerRef}
      className="messages-container"
      sx={{ 
        flex: 1, 
        px: 3,
        pt: 3,
        pb: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        position: 'relative',
        willChange: 'scroll-position',
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
        renderEmptyState()
      ) : (
        <>
          {/* Show empty state message when appropriate */}
          {emptyStateMessage}

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



          {/* Pagination triggers */}
          <div ref={topTriggerRef} style={{ height: '1px', margin: '20px 0' }} />

          {/* Messages */}
          {(() => {
            let result: React.ReactElement[] = [];
            let prevAuthorId: number | null = null;
            let prevMessageTimestamp: string | null = null;
            let currentGroup: React.ReactElement[] = [];
            let currentDateString: string | null = null;
            let processedDates = new Set<string>();

            // Use pre-computed combined messages

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
                      my: 3,
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: '50%',
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.2) 80%, transparent 100%)',
                        zIndex: 0
                      }
                    }}
                  >
                    <Box
                      sx={{
                        backgroundColor: 'rgba(30,30,47,0.95)',
                        backdropFilter: 'blur(8px)',
                        px: 3,
                        py: 1,
                        borderRadius: '16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        zIndex: 1
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'rgba(255,255,255,0.85)',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {formatDateForGroup(msg.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                );

                currentDateString = messageDateString;
                processedDates.add(messageDateString);
              }

              const isTempMessage = '__isTemp' in msg && (msg as any).__isTemp;
              
              // Check if this message should start a new group
              const isFirstOfGroup = 
                msg.author?.id !== prevAuthorId || // Different author
                !prevMessageTimestamp || // No previous message
                !isWithinTimeThreshold(msg.created_at, prevMessageTimestamp, 30) || // More than 30 minutes apart
                !isSameDay(msg.created_at, prevMessageTimestamp); // Different day
              
              const messageElement = editingMessageId === msg.id ? (
                <Box
                  key={isTempMessage ? `temp-${(msg as any).__tempId}` : msg.id}
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
                  key={isTempMessage ? `temp-${(msg as any).__tempId}` : msg.id}
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
                  loadingMode={paginationState.loadingMode}
                  onReply={onReplyCallback}
                  onEdit={onEditCallback}
                  onDelete={onDeleteCallback}
                  onReplyClick={handleReplyClick}
                  onMouseEnter={onMouseEnterCallback}
                  onMouseLeave={onMouseLeaveCallback}
                />
              );

              currentGroup.push(messageElement);
              prevAuthorId = msg.author.id;
              prevMessageTimestamp = msg.created_at;
            });

            if (currentGroup.length > 0) {
              result.push(...currentGroup);
            }


            return result;
          })()}

          {/* Bottom pagination trigger */}
          <div ref={bottomTriggerRef} style={{ height: '1px', margin: '2px 0' }} />

          {/* For properly tracking the end of messages for scrolling */}
          <div ref={messagesEndRef} />
        </>
      )}
    </Box>
  );
  };

  export default MessageList;