import React, { useCallback, useRef, useEffect, forwardRef, memo, useMemo, useState } from 'react';
import { VariableSizeList as List, ListChildComponentProps, ListOnScrollProps } from 'react-window';
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
  hubId: number;
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
  hoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  isHoveringPortal: React.MutableRefObject<boolean>;

  // Actions
  setHighlightedMessages: React.Dispatch<React.SetStateAction<Set<number>>>;
  setFocusedMessageId: ((id: number | null) => void) | React.Dispatch<React.SetStateAction<number | null>>;
  setEditingMessageId: React.Dispatch<React.SetStateAction<number | null>>;
  setMessages: React.Dispatch<React.SetStateAction<ExtendedMessage[]>>;
  setTempMessages: React.Dispatch<React.SetStateAction<Map<string, ExtendedMessage>>>;
  setReplyingToMessage: React.Dispatch<React.SetStateAction<ExtendedMessage | null>>;
  setHoveredMessage: React.Dispatch<React.SetStateAction<{
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
    handleScrollPagination: (container: HTMLElement, messages: ExtendedMessage[], messagesPerPage: number) => void;
  };
  
  // Handler functions
  handleEditMessage: (values: { content: string }, { resetForm }: { resetForm: () => void }) => Promise<void>;
  handleDeleteMessage: (messageId: number) => void;
}

// Type for message list items (messages and date separators)
interface MessageListItem {
  type: 'message' | 'date-separator' | 'loading';
  data?: ExtendedMessage;
  date?: string;
  key: string;
}

