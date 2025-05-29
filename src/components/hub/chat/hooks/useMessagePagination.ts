import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ExtendedMessage } from '../types/message';

export type LoadingMode = 'initial' | 'pagination' | 'around' | null;

export interface MessagePaginationState {
  beforeId: number | null;
  afterId: number | null;
  hasMoreMessages: boolean;
  hasMoreMessagesAfter: boolean;
  enableAfterPagination: boolean;
  loadingMode: LoadingMode;
  skipMainQuery: boolean;
  isJumpingToMessage: boolean;
  aroundMessageId: number | null;
}

export interface MessagePaginationActions {
  setBeforeId: (id: number | null) => void;
  setAfterId: (id: number | null) => void;
  setHasMoreMessages: (has: boolean) => void;
  setHasMoreMessagesAfter: (has: boolean) => void;
  setEnableAfterPagination: (enable: boolean) => void;
  setLoadingMode: (mode: LoadingMode) => void;
  setSkipMainQuery: (skip: boolean) => void;
  setIsJumpingToMessage: (jumping: boolean) => void;
  setAroundMessageId: (id: number | null) => void;
  handleScrollPagination: (
    container: HTMLElement,
    messages: ExtendedMessage[],
    messagesPerPage: number
  ) => void;
  resetPagination: () => void;
  jumpToMessage: (messageId: number) => void;
}

export interface UseMessagePaginationReturn {
  state: MessagePaginationState;
  actions: MessagePaginationActions;
  isLoadingMoreRef: React.MutableRefObject<boolean>;
  lastBeforeIdRef: React.MutableRefObject<number | null>;
  lastAfterIdRef: React.MutableRefObject<number | null>;
  setLoadingWithTimeout: (loading: boolean) => void;
}

