import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { Box, Typography, IconButton, Fade } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { debounce } from 'lodash';

interface Message {
  id: number;
  content: string;
  author: {
    id: number;
    login: string;
    avatar: string | null;
  };
  created_at: string;
  last_modified_at?: string;
  read_by_count?: number;
  channel_id?: number;
  reply_to?: any;
  status: number;
}

interface VirtualizedChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  currentUserId: number;
  hubId: number;
  renderMessage: (message: Message, index: number, style: React.CSSProperties) => React.ReactNode;
  onScrollStateChange?: (isScrolledToBottom: boolean) => void;
}

const ITEM_SIZE_CACHE = new Map<number, number>();
const DEFAULT_MESSAGE_HEIGHT = 80;
const OVERSCAN_COUNT = 5;
const SCROLL_DEBOUNCE_DELAY = 150;

const VirtualizedChatArea = forwardRef<List, VirtualizedChatAreaProps>(({
  messages,
  isLoading,
  hasMore,
  onLoadMore,
  currentUserId,
  hubId,
  renderMessage,
  onScrollStateChange
}, ref) => {
  const listRef = useRef<List>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const isUserScrollingRef = useRef(false);

  // Store ref in parent if provided
  useEffect(() => {
    if (ref && listRef.current) {
      if (typeof ref === 'function') {
        ref(listRef.current);
      } else {
        ref.current = listRef.current;
      }
    }
  }, [ref]);

  // Message height calculation
  const getItemSize = useCallback((index: number) => {
    const cachedHeight = ITEM_SIZE_CACHE.get(messages[index]?.id);
    if (cachedHeight) return cachedHeight;

    // Estimate height based on message content
    const message = messages[index];
    if (!message) return DEFAULT_MESSAGE_HEIGHT;

    const lines = Math.ceil(message.content.length / 50);
    const estimatedHeight = 60 + (lines * 20);
    
    return Math.min(estimatedHeight, 300);
  }, [messages]);

  // Store actual rendered heights
  const setItemSize = useCallback((index: number, size: number) => {
    const message = messages[index];
    if (message) {
      ITEM_SIZE_CACHE.set(message.id, size);
    }
  }, [messages]);

  // Check if user is at bottom of scroll
  const checkScrollPosition = useCallback(() => {
    if (!listRef.current) return;
    
    const list = listRef.current;
    const scrollContainer = list._outerRef as HTMLDivElement;
    
    if (!scrollContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setIsScrolledToBottom(isAtBottom);
    setShowScrollButton(!isAtBottom);
    onScrollStateChange?.(isAtBottom);
  }, [onScrollStateChange]);

  // Debounced scroll handler
  const handleScroll = useCallback(
    debounce(() => {
      checkScrollPosition();
      
      // Check if we need to load more messages
      if (!listRef.current || isLoading || !hasMore) return;
      
      const list = listRef.current;
      const scrollContainer = list._outerRef as HTMLDivElement;
      
      if (scrollContainer.scrollTop < 500) {
        onLoadMore();
      }
    }, SCROLL_DEBOUNCE_DELAY),
    [checkScrollPosition, isLoading, hasMore, onLoadMore]
  );

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (!listRef.current || messages.length === 0) return;
    
    listRef.current.scrollToItem(messages.length - 1, 'end');
    setShowScrollButton(false);
  }, [messages.length]);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (!isUserScrollingRef.current && isScrolledToBottom && messages.length > 0) {
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [messages.length, isScrolledToBottom, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, []);

  // Track user scrolling
  useEffect(() => {
    const scrollContainer = listRef.current?._outerRef as HTMLDivElement;
    if (!scrollContainer) return;

    const handleScrollStart = () => {
      isUserScrollingRef.current = true;
      clearTimeout(scrollTimeoutRef.current);
      
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 500);
    };

    scrollContainer.addEventListener('scroll', handleScrollStart);
    scrollContainer.addEventListener('scroll', handleScroll);
    
    return () => {
      scrollContainer.removeEventListener('scroll', handleScrollStart);
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Render row with message
  const Row = ({ index, style }) => {
    const message = messages[index];
    if (!message) return null;

    // Create a wrapper div that measures actual height
    return (
      <div
        style={style}
        onLoad={() => {
          // Measure actual height after render
          const element = document.querySelector(`[data-message-id="${message.id}"]`) as HTMLElement;
          if (element) {
            const height = element.offsetHeight;
            if (height !== getItemSize(index)) {
              setItemSize(index, height);
              listRef.current?.resetAfterIndex(index);
            }
          }
        }}
      >
        <div data-message-id={message.id}>
          {renderMessage(message, index, style)}
        </div>
      </div>
    );
  };

  // Check if more items need to be loaded
  const isItemLoaded = (index: number) => !hasMore || index < messages.length;

  // Callback to load more items
  const loadMoreItems = () => {
    if (!isLoading && hasMore) {
      return onLoadMore();
    }
    return Promise.resolve();
  };

  return (
    <Box sx={{ 
      flex: 1, 
      position: 'relative',
      height: '100%',
      minHeight: 0,
    }}>
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={hasMore ? messages.length + 1 : messages.length}
        loadMoreItems={loadMoreItems}
      >
        {({ onItemsRendered, ref: loaderRef }) => (
          <List
            ref={(list) => {
              listRef.current = list;
              loaderRef(list);
            }}
            height={window.innerHeight - 200} // Adjust based on your layout
            itemCount={messages.length}
            itemSize={getItemSize}
            onItemsRendered={onItemsRendered}
            overscanCount={OVERSCAN_COUNT}
            width="100%"
            style={{
              overflowX: 'hidden',
            }}
            className="virtualized-message-list"
          >
            {Row}
          </List>
        )}
      </InfiniteLoader>

      {/* Scroll to bottom button */}
      <Fade in={showScrollButton}>
        <IconButton
          onClick={() => scrollToBottom()}
          sx={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            backgroundColor: 'rgba(30,30,47,0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            '&:hover': {
              backgroundColor: 'rgba(40,40,57,0.95)',
            },
            zIndex: 1000,
          }}
        >
          <KeyboardArrowDownIcon sx={{ color: '#fff' }} />
        </IconButton>
      </Fade>
    </Box>
  );
});

VirtualizedChatArea.displayName = 'VirtualizedChatArea';

export default VirtualizedChatArea;