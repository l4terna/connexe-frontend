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
  setInitialLoadComplete: (complete: boolean) => void;
  clearAfterPaginationCooldown: () => void;
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
  const initialLoadCompleteRef = useRef(false);
  const afterPaginationCooldownRef = useRef(false);

  // Helper function to set loading state with safety timeout
  const setLoadingWithTimeout = useCallback((loading: boolean) => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    isLoadingMoreRef.current = loading;
    
    if (loading) {
      // Set a safety timeout to reset loading state after 10 seconds
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('[Pagination] Loading timeout - resetting loading state after 10 seconds');
        isLoadingMoreRef.current = false;
        setLoadingMode(null);
        loadingTimeoutRef.current = null;
      }, 10000);
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
    const isPaginationBlocked = isLoadingMoreRef.current || loadingMode === 'initial' || loadingMode === 'around' || !initialLoadCompleteRef.current;
    
    if (!isPaginationBlocked) {
      // Trigger pagination when scrolled to 20% from top - load older messages
      const scrollPercentageFromTop = container.scrollTop / container.scrollHeight;
      if (scrollPercentageFromTop < 0.2 && hasMoreMessages) {
        // Set loading state
        setLoadingWithTimeout(true);
        setLoadingMode('pagination');
        
        // Чтобы избежать множественных запросов с одним и тем же beforeId,
        // проверяем, отличается ли ID от предыдущего запроса
        // Сортируем сообщения перед выбором ID
        const sortedMsgs = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const oldestMessage = sortedMsgs[0]; // Первое сообщение в отсортированном массиве
        
        if (oldestMessage && lastBeforeIdRef.current !== oldestMessage.id) {
          setBeforeId(oldestMessage.id);
          lastBeforeIdRef.current = oldestMessage.id;
          // Очищаем afterId чтобы избежать конфликтов
          setAfterId(null);
          lastAfterIdRef.current = null;
          // Сбрасываем skipMainQuery чтобы запрос мог отправиться
          setSkipMainQuery(false);
        } else if (oldestMessage) {
          // Если это дубликат запроса, сбрасываем состояние загрузки
          setLoadingWithTimeout(false);
          setLoadingMode(null);
        }
      }
      
      // Pagination for loading newer messages when scrolled close to bottom
      if (enableAfterPagination && 
          !afterPaginationCooldownRef.current && 
          hasMoreMessagesAfter && 
          messages.length >= messagesPerPage) {
        
        const scrolledToBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        
        if (scrolledToBottom) {
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
            
            // Устанавливаем кулдаун для предотвращения повторной пагинации
            afterPaginationCooldownRef.current = true;
          } else if (newestMessage) {
            // Если это дубликат запроса, сбрасываем состояние загрузки
            setLoadingWithTimeout(false);
            setLoadingMode(null);
          }
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
    initialLoadCompleteRef.current = false; // Reset initial load flag
    afterPaginationCooldownRef.current = false; // Reset cooldown flag
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
  
  const setInitialLoadComplete = useCallback((complete: boolean) => {
    initialLoadCompleteRef.current = complete;
  }, []);
  
  const clearAfterPaginationCooldown = useCallback(() => {
    afterPaginationCooldownRef.current = false;
  }, []);

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
    setInitialLoadComplete,
    clearAfterPaginationCooldown,
  }), [
    handleScrollPagination,
    resetPagination,
    jumpToMessage,
    setInitialLoadComplete,
    clearAfterPaginationCooldown
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