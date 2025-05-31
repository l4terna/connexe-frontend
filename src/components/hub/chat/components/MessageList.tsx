import React, { useEffect, useCallback, useMemo, useImperativeHandle } from 'react';
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
import { useMessageVirtualization } from '../hooks/useVirtualScroll';

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
  searchMode: boolean;
  searchQuery: string;
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
  scrollToMessageIdRef: React.MutableRefObject<number | null>;
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

const MessageList: React.FC<MessageListProps> = (props) => {
  const {
    activeChannel: _activeChannel,
    messages,
    tempMessages,
    searchMode,
    searchQuery,
    highlightedMessages,
    focusedMessageId,
    unreadMessages,
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
    setHighlightedMessages,
    setFocusedMessageId,
    setEditingMessageId,
    setMessages,
    setTempMessages,
    setReplyingToMessage,
    setTargetMessageId,
    paginationActions,
    handleEditMessage,
    handleDeleteMessage,
    forceScrollToMessageId
  } = props;

  // State for controlling smooth scroll behavior
  const [disableSmoothScroll, setDisableSmoothScroll] = React.useState(false);

  // Use virtualization hook
  const {
    virtualItems,
    totalSize,
    scrollToMessage,
    measureElement,
    processedItems,
    prepareScrollCorrection
  } = useMessageVirtualization(messages, tempMessages, messagesContainerRef, {
    estimatedItemSize: 40, // Увеличиваем начальную оценку для более точного расчета
    overscan: 5,
    onScroll: useCallback((container: HTMLElement) => {
      // Handle pagination using the provided function
      if ('handleScrollPagination' in paginationActions) {
        (paginationActions as any).handleScrollPagination(container, messages, messagesPerPage);
      }
    }, [paginationActions, messages, messagesPerPage]),
    // Prevent scroll adjustment when loading messages with after parameter
    preventScrollAdjustment: paginationState.afterId !== null
  });
  
  // Expose prepareScrollCorrection to parent component
  useImperativeHandle(props.scrollCorrectionRef, () => ({
    prepareScrollCorrection,
    setDisableSmoothScroll
  }), [prepareScrollCorrection]);

  // Store previous message for grouping logic
  const getPreviousMessage = useCallback((currentIndex: number): ExtendedMessage | null => {
    for (let i = currentIndex - 1; i >= 0; i--) {
      const item = processedItems[i];
      if (item.type === 'message' && typeof item.data === 'object' && 'id' in item.data) {
        return item.data as ExtendedMessage;
      }
    }
    return null;
  }, [processedItems]);

  // Handle reply click function
  const handleReplyClick = useCallback((replyId: number) => {
    const messageExists = messages.some(msg => msg.id === replyId);
    
    if (messageExists) {
      // Используем scrollToMessage из виртуализации напрямую
      requestAnimationFrame(() => {
        scrollToMessage(replyId);
        
        // Подсветка сообщения
        setTimeout(() => {
          if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = null;
          }
          
          setFocusedMessageId(null);
          setHighlightedMessages(new Set());
          
          setFocusedMessageId(replyId);
          setHighlightedMessages(() => {
            const newSet = new Set<number>();
            newSet.add(replyId);
            return newSet;
          });
          
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedMessages(prev => {
              const newSet = new Set(prev);
              newSet.delete(replyId);
              return newSet;
            });
            setFocusedMessageId(null);
            highlightTimeoutRef.current = null;
          }, 1500);
        }, 100); // Небольшая задержка после прокрутки
      });
    } else {
      // Загрузка around - остается без изменений
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
      setTargetMessageId(replyId);
      paginationActions.setAroundMessageId(replyId);
      paginationActions.setLoadingMode('around');
    }
  }, [messages, scrollToMessage, highlightTimeoutRef, setFocusedMessageId, setHighlightedMessages, setMessages, setTempMessages, setTargetMessageId, paginationActions]);

  // Render empty state
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
  );

  // Cleanup function for measurement refs
  useEffect(() => {
    return () => {
      // Cleanup all measurements when component unmounts
      virtualItems.forEach(item => {
        measureElement(item.index, null);
      });
    };
  }, []); // Empty dependencies to only run on unmount

  // Render a single virtual item
  const renderVirtualItem = useCallback((virtualItem: any) => {
    const { index, start, size } = virtualItem;
    const item = processedItems[index];
    
    if (!item) return null;

    // Set ref for measuring - простая функция без хуков
    const setMeasureRef = (element: HTMLDivElement | null) => {
      if (element) {
        // Форсируем layout перед измерением
        element.style.contain = 'layout style';
        
        // Измеряем элемент без форсированного обновления
        measureElement(index, element);
      } else {
        measureElement(index, null);
      }
    };

    if (item.type === 'date') {
      return (
        <Box
          key={`date-${index}`}
          ref={setMeasureRef}
          className="date-separator"
          data-date={item.data}
          sx={{
            position: 'absolute',
            top: start,
            left: 0,
            right: 0,
            height: size,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            my: 2,
            zIndex: 0,
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
                fontSize: '0.9rem'
              }}
            >
              {formatDateForGroup(item.data as string)}
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
    }

    // Render message
    const message = item.data as ExtendedMessage;
    const prevMessage = getPreviousMessage(index);
    
    const isFirstOfGroup = !prevMessage || 
      prevMessage.author.id !== message.author.id || 
      !isWithinTimeThreshold(prevMessage.created_at, message.created_at);

    const isTempMessage = message.id === -1;

    if (editingMessageId === message.id) {
      return (
        <Box
          key={`message-${index}`}
          ref={setMeasureRef}
          id={`message-${message.id}`}
          className="message-item"
          data-date={message.created_at}
          data-msg-id={message.id.toString()}
          sx={{
            position: 'absolute',
            top: start,
            left: 0,
            right: 0,
            minHeight: size,
            display: 'flex',
            gap: 2,
            alignItems: 'flex-start',
            borderRadius: '10px',
            transition: 'background-color 0.3s ease',
            opacity: isTempMessage ? 0.6 : 1,
            px: 3,
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
              <div style={{ cursor: 'pointer' }}>
                <UserAvatar 
                  src={message.author.avatar || undefined} 
                  alt={message.author.login} 
                  userId={message.author.id}
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
                    {message.author.login}
                  </Typography>
                )}
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
      );
    }

    return (
      <Box
        key={`message-${index}`}
        ref={setMeasureRef}
        sx={{
          position: 'absolute',
          top: start,
          left: 0,
          right: 0,
          minHeight: size,
          px: 3,
          overflow: 'visible',
        }}
      >
        <ChatMessageItem
          message={message}
          isFirstOfGroup={isFirstOfGroup}
          isTempMessage={isTempMessage}
          isHighlighted={highlightedMessages.has(message.id)}
          isUnread={unreadMessages.has(message.id)}
          isFocused={focusedMessageId === message.id}
          isSearchMode={searchMode}
          searchQuery={searchQuery}
          currentUserId={user.id}
          hubId={hubId}
          loadingMode={paginationState.loadingMode}
          onReply={(message) => {
            setReplyingToMessage(message);
          }}
          onEdit={(messageId) => setEditingMessageId(typeof messageId === 'number' ? messageId : messageId.id)}
          onDelete={(messageId) => handleDeleteMessage(typeof messageId === 'number' ? messageId : messageId.id)}
          onReplyClick={handleReplyClick}
          onMouseEnter={() => {
            // Можно добавить дополнительную логику при наведении
          }}
          onMouseLeave={() => {
            // Можно добавить дополнительную логику при уходе мыши
          }}
        />
      </Box>
    );
  }, [processedItems, getPreviousMessage, editingMessageId, highlightedMessages, unreadMessages, focusedMessageId, searchMode, searchQuery, user.id, hubId, paginationState.loadingMode, setReplyingToMessage, setEditingMessageId, handleDeleteMessage, handleReplyClick, handleEditMessage, measureElement]);

  // Effect to handle scroll to message when ref changes
  useEffect(() => {
    if (scrollToMessageIdRef.current && messages.length > 0 && messagesContainerRef.current) {
      const targetId = scrollToMessageIdRef.current;
      const messageExists = messages.some(msg => msg.id === targetId);
      
      if (messageExists) {
        // с задержкой для гарантии обновления DOM
        const timeoutId = setTimeout(() => {
          scrollToMessage(targetId);
          
          // Очищаем ref после успешной прокрутки
          setTimeout(() => {
            scrollToMessageIdRef.current = null;
          }, 100);
        }, 200); // Увеличенная задержка для виртуализации
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [messages, scrollToMessage, virtualItems.length, forceScrollToMessageId]); // Added forceScrollToMessageId to dependencies

  // Memoize virtual items rendering
  const virtualItemsRendered = useMemo(() => virtualItems.map(renderVirtualItem), [virtualItems, renderVirtualItem]);

  // Check if we have messages to display
  const emptyMessages = messages.length === 0 && tempMessages.size === 0;

  if (emptyMessages) {
    return (
      <Box 
        ref={messagesContainerRef}
        className="messages-container"
        sx={{ 
          flex: 1, 
          position: 'relative',
          overflowY: 'auto',
          scrollBehavior: disableSmoothScroll ? 'auto' : 'smooth',
          // Скрываем контент пока идет initial загрузка чтобы избежать мерцания
          opacity: paginationState.loadingMode === 'initial' ? 0 : 1,
          transition: 'opacity 0.2s ease-in-out',
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
        {renderEmptyState()}
        <div ref={messagesEndRef} />
      </Box>
    );
  }

  return (
    <Box 
      ref={messagesContainerRef}
      className="messages-container"
      sx={{ 
        flex: 1, 
        position: 'relative',
        overflowY: 'auto',
        scrollBehavior: disableSmoothScroll ? 'auto' : 'smooth',
        // Скрываем контент пока идет initial загрузка чтобы избежать мерцания
        opacity: paginationState.loadingMode === 'initial' && messages.length === 0 ? 0 : 1,
        transition: 'opacity 0.2s ease-in-out',
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
      {/* Floating date label */}
      <Fade in={showDateLabel} timeout={{ enter: 300, exit: 500 }}>
        <Box
          sx={{
            position: 'sticky',
            top: 35,
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
            mx: 'auto',
            width: 'fit-content',
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


      {/* Virtual scroller container */}
      <Box
        sx={{
          height: totalSize,
          position: 'relative',
        }}
      >
        {virtualItemsRendered}
      </Box>

      
      {/* For properly tracking the end of messages for scrolling */}
      <div ref={messagesEndRef} />
    </Box>
  );
};

export default MessageList;