const VirtualizedMessageList: React.FC<MessageListProps> = ({
  activeChannel: _activeChannel,
  messages,
  tempMessages,
  searchMode,
  searchQuery,
  highlightedMessages,
  focusedMessageId,
  unreadMessages,
  isLoadingMore: _isLoadingMore,
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
  hoverTimeoutRef,
  isHoveringPortal,
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
  const listRef = useRef<List>(null);
  const rowHeights = useRef<Record<number, number>>({});
  const prevItemCount = useRef(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const [previousScrollHeight, setPreviousScrollHeight] = useState(0);
  const isInitialRender = useRef(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollOffset = useRef(0);
  const isPaginatingRef = useRef(false);
  const scrollRestorationRef = useRef<{
    messageId: number | null;
    offset: number;
    totalHeightBefore: number;
  }>({ messageId: null, offset: 0, totalHeightBefore: 0 });

  // Sort messages by creation time
  const sortedMessages = useMemo(() => 
    [...messages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ), [messages]);

  // Build list items with date separators
  const listItems = useMemo((): MessageListItem[] => {
    const items: MessageListItem[] = [];
    let currentDateString: string | null = null;
    let processedDates = new Set<string>();

    // Add loading indicator at the top if loading older messages
    if (paginationState.loadingMode === 'pagination' && paginationState.beforeId) {
      items.push({
        type: 'loading',
        key: 'loading-before'
      });
    }

    // Combine real and temporary messages
    const allMessages = [...sortedMessages, ...Array.from(tempMessages.values())];
    
    allMessages.forEach((msg) => {
      const messageDate = new Date(msg.created_at);
      const messageDateString = messageDate.toDateString();
      
      // Check if this is a new date
      if (currentDateString !== messageDateString && !processedDates.has(messageDateString)) {
        items.push({
          type: 'date-separator',
          date: msg.created_at,
          key: `date-${messageDateString}`
        });
        currentDateString = messageDateString;
        processedDates.add(messageDateString);
      }
      
      items.push({
        type: 'message',
        data: msg,
        key: msg.id === -1 ? `temp-${msg.created_at}` : msg.id.toString()
      });
    });

    // Add loading indicator at the bottom if loading newer messages
    if (paginationState.loadingMode === 'pagination' && paginationState.afterId) {
      items.push({
        type: 'loading',
        key: 'loading-after'
      });
    }

    return items;
  }, [sortedMessages, tempMessages, paginationState.loadingMode, paginationState.beforeId, paginationState.afterId]);

  // Handle reply click
  const handleReplyClick = useCallback((replyId: number) => {
    const messageIndex = listItems.findIndex(
      item => item.type === 'message' && item.data?.id === replyId
    );
    
    if (messageIndex !== -1) {
      // Message is in current view, scroll to it
      listRef.current?.scrollToItem(messageIndex, 'center');
      
      // Clear any existing highlight timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      
      // Highlight the message
      setFocusedMessageId(replyId);
      setHighlightedMessages(new Set([replyId]));
      
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
      setTargetMessageId(replyId);
      paginationActions.setAroundMessageId(replyId);
      paginationActions.setLoadingMode('around');
    }
  }, [listItems, highlightTimeoutRef, setFocusedMessageId, setHighlightedMessages, 
      paginationActions, setMessages, setTempMessages, setTargetMessageId]);

  // Get item size
  const getItemSize = useCallback((index: number) => {
    return rowHeights.current[index] || 100; // Default height
  }, []);

  // Set item size after measurement
  const setItemSize = useCallback((index: number, size: number) => {
    rowHeights.current[index] = size;
    if (listRef.current) {
      listRef.current.resetAfterIndex(index);
    }
  }, []);

  // Render date separator
  const renderDateSeparator = (date: string) => (
    <Box
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
          {formatDateForGroup(date)}
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

  // Render loading indicator
  const renderLoadingIndicator = () => (
    <Box sx={{ 
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      py: 2,
      gap: 1
    }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#00CFFF',
            animation: 'pulse 1.4s infinite ease-in-out both',
            animationDelay: `${-0.32 + i * 0.16}s`,
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
      ))}
    </Box>
  );

  // Row component
  const Row = memo(({ index, style }: ListChildComponentProps) => {
    const item = listItems[index];
    const measuredRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (measuredRef.current) {
        const height = measuredRef.current.getBoundingClientRect().height;
        if (height !== rowHeights.current[index]) {
          setItemSize(index, height);
        }
      }
    }, [index, item]);

    if (!item) return null;

    return (
      <div ref={measuredRef} style={style}>
        {item.type === 'date-separator' && item.date && renderDateSeparator(item.date)}
        {item.type === 'loading' && renderLoadingIndicator()}
        {item.type === 'message' && item.data && (
          (() => {
            const msg = item.data;
            const prevItem = index > 0 ? listItems[index - 1] : null;
            const prevMessage = prevItem?.type === 'message' ? prevItem.data : null;
            
            const isFirstOfGroup = !prevMessage || 
              prevMessage.author.id !== msg.author.id ||
              !isWithinTimeThreshold(prevMessage.created_at, msg.created_at);
            
            const isTempMessage = msg.id === -1;

            if (editingMessageId === msg.id) {
              return (
                <Box
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
                    px: 2,
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'flex-start', 
                    width: 40,
                    ml: 1,
                    mt: 1,
                  }}>
                    {isFirstOfGroup && (
                      <UserAvatar 
                        src={msg.author.avatar || undefined} 
                        alt={msg.author.login} 
                        userId={msg.author.id}
                        hubId={hubId}
                      />
                    )}
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
                      </Box>
                    </Box>
                  </Box>
                </Box>
              );
            }

            return (
              <Box sx={{ px: 2 }}>
                <ChatMessageItem
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
                  onReply={(message) => setReplyingToMessage(message)}
                  onEdit={(messageId) => setEditingMessageId(messageId)}
                  onDelete={(messageId) => handleDeleteMessage(messageId)}
                  onReplyClick={handleReplyClick}
                  onMouseEnter={(e, message) => {
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                    setHoveredMessage({ element: e.currentTarget, message });
                  }}
                  onMouseLeave={() => {
                    hoverTimeoutRef.current = setTimeout(() => {
                      if (!isHoveringPortal.current) {
                        setHoveredMessage(null);
                      }
                    }, 100);
                  }}
                />
              </Box>
            );
          })()
        )}
      </div>
    );
  });

  Row.displayName = 'MessageRow';

  // Handle scroll with react-window specific logic
  const handleScroll = useCallback((props: ListOnScrollProps) => {
    // Skip scroll handling during initial render
    if (isInitialRender.current) {
      return;
    }

    // Clear previous timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scroll handling to avoid excessive calls
    scrollTimeoutRef.current = setTimeout(() => {
      const { scrollOffset, scrollDirection } = props;
      
      // Calculate total content height (approximate)
      const totalHeight = listItems.reduce((acc, _, index) => acc + (rowHeights.current[index] || 100), 0);
      
      // Dynamic threshold based on container height (20% of container height, min 200px, max 500px)
      const threshold = Math.min(Math.max(containerHeight * 0.2, 200), 500);
      
      // Check if we're near the top
      const nearTop = scrollOffset < threshold;
      
      // Check if we're near the bottom
      const nearBottom = scrollOffset + containerHeight > totalHeight - threshold;

      // Handle pagination for scrolling up
      if (nearTop && scrollDirection === 'backward' && paginationState.hasMoreMessages && messages.length > 0) {
        if (!paginationState.loadingMode && !isPaginatingRef.current && messages.length >= messagesPerPage) {
          // Get the oldest message
          const sortedMsgs = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const oldestMessage = sortedMsgs[0];
          
          if (oldestMessage && (!paginationState.beforeId || paginationState.beforeId !== oldestMessage.id)) {
            // FIXED LOGIC FOR SAVING SCROLL POSITION
            let accumulatedHeight = 0;
            let savedMessageId: number | null = null;
            let viewportOffset = 0;
            
            // Find the first fully visible message
            for (let i = 0; i < listItems.length; i++) {
              const itemHeight = rowHeights.current[i] || 100;
              const itemTop = accumulatedHeight;
              const itemBottom = itemTop + itemHeight;
              
              // If element intersects with viewport
              if (itemBottom > scrollOffset) {
                const item = listItems[i];
                // Save only messages (not date separators)
                if (item.type === 'message' && item.data) {
                  savedMessageId = item.data.id;
                  // Important: save the difference between element position and scroll
                  viewportOffset = itemTop - scrollOffset;
                  break;
                }
              }
              
              accumulatedHeight += itemHeight;
            }
            
            if (savedMessageId !== null) {
              scrollRestorationRef.current = {
                messageId: savedMessageId,
                offset: viewportOffset,
                totalHeightBefore: 0 // will be calculated after loading
              };
            }
            
            // Save current scroll height and scroll offset before pagination
            const scrollContainer = (listRef.current as any)?._outerRef;
            const currentScrollHeight = scrollContainer ? scrollContainer.scrollHeight : 0;
            setPreviousScrollHeight(currentScrollHeight);
            scrollRestorationRef.current.offset = scrollOffset;
            
            isPaginatingRef.current = true;
            paginationActions.setLoadingMode('pagination');
            paginationActions.setBeforeId(oldestMessage.id);
            paginationActions.setAfterId(null);
            paginationActions.setSkipMainQuery(false);
            
            // Reset pagination flag after a delay
            setTimeout(() => {
              isPaginatingRef.current = false;
            }, 1000);
          }
        }
      }

      // Handle pagination for scrolling down (if enabled)
      if (nearBottom && scrollDirection === 'forward' && paginationState.hasMoreMessagesAfter && 
          paginationState.enableAfterPagination && messages.length > 0) {
        if (!paginationState.loadingMode && !isPaginatingRef.current) {
          // Get the newest message
          const sortedMsgs = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const newestMessage = sortedMsgs[sortedMsgs.length - 1];
          
          if (newestMessage && (!paginationState.afterId || paginationState.afterId !== newestMessage.id)) {
            isPaginatingRef.current = true;
            paginationActions.setLoadingMode('pagination');
            paginationActions.setAfterId(newestMessage.id);
            paginationActions.setBeforeId(null);
            paginationActions.setSkipMainQuery(false);
            
            // Reset pagination flag after a delay
            setTimeout(() => {
              isPaginatingRef.current = false;
            }, 1000);
          }
        }
      }
      
      // Store last scroll offset
      lastScrollOffset.current = scrollOffset;
    }, 100);
  }, [listItems, rowHeights, containerHeight, paginationState, messages, messagesPerPage, paginationActions]);

  // Scroll to bottom on initial load and channel change
  useEffect(() => {
    if (messages.length > 0 && isInitialRender.current && paginationState.loadingMode !== 'around') {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        if (listRef.current && listItems.length > 0) {
          // Force scroll to the last message
          const lastIndex = listItems.length - 1;
          listRef.current.scrollToItem(lastIndex, 'end');
          
          // Mark initial render complete
          isInitialRender.current = false;
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, listItems.length, paginationState.loadingMode]);

  // Reset flags when channel changes
  useEffect(() => {
    isInitialRender.current = true;
    isPaginatingRef.current = false;
    lastScrollOffset.current = 0;
    scrollRestorationRef.current = { messageId: null, offset: 0, totalHeightBefore: 0 };
    
    // Reset row heights for new channel
    rowHeights.current = {};
  }, [_activeChannel?.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Additional optimization: pre-calculate heights
  const preCalculateHeights = useCallback(() => {
    // If there's a saved position, pre-calculate heights
    if (scrollRestorationRef.current.messageId && listRef.current) {
      const targetIndex = listItems.findIndex(
        item => item.type === 'message' && item.data?.id === scrollRestorationRef.current.messageId
      );
      
      if (targetIndex !== -1) {
        // Force height measurements for elements before target
        for (let i = 0; i <= targetIndex; i++) {
          if (!rowHeights.current[i]) {
            // Set estimated height
            rowHeights.current[i] = 100;
          }
        }
      }
    }
  }, [listItems]);

  // Call preCalculateHeights after getting new messages
  useEffect(() => {
    if (isPaginatingRef.current) {
      preCalculateHeights();
    }
  }, [messages, preCalculateHeights]);

  // Calculate container height
  useEffect(() => {
    const calculateHeight = () => {
      if (messagesContainerRef.current) {
        const rect = messagesContainerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height);
      }
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, [messagesContainerRef]);

  // Handle scroll restoration after pagination
  useEffect(() => {
    if (prevItemCount.current < listItems.length && listRef.current && isPaginatingRef.current && previousScrollHeight > 0) {
      // Get real scroll height from DOM
      const scrollContainer = (listRef.current as any)?._outerRef;
      const currentScrollHeight = scrollContainer ? scrollContainer.scrollHeight : 0;
      const heightDelta = currentScrollHeight - previousScrollHeight;
      console.log("h", heightDelta, "current:", currentScrollHeight, "previous:", previousScrollHeight)
      // Only process if there's a meaningful change (not just small fluctuations)
      if (Math.abs(heightDelta) > 50) {
        // Output height delta to chat (console.log for now)
        console.log(`Scroll height delta: ${heightDelta > 0 ? '+' : ''}${heightDelta}px (${previousScrollHeight}px → ${currentScrollHeight}px)`);
        
        // Update previous height to current
        setPreviousScrollHeight(currentScrollHeight);
        
        // Scroll to previous position + height delta + container height (only for positive deltas)
        if (heightDelta > 0) {
          requestAnimationFrame(() => {
            if (listRef.current) {
              const newScrollPosition = scrollRestorationRef.current.offset + heightDelta + containerHeight;
              listRef.current.scrollTo(newScrollPosition);
              
              // Clear restoration data and reset pagination flag
              scrollRestorationRef.current = { 
                messageId: null, 
                offset: 0, 
                totalHeightBefore: 0 
              };
              isPaginatingRef.current = false;
            }
          });
        }
      }
      
      return;
    }
    
    // Normal logic for new messages at bottom
    if (!isPaginatingRef.current && !scrollRestorationRef.current.messageId) {
      const totalHeight = listItems.reduce((acc, _, idx) => acc + (rowHeights.current[idx] || 100), 0);
      const wasNearBottom = lastScrollOffset.current + containerHeight >= totalHeight - 200;
      
      if (wasNearBottom && !paginationState.loadingMode && !isInitialRender.current) {
        setTimeout(() => {
          if (listRef.current && listItems.length > 0) {
            listRef.current.scrollToItem(listItems.length - 1, 'end');
          }
        }, 50);
      }
    }
    
    prevItemCount.current = listItems.length;
  }, [listItems, containerHeight, paginationState.loadingMode]);

  // Empty state
  if (messages.length === 0 && tempMessages.size === 0) {
    return (
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
            <Typography variant="h6">Нет результатов поиска</Typography>
            <Typography variant="body2">Попробуйте изменить поисковый запрос</Typography>
          </>
        ) : (
          <>
            <Typography variant="h6">Нет сообщений</Typography>
            <Typography variant="body2">Начните общение, отправив первое сообщение</Typography>
          </>
        )}
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
        height: '100%',
        width: '100%',
      }}
    >
      {/* Floating date label */}
      <Fade in={showDateLabel} timeout={{ enter: 300, exit: 500 }}>
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            backgroundColor: 'rgba(30,30,47,0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: '16px',
            px: 2,
            py: 0.75,
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

      <List
        ref={listRef}
        height={containerHeight}
        itemCount={listItems.length}
        itemSize={getItemSize}
        width="100%"
        onScroll={handleScroll}
        initialScrollOffset={isInitialRender.current && listItems.length > 0 ? 999999 : undefined}
        style={{
          overflowX: 'hidden',
        }}
        outerElementType={forwardRef(({ onScroll, children, ...rest }: any, ref) => (
          <Box
            ref={ref}
            onScroll={onScroll}
            {...rest}
            sx={{
              ...rest.style,
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.1) transparent',
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
            {children}
            <div ref={messagesEndRef} />
          </Box>
        ))}
      >
        {Row}
      </List>
    </Box>
  );
};

export default memo(VirtualizedMessageList);