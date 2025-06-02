import React from 'react';
import { Box, Typography, Fade, Skeleton, IconButton } from '@mui/material';
import UserAvatar from '../../../UserAvatar';
import ChatMessageItem from './ChatMessageItem';
import { Channel } from '../../../../api/channels';
import Input from '../../../common/Input';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { ExtendedMessage } from '../types/message';
import { LoadingMode } from '../hooks/useMessagePagination';
import { useSignedUrls } from '../../../../context/SignedUrlContext';

// Validation schema for editing messages
const messageSchema = Yup.object().shape({
  content: Yup.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message is too long')
});

// Helper functions
const formatDateForGroup = (timestamp: string) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Сегодня';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  }
  
  const isCurrentYear = date.getFullYear() === today.getFullYear();
  const formattedDate = date.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(isCurrentYear ? {} : { year: 'numeric' })
  });
  return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
};

const isWithinTimeThreshold = (timestamp1: string, timestamp2: string, thresholdMinutes: number = 30) => {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  const diffInMinutes = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
  return diffInMinutes <= thresholdMinutes;
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
  const { signedUrls, fetchSignedUrls } = useSignedUrls();
  const pendingRequestRef = React.useRef<Promise<void> | null>(null);

  // Process attachments and fetch signed URLs
  const processMessageAttachments = React.useCallback(async (newMessages: ExtendedMessage[]) => {
    console.log('🔍 processMessageAttachments called with', newMessages.length, 'messages');
    if (!newMessages.length) return;

    const allAttachmentKeys: string[] = [];
    
    // Collect all attachment keys from messages
    newMessages.forEach(message => {
      if (message.attachments && message.attachments.length > 0) {
        console.log(`📎 Message ${message.id} has ${message.attachments.length} attachments:`, message.attachments);
        allAttachmentKeys.push(...message.attachments);
      }
    });

    console.log('📋 Total attachment keys collected:', allAttachmentKeys.length, allAttachmentKeys);
    if (allAttachmentKeys.length === 0) {
      console.log('❌ No attachments found in messages');
      return;
    }

    // Filter out URLs that already exist in memory
    const missingKeys = allAttachmentKeys.filter(key => !signedUrls.has(key));
    console.log('🔍 Missing keys that need to be fetched:', missingKeys.length, missingKeys);
    console.log('📦 Current signedUrls size:', signedUrls.size);

    if (missingKeys.length > 0) {
      // Prevent duplicate requests
      if (pendingRequestRef.current) {
        console.log('⏳ Request already pending, waiting...');
        await pendingRequestRef.current;
        return;
      }

      // Create and store the request promise
      const requestPromise = (async () => {
        try {
          console.log('🚀 Calling fetchSignedUrls with keys:', missingKeys);
          await fetchSignedUrls(missingKeys);
          console.log('✅ fetchSignedUrls completed successfully');
        } catch (error) {
          console.error('❌ Failed to fetch signed URLs:', error);
        } finally {
          pendingRequestRef.current = null;
        }
      })();

      pendingRequestRef.current = requestPromise;
      await requestPromise;
    } else {
      console.log('✅ All attachment URLs already in cache');
    }
  }, [fetchSignedUrls, signedUrls]);

  // Process attachments when messages change
  React.useEffect(() => {
    console.log('📬 MessageList effect: messages changed, count:', messages.length);
    if (messages.length > 0) {
      console.log('📬 Sample message structure:', messages[0]);
      processMessageAttachments(messages);
    }
  }, [messages, processMessageAttachments]);

  // Sort messages by creation time
  const sortedMessages = [...messages].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Used in JSX conditional rendering below
  const emptyMessages = messages.length === 0 && tempMessages.size === 0;

  // This is used in the actual JSX returned below to determine
  // whether to show an empty state message or loading indicators
  const shouldShowEmptyState = emptyMessages && !isLoadingMore && !!activeChannel;

  // Add empty state JSX - will be rendered when shouldShowEmptyState is true
  const emptyStateMessage = shouldShowEmptyState && (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Typography variant="body1" color="text.secondary">
        {searchMode ? 'No messages found matching your search.' : 'No messages yet. Start a conversation!'}
      </Typography>
    </Box>
  );

  // Handle reply click function
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
  };

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

  // Add scroll pagination effect
  React.useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    let scrollThrottle = false;

    const handleScroll = () => {
      // Throttle scroll updates
      if (scrollThrottle) return;
      scrollThrottle = true;

      requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;

        // Check if scrolled to 20% from top for pagination
        const scrollPercentageFromTop = scrollTop / container.scrollHeight;
        if (scrollPercentageFromTop < 0.2 && 
            paginationState.hasMoreMessages && 
            !paginationState.isJumpingToMessage &&
            paginationState.loadingMode !== 'pagination' &&
            paginationState.loadingMode !== 'around') {
          
          // Trigger pagination
          const oldestMessage = sortedMessages[0];
          if (oldestMessage) {
            paginationActions.setBeforeId(oldestMessage.id);
            paginationActions.setLoadingMode('pagination');
          }
        }

        scrollThrottle = false;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [sortedMessages, paginationState, paginationActions]);
  
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
  }, [messages, forceScrollToMessageId, scrollToMessageIdRef?.current, focusedMessageId, highlightTimeoutRef, setHighlightedMessages, setFocusedMessageId, scrollCorrectionRef]);

  return (
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
                        px: 2,
                        py: 0.75,
                        borderRadius: '12px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                        zIndex: 1
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 500,
                          fontSize: '0.85rem'
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

              const isTempMessage = 'temp_id' in msg;
              const isFirstOfGroup = msg.author?.id !== prevAuthorId;
              
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
                  signedUrls={signedUrls}
                  loadingMode={paginationState.loadingMode}
                  onReply={(message) => {
                    setReplyingToMessage(message);
                  }}
                  onEdit={(messageId) => setEditingMessageId(typeof messageId === 'number' ? messageId : messageId.id)}
                  onDelete={(messageId) => handleDeleteMessage(typeof messageId === 'number' ? messageId : messageId.id)}
                  onReplyClick={handleReplyClick}
                  onMouseEnter={(e, message) => {
                    // Отменяем таймер скрытия если он есть
                    if (hoverTimeoutRef?.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                    if (setHoveredMessage && message) {
                      setHoveredMessage({ element: e.currentTarget, message });
                    }
                  }}
                  onMouseLeave={() => {
                    // Добавляем задержку перед скрытием
                    if (hoverTimeoutRef) {
                      hoverTimeoutRef.current = setTimeout(() => {
                        if (!isHoveringPortal?.current && setHoveredMessage) {
                          setHoveredMessage(null);
                        }
                      }, 100);
                    }
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


            return result;
          })()}

          {/* For properly tracking the end of messages for scrolling */}
          <div ref={messagesEndRef} />
        </>
      )}
    </Box>
  );
};

export default MessageList;