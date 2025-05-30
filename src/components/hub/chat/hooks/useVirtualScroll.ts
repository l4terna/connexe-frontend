import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { ExtendedMessage } from '../types/message';

interface VirtualItem {
  id: string;
  index: number;
  start: number;
  size: number;
  type: 'message' | 'date' | 'loading';
  data?: any;
}

interface UseVirtualScrollOptions {
  containerHeight: number;
  estimatedItemSize: number;
  overscan?: number;
  getScrollElement: () => HTMLElement | null;
  preventScrollAdjustment?: boolean;
  getItemHeight?: (i: number) => number;
  getItemKey?: (i: number) => string;
  heightCache?: { [itemKey: string]: number };
}

interface UseVirtualScrollResult {
  virtualItems: VirtualItem[];
  totalSize: number;
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
  scrollToOffset: (offset: number) => void;
  measureElement: (index: number, element: HTMLElement | null) => void;
  prepareScrollCorrection: () => void;
  heightCache: { [itemKey: string]: number };
}

export const useVirtualScroll = (
  items: any[],
  options: UseVirtualScrollOptions & { onScroll?: (element: HTMLElement) => void }
): UseVirtualScrollResult => {
  const {
    containerHeight,
    estimatedItemSize,
    overscan = 5,
    getScrollElement,
    onScroll,
    preventScrollAdjustment = false,
    getItemHeight = () => estimatedItemSize,
    getItemKey = (i) => i.toString(),
    heightCache = {},
  } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const heightCacheRef = useRef(heightCache);

  // Store measured sizes for each item
  const itemOffsetsRef = useRef<number[]>([]);
  const measurementsRef = useRef<number[]>([]);

  // Track measured elements to observe size changes
  const resizeObserverRef = useRef<ResizeObserver | undefined>(undefined);
  const measuredElementsRef = useRef<Map<number, HTMLElement>>(new Map());

  // Force re-render when measurements change
  const [measurementVersion, setMeasurementVersion] = useState(0);

  // Дебаунс для обновления измерений
  const measurementUpdateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Scroll correction state for pagination
  const [scrollCorrection, setScrollCorrection] = useState<{
    heightBefore: number;
    scrollBefore: number;
    shouldCorrect: boolean;
  } | null>(null);

  // Обновляем setMeasurementVersion чтобы использовать дебаунс
  const updateMeasurements = useCallback(() => {
    if (measurementUpdateTimeoutRef.current) {
      clearTimeout(measurementUpdateTimeoutRef.current);
    }

    measurementUpdateTimeoutRef.current = setTimeout(() => {
      setMeasurementVersion((v) => v + 1);
    }, 50); // Небольшая задержка для батчинга обновлений
  }, []);

  // Calculate item offsets and total size
  const { totalSize } = useMemo(() => {
    const oldMeasurements = measurementsRef.current.slice(0, items.length);
    const newMeasurements = [];

    for (let i = 0; i < items.length; i++) {
      const itemKey = getItemKey(i);
      const cachedHeight = heightCacheRef.current[itemKey];
      const oldHeight = oldMeasurements[i];
      
      if (cachedHeight) {
        // Use the cached height if available
        newMeasurements[i] = cachedHeight;
      } else if (oldHeight) {
        // Otherwise fall back to previously measured height
        newMeasurements[i] = oldHeight;
      } else {
        // Get the estimated height for this item
        const estimatedHeight = getItemHeight(i);
        newMeasurements[i] = estimatedHeight;
        
        // Pre-populate the cache with our estimation
        // This helps avoid layout shifts when scrolling quickly
        heightCacheRef.current[itemKey] = estimatedHeight;
      }
    }

    const offsets: number[] = [];
    let currentOffset = 0;

    for (let i = 0; i < items.length; i++) {
      offsets[i] = currentOffset;
      const size = newMeasurements[i];
      currentOffset += size;
    }

    itemOffsetsRef.current = offsets;
    measurementsRef.current = newMeasurements;
    return { itemOffsets: offsets, totalSize: currentOffset };
  }, [items.length, estimatedItemSize, measurementVersion]);

  // Find the range of visible items
  const { virtualItems } = useMemo(() => {
    if (items.length === 0) {
      return { startIndex: 0, endIndex: -1, virtualItems: [] };
    }

    const scrollStart = scrollTop;
    const scrollEnd = scrollTop + containerHeight;

    // Binary search for start index
    let start = 0;
    let end = items.length - 1;

    while (start <= end) {
      const mid = Math.floor((start + end) / 2);
      const offset = itemOffsetsRef.current[mid];

      if (offset < scrollStart) {
        start = mid + 1;
      } else {
        end = mid - 1;
      }
    }

    const startIdx = Math.max(0, start - overscan);

    // Find end index
    let endIdx = startIdx;
    while (
      endIdx < items.length &&
      itemOffsetsRef.current[endIdx] < scrollEnd
    ) {
      endIdx++;
    }
    endIdx = Math.min(items.length - 1, endIdx + overscan);

    // Create virtual items
    const virtualItemsList: VirtualItem[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const offset = itemOffsetsRef.current[i];
      const size = measurementsRef.current[i];

      virtualItemsList.push({
        id: `item-${i}`,
        index: i,
        start: offset,
        size,
        type: items[i]?.type || 'message', // Use type from item if available
        data: items[i]?.data || items[i],
      });
    }

    return {
      startIndex: startIdx,
      endIndex: endIdx,
      virtualItems: virtualItemsList,
    };
  }, [scrollTop, containerHeight, items.length, overscan, estimatedItemSize, measurementVersion]);

  // Throttle scroll updates
  const scrollThrottleRef = useRef<boolean>(false);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    // Throttle scroll updates to every 16ms (60fps)
    if (scrollThrottleRef.current) return;
    scrollThrottleRef.current = true;

    requestAnimationFrame(() => {
      const element = getScrollElement();
      if (!element) {
        scrollThrottleRef.current = false;
        return;
      }

      const newScrollTop = element.scrollTop;
      setScrollTop(newScrollTop);

      if (!isScrolling) {
        setIsScrolling(true);
      }

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set timeout to detect when scrolling stops
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      // Call additional onScroll callback if provided
      if (onScroll) {
        onScroll(element);
      }

      scrollThrottleRef.current = false;
    });
  }, [isScrolling, onScroll]);

  // Set up scroll listener
  useEffect(() => {
    const element = getScrollElement();
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });

    // Get initial scroll position
    setScrollTop(element.scrollTop);

    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll]);

  // Initialize ResizeObserver
  useEffect(() => {
    resizeObserverRef.current = new ResizeObserver((entries) => {
      let hasChanges = false;
      const scrollElement = getScrollElement();
      const currentScrollTop = scrollElement?.scrollTop || 0;

      // Track total size change for items above current viewport
      let sizeChangeAboveViewport = 0;

      entries.forEach((entry) => {
        const element = entry.target as HTMLElement;
        const index = parseInt(element.dataset.index || '-1');

        if (index >= 0) {
          const currentSize = measurementsRef.current[index];
          const newSize = entry.contentRect.height;

          if (currentSize !== newSize) {
            measurementsRef.current[index] = newSize;
            hasChanges = true;

            // Calculate if this affects scroll position
            const itemOffset = itemOffsetsRef.current[index] || 0;
            if (itemOffset < currentScrollTop && currentSize) {
              sizeChangeAboveViewport += newSize - currentSize;
            }

            // Update the height cache for this item
            const itemKey = getItemKey(index);
            heightCacheRef.current[itemKey] = newSize;
          }
        }
      });

      if (hasChanges) {
        updateMeasurements();

        // Only adjust scroll position if user is not actively scrolling
        // and we're not in a state where new content is being loaded at the bottom
        if (sizeChangeAboveViewport !== 0 && scrollElement && !isScrolling && !preventScrollAdjustment) {
          // Check if we're near the bottom - if so, don't adjust scroll position
          const isNearBottom = (scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight) < 100;

          if (!isNearBottom) {
            requestAnimationFrame(() => {
              scrollElement.scrollTop = currentScrollTop + sizeChangeAboveViewport;
            });
          }
        }
      }
    });

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [isScrolling, preventScrollAdjustment]);

  // Function to measure an element and update cache
  const measureElement = useCallback((index: number, element: HTMLElement | null) => {
    // Unobserve previous element for this index
    const previousElement = measuredElementsRef.current.get(index);
    if (previousElement && resizeObserverRef.current) {
      resizeObserverRef.current.unobserve(previousElement);
      measuredElementsRef.current.delete(index);
    }

    if (element && resizeObserverRef.current) {
      // Store data-index attribute for ResizeObserver
      element.dataset.index = index.toString();

      // Measure initial size
      const newSize = element.getBoundingClientRect().height;
      const currentSize = measurementsRef.current[index];

      if (currentSize !== newSize) {
        measurementsRef.current[index] = newSize;
        updateMeasurements();

        // Update the height cache for this item
        const itemKey = getItemKey(index);
        heightCacheRef.current[itemKey] = newSize;
      }

      // Track element and observe for resize
      measuredElementsRef.current.set(index, element);
      resizeObserverRef.current.observe(element);
    }
  }, []);

  // Function to scroll to a specific index
  const scrollToIndex = useCallback(
    (index: number, align: 'start' | 'center' | 'end' = 'start') => {
      const element = getScrollElement();
      if (!element || index < 0 || index >= items.length) return;

      const offset = itemOffsetsRef.current[index];
      const size = measurementsRef.current[index];

      let scrollTo = offset;

      switch (align) {
        case 'center':
          scrollTo = offset + size / 2 - containerHeight / 2;
          break;
        case 'end':
          scrollTo = offset + size - containerHeight;
          break;
        default: // 'start'
          scrollTo = offset;
      }

      element.scrollTop = Math.max(0, scrollTo);
    },
    [items.length, containerHeight]
  );

  // Function to scroll to a specific offset
  const scrollToOffset = useCallback((offset: number) => {
    const element = getScrollElement();
    if (!element) return;

    element.scrollTop = Math.max(0, offset);
  }, []);

  // Function to prepare scroll correction before content changes
  const prepareScrollCorrection = useCallback(() => {
    const element = getScrollElement();
    if (!element || preventScrollAdjustment) return;

    setScrollCorrection({
      heightBefore: element.scrollHeight,
      scrollBefore: element.scrollTop,
      shouldCorrect: true,
    });
  }, [getScrollElement, preventScrollAdjustment]);

  // Synchronous scroll correction after content changes
  useLayoutEffect(() => {
    if (!scrollCorrection?.shouldCorrect) return;

    const element = getScrollElement();
    if (!element) return;

    // Calculate height difference
    const heightAfter = element.scrollHeight;
    const heightDiff = heightAfter - scrollCorrection.heightBefore;

    if (heightDiff > 0) {
      // Correct scroll position synchronously
      element.scrollTop = scrollCorrection.scrollBefore + heightDiff;

      // Ensure minimum distance from top
      if (element.scrollTop < 150) {
        element.scrollTop = 150;
      }
    }

    // Reset correction state
    setScrollCorrection(null);
  }, [scrollCorrection, getScrollElement]);

  return {
    virtualItems,
    totalSize,
    scrollToIndex,
    scrollToOffset,
    measureElement,
    prepareScrollCorrection,
    heightCache: heightCacheRef.current,
  };
};

