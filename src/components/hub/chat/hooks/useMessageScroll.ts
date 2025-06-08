import { useState, useRef, useCallback, useEffect } from 'react';

interface UseMessageScrollProps {
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  messages: any[];
  activeChannel: { id: number } | null;
  user: { id: number } | null;
  onMarkAllAsRead?: () => void;
  bulkReadAllRef?: React.RefObject<number>;
  paginationActions?: {
    handleScrollPagination: (
      container: HTMLElement,
      messages: any[],
      messagesPerPage: number
    ) => void;
  };
  messagesPerPage?: number;
  isUpdatingFromRequest?: boolean;
}

interface UseMessageScrollReturn {
  isScrolledToBottom: boolean;
  setIsScrolledToBottom: (value: boolean) => void;
  showScrollButton: boolean;
  setShowScrollButton: (value: boolean) => void;
  showDateLabel: boolean;
  setShowDateLabel: (value: boolean) => void;
  currentDateLabel: string | null;
  setCurrentDateLabel: (value: string | null) => void;
  disableAutoScroll: boolean;
  setDisableAutoScroll: (value: boolean) => void;
  scrollToBottom: (instant?: boolean) => void;
  scrollToMessage: (messageId: number) => void;
  prepareScrollCorrection: () => void;
  setDisableSmoothScroll: (value: boolean) => void;
}

