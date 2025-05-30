import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import React from 'react';
import { Box, Typography } from '@mui/material';
import { ExtendedMessage } from '../types/message';
import ChatMessageItem from '../components/ChatMessageItem';
import UserAvatar from '../../../UserAvatar';

// Этот подход измеряет ВСЕ элементы сразу при первом рендере,
// как делают Telegram и WhatsApp

interface MeasuredItem {
  index: number;
  height: number;
  offset: number;
}

interface VirtualItem {
  id: string;
  index: number;
  start: number;
  size: number;
  type: 'message' | 'date';
  data: any;
}

interface UseMessengerVirtualizationOptions {
  overscan?: number;
  onScroll?: (container: HTMLElement) => void;
  preventScrollAdjustment?: boolean;
}

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

export const useMessengerVirtualization = (
  messages: ExtendedMessage[],
  tempMessages: Map<string, ExtendedMessage>,
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseMessengerVirtualizationOptions = {}
) => {
  const {
    overscan = 5,
    onScroll,
    preventScrollAdjustment = false
  } = options;

  // Состояния
  const [containerHeight, setContainerHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(800);
  const [scrollTop, setScrollTop] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  
  // Рефы для хранения измерений
  const measuredItemsRef = useRef<MeasuredItem[]>([]);
  const measurementContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Для коррекции скролла при пагинации
  const scrollCorrectionRef = useRef<{
    type: 'before' | 'after' | 'around';
    anchorMessageId: number | null;
    anchorOffset: number;
    oldScrollHeight: number;
  } | null>(null);
  
  // Для отслеживания изменений в сообщениях
  const prevMessagesRef = useRef<{ firstId: number | null; lastId: number | null; count: number }>({
    firstId: null,
    lastId: null,
    count: 0
  });
  
  // Версия для форсирования пересчета при изменении сообщений
  const [measurementVersion, setMeasurementVersion] = useState(0);

  // Обработка сообщений (добавление дат и группировка)
  const processedItems = useMemo(() => {
    const allMessages = [...messages, ...Array.from(tempMessages.values())];
    const sortedMessages = allMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const items: Array<{
      type: 'message' | 'date';
      data: ExtendedMessage | string;
      isFirstOfGroup?: boolean;
    }> = [];

    let currentDateString: string | null = null;
    let previousMessage: ExtendedMessage | null = null;

    sortedMessages.forEach((msg) => {
      const messageDate = new Date(msg.created_at);
      const messageDateString = messageDate.toDateString();

      // Добавляем разделитель даты
      if (currentDateString !== messageDateString) {
        items.push({
          type: 'date',
          data: msg.created_at
        });
        currentDateString = messageDateString;
      }

      // Определяем группировку
      const isFirstOfGroup = !previousMessage || 
        previousMessage.author.id !== msg.author.id || 
        Math.abs(new Date(previousMessage.created_at).getTime() - new Date(msg.created_at).getTime()) > 30 * 60 * 1000;

      items.push({
        type: 'message',
        data: msg,
        isFirstOfGroup
      });
      
      previousMessage = msg;
    });

    // Определяем тип изменения сообщений для правильной коррекции скролла
    if (messages.length > 0) {
      const currentFirstId = messages[0]?.id || null;
      const currentLastId = messages[messages.length - 1]?.id || null;
      
      if (prevMessagesRef.current.count > 0) {
        if (currentFirstId !== prevMessagesRef.current.firstId && prevMessagesRef.current.firstId !== null) {
          // Новые сообщения добавлены сверху
          console.log('New messages loaded at top');
        } else if (currentLastId !== prevMessagesRef.current.lastId && prevMessagesRef.current.lastId !== null) {
          // Новые сообщения добавлены снизу
          console.log('New messages loaded at bottom');
        }
      }
      
      prevMessagesRef.current = {
        firstId: currentFirstId,
        lastId: currentLastId,
        count: messages.length
      };
    }

    return items;
  }, [messages, tempMessages]);

  // Оптимизированная функция измерения - батчами
  const measureAllItems = useCallback(() => {
    if (!measurementContainerRef.current || processedItems.length === 0) {
      return;
    }

    const container = measurementContainerRef.current;
    const messageElements = container.querySelectorAll('[data-measure-index]');
    const newMeasurements: MeasuredItem[] = [];
    let totalOffset = 0;

    // Измеряем все сразу, но оптимизируем DOM запросы
    messageElements.forEach((element) => {
      const indexStr = element.getAttribute('data-measure-index');
      if (!indexStr) return;
      
      const index = parseInt(indexStr, 10);
      if (isNaN(index) || index < 0 || index >= processedItems.length) return;
      
      const height = (element as HTMLElement).offsetHeight;
      
      newMeasurements[index] = {
        index,
        height,
        offset: totalOffset
      };
      
      totalOffset += height;
    });

    measuredItemsRef.current = newMeasurements;
    
    // Используем setTimeout для лучшей отзывчивости UI
    setTimeout(() => {
      setIsInitialized(true);
    }, 0);
  }, [processedItems.length]);

  // Подготовка коррекции скролла перед изменением контента
  const prepareScrollCorrection = useCallback(() => {
    const container = containerRef.current;
    if (!container || preventScrollAdjustment || !isInitialized || processedItems.length === 0 || measuredItemsRef.current.length === 0) return;
    
    const currentScrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    
    // Находим первое видимое сообщение
    let anchorMessageId: number | null = null;
    let anchorOffset = 0;
    
    for (let i = 0; i < Math.min(measuredItemsRef.current.length, processedItems.length); i++) {
      const item = measuredItemsRef.current[i];
      const processedItem = processedItems[i];
      
      if (item && processedItem && item.offset <= currentScrollTop && item.offset + item.height > currentScrollTop) {
        // Нашли элемент, который пересекает верхнюю границу viewport
        if (processedItem.type === 'message') {
          anchorMessageId = (processedItem.data as ExtendedMessage).id;
          anchorOffset = currentScrollTop - item.offset;
        }
        break;
      }
    }
    
    // Определяем тип пагинации по позиции скролла
    let type: 'before' | 'after' | 'around' = 'before';
    if (currentScrollTop < 500) {
      type = 'before';
    } else if (scrollHeight - currentScrollTop - container.clientHeight < 500) {
      type = 'after';
    }
    
    scrollCorrectionRef.current = {
      type,
      anchorMessageId,
      anchorOffset,
      oldScrollHeight: scrollHeight
    };
  }, [isInitialized, preventScrollAdjustment, processedItems]);

  // Измеряем все элементы при изменении сообщений или ширины контейнера
  useLayoutEffect(() => {
    // Сохраняем позицию скролла перед измерением
    const container = containerRef.current;
    if (container && isInitialized && scrollCorrectionRef.current === null) {
      prepareScrollCorrection();
    }

    // Сбрасываем инициализацию для повторного измерения
    setIsInitialized(false);
    setMeasurementVersion(v => v + 1);
  }, [processedItems, containerWidth]);

  // Восстанавливаем позицию скролла после измерения
  useLayoutEffect(() => {
    if (isInitialized && scrollCorrectionRef.current && containerRef.current) {
      const { type, anchorMessageId, anchorOffset, oldScrollHeight } = scrollCorrectionRef.current;
      
      if (anchorMessageId) {
        // Находим новую позицию якорного сообщения
        const index = processedItems.findIndex(
          item => item.type === 'message' && (item.data as ExtendedMessage).id === anchorMessageId
        );
        
        if (index !== -1 && measuredItemsRef.current[index]) {
          const newOffset = measuredItemsRef.current[index].offset;
          containerRef.current.scrollTop = newOffset + anchorOffset;
        }
      } else if (type === 'before') {
        // Если не нашли якорное сообщение, корректируем по изменению высоты
        const newScrollHeight = containerRef.current.scrollHeight;
        const heightDiff = newScrollHeight - oldScrollHeight;
        containerRef.current.scrollTop = containerRef.current.scrollTop + heightDiff;
      }
      
      scrollCorrectionRef.current = null;
    }
  }, [isInitialized, processedItems]);

  // Общая высота контента
  const totalHeight = useMemo(() => {
    if (measuredItemsRef.current.length === 0) return 0;
    const lastItem = measuredItemsRef.current[measuredItemsRef.current.length - 1];
    return lastItem ? lastItem.offset + lastItem.height : 0;
  }, [measurementVersion, isInitialized]);

  // Получение видимых элементов
  const getVisibleItems = useCallback((): MeasuredItem[] => {
    if (!isInitialized || measuredItemsRef.current.length === 0) return [];
    
    const scrollStart = Math.max(0, scrollTop - overscan * 100);
    const scrollEnd = scrollTop + containerHeight + overscan * 100;
    
    return measuredItemsRef.current.filter(item => {
      if (!item) return false;
      const itemEnd = item.offset + item.height;
      return itemEnd > scrollStart && item.offset < scrollEnd;
    });
  }, [scrollTop, containerHeight, overscan, isInitialized]);

  // Виртуальные элементы для рендеринга
  const virtualItems = useMemo((): VirtualItem[] => {
    const visibleItems = getVisibleItems();
    
    return visibleItems
      .filter(item => item.index < processedItems.length && processedItems[item.index])
      .map(item => ({
        id: `item-${item.index}`,
        index: item.index,
        start: item.offset,
        size: item.height,
        type: processedItems[item.index]?.type || 'message',
        data: processedItems[item.index]
      }));
  }, [getVisibleItems, processedItems]);

  // Обработка скролла
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const newScrollTop = container.scrollTop;
    setScrollTop(newScrollTop);
    
    if (!isScrolling) {
      setIsScrolling(true);
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
    
    if (onScroll) {
      onScroll(container);
    }
  }, [isScrolling, onScroll]);

  // Подписка на события
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Обновляем размеры контейнера
    const updateDimensions = () => {
      setContainerHeight(container.clientHeight);
      setContainerWidth(container.clientWidth);
    };

    updateDimensions();
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    container.addEventListener('scroll', handleScroll, { passive: true });
    setScrollTop(container.scrollTop);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll]);

  // Функция прокрутки к сообщению
  const scrollToMessage = useCallback((messageId: number) => {
    const index = processedItems.findIndex(
      item => item.type === 'message' && (item.data as ExtendedMessage).id === messageId
    );
    
    if (index !== -1 && measuredItemsRef.current[index] && containerRef.current) {
      const item = measuredItemsRef.current[index];
      const scrollTo = item.offset + item.height / 2 - containerHeight / 2;
      
      containerRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [processedItems, containerHeight]);

  // Функция для измерения элемента (для совместимости с интерфейсом)
  const measureElement = useCallback((index: number, element: HTMLElement | null) => {
    // В этом подходе измерение происходит централизованно через MeasurementLayer
    // Эта функция оставлена для совместимости API
  }, []);

  // Компонент для измерения всех элементов
  const MeasurementLayer = useCallback(({ 
    user, 
    hubId,
    searchMode,
    searchQuery,
    highlightedMessages,
    unreadMessages,
    focusedMessageId,
    editingMessageId,
    handleReplyClick,
    setReplyingToMessage,
    setEditingMessageId,
    handleDeleteMessage,
    editInputRef,
    handleEditMessage
  }: {
    user: { id: number; login: string; avatar: string | null };
    hubId: number;
    searchMode: boolean;
    searchQuery: string;
    highlightedMessages: Set<number>;
    unreadMessages: Set<number>;
    focusedMessageId: number | null;
    editingMessageId: number | null;
    handleReplyClick: (replyId: number) => void;
    setReplyingToMessage: (message: ExtendedMessage) => void;
    setEditingMessageId: (id: number | null) => void;
    handleDeleteMessage: (id: number) => void;
    editInputRef: React.RefObject<HTMLInputElement | null>;
    handleEditMessage: (values: { content: string }, { resetForm }: { resetForm: () => void }) => Promise<void>;
  }) => {
    // Эффект для автоматического измерения после рендера
    useEffect(() => {
      if (!isInitialized && processedItems.length > 0) {
        // Даем минимальное время на рендер, затем измеряем
        const timeout = setTimeout(() => {
          measureAllItems();
        }, 16); // Один кадр для рендера
        
        return () => clearTimeout(timeout);
      }
    }, [processedItems.length]);

    if (isInitialized) return null;

    return (
      <Box
        ref={measurementContainerRef}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
          overflow: 'hidden',
          opacity: 0, // Дополнительная оптимизация
          zIndex: -1, // Убираем из порядка слоев
          contain: 'layout style', // Изоляция для производительности
        }}
      >
        {processedItems.map((item, index) => {
          return (
            <Box key={index} data-measure-index={index}>
              {item.type === 'date' ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    my: 2,
                    px: 3,
                  }}
                >
                  <Box
                    sx={{
                      backgroundColor: 'rgba(30,30,47,0.85)',
                      borderRadius: '16px',
                      px: 2,
                      py: 0.75,
                      // Убираем дорогие эффекты для измерения
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
                </Box>
              ) : (
                <Box sx={{ px: 3 }}>
                  <ChatMessageItem
                    message={item.data as ExtendedMessage}
                    isFirstOfGroup={item.isFirstOfGroup || false}
                    isTempMessage={(item.data as ExtendedMessage).id === -1}
                    isHighlighted={false} // Отключаем для производительности
                    isUnread={false} // Отключаем для производительности  
                    isFocused={false} // Отключаем для производительности
                    isSearchMode={false} // Отключаем поиск для производительности
                    searchQuery=""
                    currentUserId={user.id}
                    hubId={hubId}
                    onReply={() => {}} // Пустые обработчики для производительности
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onReplyClick={() => {}}
                  />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    );
  }, [isInitialized, processedItems, measureAllItems]);

  return {
    virtualItems,
    totalSize: totalHeight,
    scrollToMessage,
    prepareScrollCorrection,
    processedItems,
    isInitialized,
    MeasurementLayer,
    containerHeight,
    measureElement
  };
};