import { useState, useRef, useCallback, useEffect } from 'react';

interface UseMessageScrollProps {
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  messages: any[];
  activeChannel: { id: number } | null;
  user: { id: number } | null;
  onScrollToBottom?: () => void;
  onMarkAllAsRead?: () => void;
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
  scrollToBottom: (smooth?: boolean) => void;
  scrollToMessage: (messageId: number) => void;
  handleScrollToBottom: () => void;
}

export const useMessageScroll = ({
  messagesContainerRef,
  messages,
  activeChannel,
  onScrollToBottom,
  onMarkAllAsRead
}: UseMessageScrollProps): UseMessageScrollReturn => {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showDateLabel, setShowDateLabel] = useState(false);
  const [currentDateLabel, setCurrentDateLabel] = useState<string | null>(null);
  const [disableAutoScroll, setDisableAutoScroll] = useState(false);
  
  const dateLabelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to scroll to bottom
  const scrollToBottom = useCallback((smooth = false) => {
    if (messagesContainerRef.current && !disableAutoScroll) {
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
  }, [disableAutoScroll, messagesContainerRef]);

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
    container.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth'
    });
    
    // Highlight the message
    messageElement.style.transition = 'background-color 0.3s ease-in-out';
    messageElement.style.backgroundColor = 'rgba(0, 207, 255, 0.1)';
    
    // Remove highlight after 2 seconds
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    highlightTimeoutRef.current = setTimeout(() => {
      messageElement.style.backgroundColor = '';
      highlightTimeoutRef.current = null;
    }, 1500);
  }, [messagesContainerRef]);

  // Function to scroll to bottom and mark all messages as read
  const handleScrollToBottom = useCallback(() => {
    // Re-enable auto-scroll as user explicitly requested to scroll down
    setDisableAutoScroll(false);
    
    // Mark all messages as read
    if (onMarkAllAsRead) {
      onMarkAllAsRead();
    }
    
    // Scroll to bottom
    scrollToBottom(false);
  }, [scrollToBottom, onMarkAllAsRead]);

  // Helper function to format date for group
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

  // Effect to track scroll position and handle scroll events
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Track intentional scroll up
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
      
      // Determine scroll direction
      if (currentScrollTop < lastScrollTop) {
        // Scrolling up
        if (!intentionalScrollUp) {
          intentionalScrollUp = true;
          scrollMovementStartTime = Date.now();
        }
      } else if (currentScrollTop > lastScrollTop) {
        // Scrolling down
        if (isAtBottom) {
          intentionalScrollUp = false;
        }
      }
      
      // Update last scroll position
      lastScrollTop = currentScrollTop;
      
      // Set state only if user is not scrolling up or enough time has passed
      const scrollTimeElapsed = Date.now() - scrollMovementStartTime;
      if (!intentionalScrollUp || scrollTimeElapsed > 1000) {
        setIsScrolledToBottom(isAtBottom);
      }
      
      // If scrolled to bottom, mark all messages as read and re-enable auto-scroll
      if (isAtBottom && activeChannel) {
        // Re-enable auto-scroll when user manually scrolls to bottom
        setDisableAutoScroll(false);
        
        // Mark all messages as read
        if (onMarkAllAsRead) {
          onMarkAllAsRead();
        }
      }
      
      // Show/hide scroll button
      setShowScrollButton(container.scrollTop + container.clientHeight < container.scrollHeight - 400);
      
      // Handle date label visibility
      if (dateLabelTimeoutRef.current) {
        clearTimeout(dateLabelTimeoutRef.current);
      }
      
      // Check for visible date labels
      const visibleElements = container.querySelectorAll('.message-item');
      if (!visibleElements.length) return;
      
      let visibleDate: string | null = null;
      
      // Process visible elements to find date
      visibleElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const isVisible = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
        
        if (isVisible && !visibleDate) {
          const dateAttr = element.getAttribute('data-date');
          if (dateAttr) {
            visibleDate = formatDateForGroup(dateAttr);
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
      
      // Set a timeout to determine when scrolling has stopped
      scrollTimeoutId = setTimeout(() => {
        scrollTimeoutId = null;
      }, 150);
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
  }, [activeChannel, messages, messagesContainerRef, onMarkAllAsRead]);

  // Effect to handle scroll to bottom
  useEffect(() => {
    if (isScrolledToBottom && onScrollToBottom) {
      onScrollToBottom();
    }
  }, [isScrolledToBottom, onScrollToBottom]);

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
    handleScrollToBottom
  };
};