export const useMessagePagination = (): UseMessagePaginationReturn => {
  // States
  const [beforeId, setBeforeId] = useState<number | null>(null);
  const [afterId, setAfterId] = useState<number | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [hasMoreMessagesAfter, setHasMoreMessagesAfter] = useState(true);
  const [enableAfterPagination, setEnableAfterPagination] = useState(false);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>('initial');
  const [skipMainQuery, setSkipMainQuery] = useState(false);
  const [isJumpingToMessage, setIsJumpingToMessage] = useState(false);
  const [aroundMessageId, setAroundMessageId] = useState<number | null>(null);

  // Refs
  const isLoadingMoreRef = useRef(false);
  const lastBeforeIdRef = useRef<number | null>(null);
  const lastAfterIdRef = useRef<number | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to set loading state with safety timeout
  const setLoadingWithTimeout = useCallback((loading: boolean) => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    isLoadingMoreRef.current = loading;
    
    if (loading) {
      console.log('[Pagination] Setting loading state to true');
      // Set a safety timeout to reset loading state after 10 seconds
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('[Pagination] Loading timeout - resetting loading state after 10 seconds');
        isLoadingMoreRef.current = false;
        setLoadingMode(null);
        loadingTimeoutRef.current = null;
      }, 10000);
    } else {
      console.log('[Pagination] Setting loading state to false');
    }
  }, []);

  const handleScrollPagination = useCallback((
    container: HTMLElement,
    messages: ExtendedMessage[],
    messagesPerPage: number
  ) => {
    // Блокируем пагинацию во время перехода к сообщению
    if (isJumpingToMessage) {
      return;
    }
    
    // Проверяем наличие флагов блокировки пагинации
    // Блокируем только если идет загрузка (isLoadingMoreRef) или если loadingMode это 'initial' или 'around'
    const isPaginationBlocked = isLoadingMoreRef.current || loadingMode === 'initial' || loadingMode === 'around';
    
    if (isPaginationBlocked && process.env.NODE_ENV === 'development') {
      console.log('[Pagination] Pagination blocked:', {
        isLoadingMore: isLoadingMoreRef.current,
        loadingMode,
        isJumpingToMessage
      });
    }
    
    // Вычисляем расстояние до низа
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    
    // Загружаем больше сообщений при скролле вверх (когда остается 20% от верха)
    // Но только если контейнер имеет достаточную высоту (больше 200px)
    if (container.scrollTop < container.scrollHeight * 0.2 && 
        container.scrollHeight > 200 && 
        !isPaginationBlocked && 
        hasMoreMessages && 
        messages.length > 0) {
      // Only load more if we have messages
      if (messages.length >= messagesPerPage) {
        console.log('[Pagination] Loading more messages (scroll up)');
        setLoadingWithTimeout(true);
        setLoadingMode('pagination');
        
        // Get the ID of the oldest message in the current view
        // Сортируем сообщения перед выбором ID
        const sortedMsgs = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const oldestMessage = sortedMsgs[0]; // Первое сообщение в отсортированном массиве
        if (oldestMessage && lastBeforeIdRef.current !== oldestMessage.id) {
          console.log('[Pagination] Setting beforeId:', oldestMessage.id);
          setBeforeId(oldestMessage.id);
          lastBeforeIdRef.current = oldestMessage.id;
          // Очищаем afterId чтобы избежать конфликтов
          setAfterId(null);
          lastAfterIdRef.current = null;
          // Сбрасываем skipMainQuery чтобы запрос мог отправиться
          setSkipMainQuery(false);
        }
      } else {
        // If we have less messages than a full page, we've reached the beginning
        setHasMoreMessages(false);
      }
    }
    
    // Вычисляем процент расстояния до низа от общей высоты скролла
    const scrollPercentFromBottom = (scrollBottom / container.scrollHeight) * 100;
    
    // Загружаем больше сообщений когда до низа остается меньше 40% от общей высоты
    if (scrollPercentFromBottom < 40 && !isPaginationBlocked && hasMoreMessagesAfter && enableAfterPagination && messages.length > 0) {        
      if (messages.length > 0) {
        setLoadingWithTimeout(true);
        setLoadingMode('pagination');
        
        // Get the ID of the newest message in the current view
        // Сортируем сообщения перед выбором ID
        const sortedMsgs = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const newestMessage = sortedMsgs[sortedMsgs.length - 1]; // Последнее сообщение в отсортированном массиве
                  
        if (newestMessage && lastAfterIdRef.current !== newestMessage.id) {
          setAfterId(newestMessage.id);
          lastAfterIdRef.current = newestMessage.id;
          // Очищаем beforeId чтобы избежать конфликтов
          setBeforeId(null);
          lastBeforeIdRef.current = null;
          // Сбрасываем skipMainQuery чтобы запрос мог отправиться
          setSkipMainQuery(false);
        }
      }
    }
  }, [
    isJumpingToMessage,
    loadingMode,
    hasMoreMessages,
    hasMoreMessagesAfter,
    enableAfterPagination,
    setLoadingWithTimeout
  ]);

  const resetPagination = useCallback(() => {
    setBeforeId(null);
    setAfterId(null);
    setHasMoreMessages(true);
    setHasMoreMessagesAfter(true);
    setEnableAfterPagination(false);
    setLoadingMode('initial');
    setSkipMainQuery(false);
    setIsJumpingToMessage(false);
    setAroundMessageId(null);
    setLoadingWithTimeout(false);
    lastBeforeIdRef.current = null;
    lastAfterIdRef.current = null;
  }, [setLoadingWithTimeout]);

  const jumpToMessage = useCallback((messageId: number) => {
    setIsJumpingToMessage(true);
    setAroundMessageId(messageId);
    setLoadingMode('around');
    setSkipMainQuery(true);
    // Reset pagination state
    setBeforeId(null);
    setAfterId(null);
    lastBeforeIdRef.current = null;
    lastAfterIdRef.current = null;
    setLoadingWithTimeout(false);
  }, [setLoadingWithTimeout]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  const state: MessagePaginationState = useMemo(() => ({
    beforeId,
    afterId,
    hasMoreMessages,
    hasMoreMessagesAfter,
    enableAfterPagination,
    loadingMode,
    skipMainQuery,
    isJumpingToMessage,
    aroundMessageId,
  }), [
    beforeId,
    afterId,
    hasMoreMessages,
    hasMoreMessagesAfter,
    enableAfterPagination,
    loadingMode,
    skipMainQuery,
    isJumpingToMessage,
    aroundMessageId,
  ]);

  const actions: MessagePaginationActions = useMemo(() => ({
    setBeforeId,
    setAfterId,
    setHasMoreMessages,
    setHasMoreMessagesAfter,
    setEnableAfterPagination,
    setLoadingMode,
    setSkipMainQuery,
    setIsJumpingToMessage,
    setAroundMessageId,
    handleScrollPagination,
    resetPagination,
    jumpToMessage,
  }), [
    handleScrollPagination,
    resetPagination,
    jumpToMessage
  ]);

  return {
    state,
    actions,
    isLoadingMoreRef,
    lastBeforeIdRef,
    lastAfterIdRef,
    setLoadingWithTimeout,
  };
};