export const useMessageScroll = ({
  messagesContainerRef,
  messages,
  activeChannel,
  onMarkAllAsRead,
  bulkReadAllRef,
  paginationActions,
  messagesPerPage = 20,
  isUpdatingFromRequest = false
}: UseMessageScrollProps): UseMessageScrollReturn => {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showDateLabel, setShowDateLabel] = useState(false);
  const [currentDateLabel, setCurrentDateLabel] = useState<string | null>(null);
  const [disableAutoScroll, setDisableAutoScroll] = useState(false);
  const [disableSmoothScroll, setDisableSmoothScroll] = useState(false);
  
  const dateLabelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousScrollHeightRef = useRef<number>(0);
  const previousScrollTopRef = useRef<number>(0);
  const messagesCountRef = useRef<number>(0);
  const scrollThrottleRef = useRef<boolean>(false);

  // Function to prepare for scroll correction
  const prepareScrollCorrection = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      previousScrollHeightRef.current = container.scrollHeight;
      previousScrollTopRef.current = container.scrollTop;
    }
  }, [messagesContainerRef]);

  // Function to scroll to bottom
  const scrollToBottom = useCallback((instant: boolean = false) => {
    if (!messagesContainerRef.current) {
      return;
    }
    
    if (disableAutoScroll) {
      return;
    }
    
    const container = messagesContainerRef.current;
    
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      if (instant || disableSmoothScroll) {
        // Temporarily disable smooth scrolling for instant positioning
        const originalScrollBehavior = container.style.scrollBehavior;
        container.style.scrollBehavior = 'auto';
        container.scrollTop = container.scrollHeight;
        // Restore original scroll behavior
        container.style.scrollBehavior = originalScrollBehavior;
      } else {
        container.scrollTop = container.scrollHeight;
      }
      setShowScrollButton(false);
      
      // Don't send bulk-read-all here - it should only be sent when user clicks the button
      
      // Double-check scroll position after a short delay
      setTimeout(() => {
        if (container.scrollTop < container.scrollHeight - container.clientHeight - 100) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    });
  }, [disableAutoScroll, disableSmoothScroll, messagesContainerRef]);

  // Function to scroll to a specific message and highlight it
  const scrollToMessage = useCallback((messageId: number) => {
    if (!messagesContainerRef.current) return;
    
    const messageElement = document.getElementById(`message-${messageId}`);
    if (!messageElement) {
      return;
    }
    
    // Block auto-scroll when jumping to message
    setDisableAutoScroll(true);
    
    // Calculate position to center the message in the container
    const container = messagesContainerRef.current;
    const messageTop = messageElement.offsetTop;
    const messageHeight = messageElement.offsetHeight;
    const containerHeight = container.clientHeight;
    
    // Center the message in the visible area
    const scrollTop = messageTop - (containerHeight / 2) + (messageHeight / 2);
    
    // Scroll to the message
    container.scrollTop = Math.max(0, scrollTop);
    
    // Highlight the message
    messageElement.style.transition = 'background-color 0.3s ease-in-out';
    messageElement.style.backgroundColor = 'rgba(0, 207, 255, 0.1)';
    
    // Remove highlight after 2 seconds
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    highlightTimeoutRef.current = setTimeout(() => {
      if (messageElement) {
        messageElement.style.backgroundColor = '';
      }
      setDisableAutoScroll(false);
      
      // Re-check if we should scroll to bottom after highlighting
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 20) {
        scrollToBottom();
      }
    }, 2000);
  }, [messagesContainerRef, scrollToBottom]);

  // Helper function to format date for group
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

  // Effect to track scroll position and handle scroll events
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Track intentional scroll up
    let lastScrollTop = container.scrollTop;
    let intentionalScrollUp = false;
    let scrollTimeoutId: NodeJS.Timeout | null = null;
    let lastMarkAllAsReadTime = 0;

    const handleScroll = () => {
      // Throttle scroll updates
      if (scrollThrottleRef.current) return;
      scrollThrottleRef.current = true;

      requestAnimationFrame(() => {
        // Clear previous timeout if exists
        if (scrollTimeoutId) {
          clearTimeout(scrollTimeoutId);
        }

        const currentScrollTop = container.scrollTop;
        const scrollPosition = container.scrollHeight - currentScrollTop - container.clientHeight;
        const isAtBottom = scrollPosition < 100;
        
        // Determine scroll direction
        if (currentScrollTop < lastScrollTop) {
          // Scrolling up
          if (!intentionalScrollUp) {
            intentionalScrollUp = true;
          }
          
          // Check if we should trigger pagination
          if (paginationActions && messagesPerPage) {
            paginationActions.handleScrollPagination(container, messages, messagesPerPage);
          }
        } else if (currentScrollTop > lastScrollTop) {
          // Scrolling down
          if (isAtBottom) {
            // Reset intentional scroll up when reaching bottom
            intentionalScrollUp = false;
            
            // Mark messages as read when at bottom
            if (!isScrolledToBottom) {
              setIsScrolledToBottom(true);
              
              // Mark all messages as read with debouncing (only once per 1000ms)
              const now = Date.now();
              if (onMarkAllAsRead && bulkReadAllRef?.current && now - lastMarkAllAsReadTime > 1000 && now - bulkReadAllRef.current > 1000) {
                lastMarkAllAsReadTime = now;
                bulkReadAllRef.current = now;
                onMarkAllAsRead();
              }
            }
          }
        }
        
        // Update last scroll position
        lastScrollTop = currentScrollTop;
        
        // Update scrolled to bottom state
        setIsScrolledToBottom(isAtBottom);
        
        // Show/hide scroll button
        setShowScrollButton(container.scrollTop + container.clientHeight < container.scrollHeight - 400);
        
        // Handle date label visibility
        if (dateLabelTimeoutRef.current) {
          clearTimeout(dateLabelTimeoutRef.current);
        }
        
        // Check for visible date labels
        const visibleElements = container.querySelectorAll('.message-item');
        
        let visibleDate: string | null = null;
        
        if (visibleElements.length > 0) {
          // Process visible elements to find date - use for...of with break for better performance
          for (const element of visibleElements) {
            const rect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            // Check if element is at least partially visible
            const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom;
            
            if (isVisible) {
              const dateAttr = element.getAttribute('data-date');
              if (dateAttr) {
                visibleDate = formatDateForGroup(dateAttr);
                break; // Take the first visible element's date
              }
            }
          }
        }

        if (visibleDate) {
          setCurrentDateLabel(visibleDate);
          setShowDateLabel(true);
          
          // Hide the date label after 1 second
          dateLabelTimeoutRef.current = setTimeout(() => {
            setShowDateLabel(false);
          }, 1000);
        } else {
          // If no visible date found, hide the label immediately
          setShowDateLabel(false);
        }
        
        // Set a timeout to determine when scrolling has stopped
        scrollTimeoutId = setTimeout(() => {
          scrollTimeoutId = null;
        }, 150);

        // Reset throttle
        scrollThrottleRef.current = false;
      });
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (dateLabelTimeoutRef.current) {
        clearTimeout(dateLabelTimeoutRef.current);
      }
      if (scrollTimeoutId) {
        clearTimeout(scrollTimeoutId);
      }
    };
  }, [activeChannel, messages, messagesContainerRef, onMarkAllAsRead, bulkReadAllRef, paginationActions, messagesPerPage]);

  // Effect to handle scroll correction during pagination
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const currentMessageCount = messages.length;
    const previousMessageCount = messagesCountRef.current;

    // Only apply scroll correction if messages were updated from a request (pagination)
    // and not from WebSocket updates
    if (currentMessageCount > previousMessageCount && 
        previousMessageCount > 0 && 
        isUpdatingFromRequest) {
      
      const heightDifference = container.scrollHeight - previousScrollHeightRef.current;
      
      if (heightDifference > 0) {
        // Preserve scroll position by adjusting for the new content height
        const newScrollTop = previousScrollTopRef.current + heightDifference;
        container.scrollTop = newScrollTop;
      }
    }

    // Store current values for next comparison
    messagesCountRef.current = currentMessageCount;
    previousScrollHeightRef.current = container.scrollHeight;
    previousScrollTopRef.current = container.scrollTop;
  }, [messages.length, messagesContainerRef, isUpdatingFromRequest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      if (dateLabelTimeoutRef.current) {
        clearTimeout(dateLabelTimeoutRef.current);
      }
    };
  }, []);

  return {
    isScrolledToBottom,
    setIsScrolledToBottom,
    showScrollButton,
    setShowScrollButton,
    showDateLabel,
    setShowDateLabel,
    currentDateLabel,
    setCurrentDateLabel,
    disableAutoScroll,
    setDisableAutoScroll,
    scrollToBottom,
    scrollToMessage,
    prepareScrollCorrection,
    setDisableSmoothScroll
  };
};