// Hook specifically for message virtualization with grouping support
export const useMessageVirtualization = (
  messages: ExtendedMessage[],
  tempMessages: Map<string, ExtendedMessage>,
  containerRef: React.RefObject<HTMLElement | null>,
  options: {
    estimatedItemSize?: number;
    overscan?: number;
    onScroll?: (container: HTMLElement) => void;
    preventScrollAdjustment?: boolean;
  } = {}
) => {
  const {
    estimatedItemSize = 60, // Single size for all items
    overscan = 5,
    onScroll,
    preventScrollAdjustment = false
  } = options;

  const [containerHeight, setContainerHeight] = useState(600);
  
  // Update container height when ref changes
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []); // Empty dependencies since containerRef is stable

  // Removed complex height estimation - using simple estimatedItemSize for all items

  // Process messages into virtual items (including date separators)
  const processedItems = useMemo(() => {
    const allMessages = [...messages, ...Array.from(tempMessages.values())];
    const sortedMessages = allMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const items: Array<{
      type: 'message' | 'date';
      data: ExtendedMessage | string;
      estimatedSize: number;
    }> = [];

    let currentDateString: string | null = null;
    let processedDates = new Set<string>();
    let previousMessage: ExtendedMessage | null = null;

    sortedMessages.forEach((msg) => {
      const messageDate = new Date(msg.created_at);
      const messageDateString = messageDate.toDateString();

      // Add date separator if this is a new date
      if (currentDateString !== messageDateString && !processedDates.has(messageDateString)) {
        items.push({
          type: 'date',
          data: msg.created_at,
          estimatedSize: estimatedItemSize
        });
        currentDateString = messageDateString;
        processedDates.add(messageDateString);
      }

      // Add the message with simple estimated size
      items.push({
        type: 'message',
        data: msg,
        estimatedSize: estimatedItemSize
      });
      
      previousMessage = msg;
    });

    return items;
  }, [messages, tempMessages, estimatedItemSize]);

  // Create items with their estimated sizes for virtual scroll
  const itemsWithSizes = useMemo(() => 
    processedItems.map(item => ({
      ...item,
      size: item.estimatedSize
    })),
    [processedItems]
  );

  const virtualScroll = useVirtualScroll(itemsWithSizes, {
    containerHeight,
    estimatedItemSize: estimatedItemSize,
    overscan,
    getScrollElement: () => containerRef.current as HTMLElement,
    onScroll,
    preventScrollAdjustment
  });

  // Function to scroll to a specific message
  const scrollToMessage = useCallback((messageId: number) => {
    const messageIndex = processedItems.findIndex(
      item => item.type === 'message' && 
      typeof item.data === 'object' && 
      'id' in item.data && 
      item.data.id === messageId
    );
    
    if (messageIndex !== -1 && containerRef.current) {
      // Сначала убедимся, что контейнер существует
      const container = containerRef.current;
      
      // Используем несколько requestAnimationFrame для гарантии обновления DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Прокручиваем к элементу
          virtualScroll.scrollToIndex(messageIndex, 'center');
          
          // Дополнительная проверка и корректировка через небольшую задержку
          setTimeout(() => {
            // Находим реальный DOM элемент
            const messageElement = container.querySelector(`[data-msg-id="${messageId}"]`);
            if (messageElement) {
              const rect = messageElement.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              
              // Проверяем, видим ли элемент
              const isVisible = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
              
              if (!isVisible) {
                // Если элемент не полностью видим, прокручиваем к нему еще раз
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }, 100);
        });
      });
    } else {
      console.warn('Message not found in processedItems:', messageId, 'Items count:', processedItems.length);
    }
  }, [processedItems, virtualScroll.scrollToIndex, containerRef]);

  return {
    ...virtualScroll,
    processedItems,
    scrollToMessage,
    containerHeight,
    prepareScrollCorrection: virtualScroll.prepareScrollCorrection
  };
};