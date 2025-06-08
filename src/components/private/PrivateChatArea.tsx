import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Box, Skeleton } from '@mui/material';
import PrivateMessageList from './components/PrivateMessageList';
import PrivateChatHeader from './components/PrivateChatHeader';
import ChatFooter from '../hub/chat/components/ChatFooter';
import DeleteMessageDialog from '../hub/chat/components/DeleteMessageDialog';
import NewMessagesIndicator from '../hub/chat/components/NewMessagesIndicator';
import { useNotification } from '@/context/NotificationContext';

import { 
  useGetMessagesQuery, 
  useCreateMessageMutation, 
  useUpdateMessageMutation, 
  useDeleteMessageMutation,
  Channel,
  Message,
  ChannelType 
} from '../../api/channels';
import { useMessagePagination } from '../hub/chat/hooks/useMessagePagination';
import { useMessageReadStatus } from '../hub/chat/hooks/useMessageReadStatus';
import { useMessageScroll } from '../hub/chat/hooks/useMessageScroll';
import { useMessageSearch } from '../hub/chat/hooks/useMessageSearch';
import { useMessageWebSocket } from '../hub/chat/hooks/useMessageWebSocket';
import { useMessageState } from '../hub/chat/hooks/useMessageState';
import { ExtendedMessage, MessageStatus } from '../hub/chat/types/message';

interface PrivateChatAreaProps {
  activeChannel: Channel;
  user: {
    id: number;
    login: string;
    avatar: string | null;
  };
  otherUser?: {
    id: number;
    login: string;
    avatar: string | null;
  };
}

const PrivateChatArea: React.FC<PrivateChatAreaProps> = ({ activeChannel, user, otherUser }) => {
  
  const [sending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<ExtendedMessage | null>(null);
  const replyingToMessageRef = useRef<ExtendedMessage | null>(null);
  const [isUpdatingFromRequest, setIsUpdatingFromRequest] = useState(false);
  
  // Использование хука для управления состоянием сообщений
  const {
    messages,
    setMessages,
    tempMessages,
    setTempMessages,
    unreadMessages,
    setUnreadMessages,
    unreadCount,
    newMessagesCount,
    convertToExtendedMessage,
    resetMessageStates,
    updateMessageReadStatus,
    markAllMessagesAsReadInState,
    updateMessageReadByCount,
    deleteMessageFromState,
    updateMessageInState,
    addMessageToState,
    addUnreadMessage,
    removeUnreadMessage,
    updateUnreadCount,
    resetUnreadCounts
  } = useMessageState();
  
  // Использование хука пагинации
  const { state: paginationState, actions: paginationActions, isLoadingMoreRef, lastBeforeIdRef, lastAfterIdRef, setLoadingWithTimeout } = useMessagePagination();
  
  // Refs должны быть объявлены до использования в хуках
  const messagesContainerRef = useRef<HTMLDivElement>(null!);
  const scrollCorrectionRef = useRef<{
    prepareScrollCorrection: () => void;
    setDisableSmoothScroll: (value: boolean) => void;
  }>(null);
  
  // Использование хука для работы с прочитанными сообщениями
  const { markMessageAsRead, markAllMessagesAsRead, addToReadBuffer, unreadMessagesBufferRef } = useMessageReadStatus({
    activeChannel,
    user
  });
  
  // Использование хука для работы со скроллом
  const {
    isScrolledToBottom,
    setIsScrolledToBottom,
    showScrollButton,
    setShowScrollButton,
    showDateLabel,
    setShowDateLabel,
    currentDateLabel,
    setCurrentDateLabel,
    setDisableAutoScroll,
    scrollToBottom,
    scrollToMessage,
    handleScrollToBottom: _handleScrollToBottom
  } = useMessageScroll({
    messagesContainerRef,
    messages,
    activeChannel,
    user,
    onMarkAllAsRead: markAllMessagesAsRead,
    isUpdatingFromRequest
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null!);
  const editInputRef = useRef<HTMLInputElement>(null!);
  const messagesLengthRef = useRef<number>(0);
  const scrollToMessageIdRef = useRef<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [forceScrollToMessageId, setForceScrollToMessageId] = useState<number | null>(null);
  
  // Использование хука поиска (упрощенный для приватного чата)
  const {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    searchMode,
    setSearchMode,
    showSearchResults,
    setShowSearchResults,
    searchResults,
    isSearching,
    handleSearchInputChange,
    clearSearch,
    highlightedMessages,
    setHighlightedMessages,
    focusedMessageId,
    setFocusedMessageId,
    searchInputRef,
    searchResultsRef,
    loadMore,
    hasMore,
    isLoadingMore
  } = useMessageSearch({
    channelId: activeChannel?.id,
    onSearchResultClick: (messageId: number) => {
      const messageExists = messages.some(msg => msg.id === messageId);
      
      if (messageExists) {
        scrollToMessageIdRef.current = messageId;
        setHighlightedMessages(new Set());
        setFocusedMessageId(null);
        
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          newSet.add(messageId);
          return newSet;
        });
        setFocusedMessageId(messageId);
        
        setTimeout(() => {
          setHighlightedMessages(prev => {
            const newSet = new Set(prev);
            newSet.delete(messageId);
            return newSet;
          });
          setFocusedMessageId(null);
        }, 1500);
      } else {
        paginationActions.setIsJumpingToMessage(true);
        paginationActions.setSkipMainQuery(true);
        
        setMessages([]);
        setTempMessages(new Map());
        paginationActions.setBeforeId(null);
        paginationActions.setAfterId(null);
        paginationActions.setHasMoreMessages(true);
        paginationActions.setHasMoreMessagesAfter(true);
        paginationActions.setEnableAfterPagination(true);
        
        setTargetMessageId(messageId);
        paginationActions.setAroundMessageId(messageId);
        paginationActions.setLoadingMode('around');
      }
    }
  });
  
  const [targetMessageId, setTargetMessageId] = useState<number | null>(null);
  const [lastAroundId, setLastAroundId] = useState<number | null>(null);
  
  // Использование хука WebSocket для обработки сообщений (аналогично хабам)
  useMessageWebSocket(
    activeChannel,
    user,
    {
      onMessageCreate: useCallback((newMessage: ExtendedMessage) => {
        addMessageToState(newMessage);
      }, [addMessageToState]),
      
      onMessageUpdate: useCallback((updatedMessage: ExtendedMessage) => {
        updateMessageInState(updatedMessage);
      }, [updateMessageInState]),
      
      onMessageDelete: useCallback((messageId: number) => {
        deleteMessageFromState(messageId);
      }, [deleteMessageFromState]),
      
      onMessageReadStatus: useCallback((range: { from: number; to: number }) => {
        updateMessageReadByCount(range, user.id);
      }, [updateMessageReadByCount, user.id]),
      
      onHighlightMessage: useCallback((messageId: number, duration: number = 1500) => {
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          newSet.add(messageId);
          return newSet;
        });
        
        setTimeout(() => {
          setHighlightedMessages(prev => {
            const newSet = new Set(prev);
            newSet.delete(messageId);
            return newSet;
          });
        }, duration);
      }, [setHighlightedMessages]),
      
      onUnreadMessage: useCallback((messageId: number) => {
        addUnreadMessage(messageId);
      }, [addUnreadMessage]),
      
      onMarkMessageAsRead: useCallback((messageId: number) => {
        updateMessageReadStatus(messageId, user.id);
        removeUnreadMessage(messageId);
        markMessageAsRead(messageId);
      }, [updateMessageReadStatus, removeUnreadMessage, user.id, markMessageAsRead]),
      
      onNewMessageIndicator: useCallback(() => {
        // Placeholder for future functionality
      }, []),
      
      onScrollToBottom: useCallback(() => {
        scrollToBottom();
      }, [scrollToBottom]),
      
      onMarkAllAsRead: useCallback(() => {
        markAllMessagesAsReadInState(user.id);
        markAllMessagesAsRead();
      }, [markAllMessagesAsReadInState, user.id, markAllMessagesAsRead]),
      
      onUnreadCountChange: useCallback((change: number) => {
        updateUnreadCount(change);
      }, [updateUnreadCount])
    },
    {
      messagesContainerRef: messagesContainerRef as React.RefObject<HTMLElement>,
      convertToExtendedMessage,
      isScrolledToBottom,
      isJumpingToMessage: paginationState.isJumpingToMessage,
      loadingMode: paginationState.loadingMode,
      unreadMessagesBufferRef,
      addToReadBuffer
    }
  );
  
  
  const MESSAGES_PER_PAGE = 50;
  
  const shouldRunMainQuery = activeChannel?.type === ChannelType.PRIVATE && 
    !paginationState.skipMainQuery && 
    (paginationState.loadingMode === 'initial' || 
     paginationState.loadingMode === 'pagination' ||
     (paginationState.loadingMode === null && (paginationState.beforeId !== null || paginationState.afterId !== null)));
     
  const queryParams = shouldRunMainQuery ? {
    channelId: activeChannel?.id ?? 0,
    params: {
      size: MESSAGES_PER_PAGE,
      ...(paginationState.loadingMode !== 'initial' && paginationState.beforeId ? { before: paginationState.beforeId } : {}),
      ...(paginationState.loadingMode !== 'initial' && paginationState.afterId ? { after: paginationState.afterId } : {}),
    }
  } : { channelId: 0, params: {} };
  
  const { data: messagesData = [], isLoading, isFetching } = useGetMessagesQuery(
    queryParams,
    { 
      skip: !shouldRunMainQuery,
      refetchOnMountOrArgChange: true,
      refetchOnReconnect: true,
      refetchOnFocus: false
    }
  );
  
  const { data: aroundMessagesData, isLoading: isLoadingAround } = useGetMessagesQuery(
    activeChannel?.type === ChannelType.PRIVATE && paginationState.aroundMessageId && paginationState.loadingMode === 'around' ? {
      channelId: activeChannel?.id ?? 0,
      params: {
        size: MESSAGES_PER_PAGE,
        around: paginationState.aroundMessageId
      }
    } : { channelId: 0, params: {} },
    { 
      skip: !activeChannel || activeChannel.type !== ChannelType.PRIVATE || !paginationState.aroundMessageId || paginationState.loadingMode !== 'around'
    }
  );
  
  const [createMessage] = useCreateMessageMutation();
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const { notify } = useNotification();

  // В приватном чате у пользователей полные права
  const canSendMessages = true;
  const canManageMessages = true;
  
  // Инициализация при входе в новый канал
  useEffect(() => {
    resetMessageStates();
    paginationActions.setHasMoreMessages(true);
    paginationActions.setHasMoreMessagesAfter(true);
    paginationActions.setEnableAfterPagination(false);
    paginationActions.setBeforeId(null);
    paginationActions.setAfterId(null);
    setEditingMessageId(null);
    setCurrentDateLabel(null);
    setShowDateLabel(false);
    setShowScrollButton(false);
    setIsScrolledToBottom(true);
    setLoadingWithTimeout(false);
    lastAfterIdRef.current = null;
    lastBeforeIdRef.current = null;
    
    clearSearch();
    
    setTargetMessageId(null);
    paginationActions.setAroundMessageId(null);
    paginationActions.setLoadingMode('initial');
    paginationActions.setIsJumpingToMessage(false);
    paginationActions.setInitialLoadComplete(false);
    setLastAroundId(null);
    
    paginationActions.setSkipMainQuery(false);
    
    if (activeChannel) {
      markAllMessagesAsRead();
    }
  }, [activeChannel?.id, markAllMessagesAsRead, resetMessageStates]);

  const handleScrollToBottomWithPagination = useCallback(() => {    
    setMessages([]);
    setTempMessages(new Map());
    messagesLengthRef.current = 0;
    
    paginationActions.setLoadingMode('initial');
    paginationActions.setIsJumpingToMessage(false);
    paginationActions.setBeforeId(null);
    paginationActions.setAfterId(null);
    paginationActions.setAroundMessageId(null);
    paginationActions.setSkipMainQuery(false);
    paginationActions.setHasMoreMessages(true);
    paginationActions.setHasMoreMessagesAfter(false);
    paginationActions.setEnableAfterPagination(false);
    
    lastBeforeIdRef.current = null;
    lastAfterIdRef.current = null;
    setTargetMessageId(null);
    setLastAroundId(null);
    
    setUnreadMessages(new Set());
    resetUnreadCounts();
    
    setLoadingWithTimeout(true);
    setDisableAutoScroll(false);
    
    setTimeout(() => {
      paginationActions.setLoadingMode('initial');
    }, 50);
  }, [paginationActions, setMessages, setTempMessages, setUnreadMessages, resetUnreadCounts, setTargetMessageId, setLastAroundId, setLoadingWithTimeout]);

  // Handle around messages
  useEffect(() => {
    if (aroundMessagesData && aroundMessagesData.length > 0 && paginationState.loadingMode === 'around') {      
      setLoadingWithTimeout(true);
      
      const newExtendedMessages = aroundMessagesData.map(convertToExtendedMessage);
      
      setIsUpdatingFromRequest(true);
      setMessages(newExtendedMessages);
      setTimeout(() => setIsUpdatingFromRequest(false), 100);
      messagesLengthRef.current = newExtendedMessages.length;
      
      setLastAroundId(paginationState.aroundMessageId);
      
      lastAfterIdRef.current = null;
      lastBeforeIdRef.current = null;
      
      const unreadMessages = newExtendedMessages.filter(
        msg => msg.status === MessageStatus.NEW && msg.author.id !== user.id
      );
      
      if (unreadMessages.length > 0) {
        setUnreadMessages(new Set(unreadMessages.map(msg => msg.id)));
        resetUnreadCounts();
        updateUnreadCount(unreadMessages.length);
      }
      
      paginationActions.setEnableAfterPagination(true);      
      
      if (newExtendedMessages.length > 5) {
        paginationActions.setHasMoreMessages(true);
        paginationActions.setHasMoreMessagesAfter(true);
      }
    }
  }, [aroundMessagesData, paginationState.loadingMode, convertToExtendedMessage, user.id, paginationActions]);

  // Handle messages load based on loading mode (excluding around)
  useEffect(() => {
    if (!activeChannel || activeChannel.type !== ChannelType.PRIVATE) return;
    
    if (paginationState.loadingMode === 'around') return;
    if (isLoading || isFetching) return;
    if (paginationState.isJumpingToMessage) return;
    if (paginationState.beforeId !== null || paginationState.afterId !== null) return;
    if (lastAroundId !== null && messages.length > 0) return;
    
    if (!messagesData || messagesData.length === 0) {
      setMessages([]);
      if (paginationState.loadingMode === 'initial') {
        setTimeout(() => {
          scrollToBottom();
        }, 50);
      }
      return;
    }
    
    if (paginationState.loadingMode === 'initial') {
      const newExtendedMessages = messagesData.map(convertToExtendedMessage);
            
      setIsUpdatingFromRequest(true);
      setMessages(newExtendedMessages);
      setTimeout(() => setIsUpdatingFromRequest(false), 100);
      messagesLengthRef.current = newExtendedMessages.length;
      
      if (messagesData.length < MESSAGES_PER_PAGE) {
        paginationActions.setHasMoreMessagesAfter(false);
        paginationActions.setEnableAfterPagination(false);
      } else {
        paginationActions.setEnableAfterPagination(false);
      }
      
      const unreadMessages = newExtendedMessages.filter(
        msg => msg.status === MessageStatus.NEW && msg.author.id !== user.id
      );
      
      if (unreadMessages.length > 0) {
        setUnreadMessages(new Set(unreadMessages.map(msg => msg.id)));
        resetUnreadCounts();
        updateUnreadCount(unreadMessages.length);
      }
      
      setTimeout(() => {
        scrollToBottom();
        paginationActions.setLoadingMode(null);
        paginationActions.setInitialLoadComplete(true);
        setLoadingWithTimeout(false);
      }, 100);
    }
  }, [activeChannel, messagesData, isLoading, isFetching, convertToExtendedMessage, user.id, scrollToBottom, paginationState.loadingMode, paginationState.isJumpingToMessage, paginationState.beforeId, paginationState.afterId, paginationActions, lastAroundId, messages.length]);

  const targetMessageIdRef = useRef<number | null>(null);
  
  useLayoutEffect(() => {
    if (paginationState.loadingMode === 'initial' && messages.length > 0 && messagesContainerRef.current) {
      const container = messagesContainerRef.current;      
      const originalScrollBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = 'auto';
      
      container.scrollTop = container.scrollHeight;
      
      requestAnimationFrame(() => {
        if (container.scrollTop < container.scrollHeight - container.clientHeight - 10) {
          container.scrollTop = container.scrollHeight;
        }
        
        container.style.scrollBehavior = originalScrollBehavior;
      });
    }
  }, [messages, paginationState.loadingMode]);
  
  // Effect to handle target message navigation after around loading
  useEffect(() => {
    if (targetMessageId && messages.length > 0 && paginationState.loadingMode === 'around' && !isLoadingAround) {
      const targetExists = messages.some(msg => msg.id === targetMessageId);
      
      if (targetExists) {        
        setLoadingWithTimeout(true);
        
        requestAnimationFrame(() => {
          scrollToMessageIdRef.current = targetMessageId;
          setMessages(prev => [...prev]);
        });
        
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          newSet.add(targetMessageId);
          return newSet;
        });
        setFocusedMessageId(targetMessageId);
        
        setTimeout(() => {
          setHighlightedMessages(prev => {
            const newSet = new Set(prev);
            newSet.delete(targetMessageId);
            return newSet;
          });
          setFocusedMessageId(null);
        }, 1500);
        
        setTimeout(() => {
          setTargetMessageId(null);
          targetMessageIdRef.current = null;
          paginationActions.setAroundMessageId(null);
          
          if (messages.length > 0) {
            lastBeforeIdRef.current = null;
            lastAfterIdRef.current = null;
            
            paginationActions.setHasMoreMessages(true);
            paginationActions.setHasMoreMessagesAfter(true);
            paginationActions.setEnableAfterPagination(true);
          }
          
          setTimeout(() => {
            paginationActions.setLoadingMode(null);
            paginationActions.setIsJumpingToMessage(false);
            paginationActions.setSkipMainQuery(false);
            setDisableAutoScroll(false);
            setLoadingWithTimeout(false);
          }, 300);
        }, 200);
      } 
    }
  }, [messages.length, targetMessageId, paginationState.loadingMode, isLoadingAround, paginationActions, setHighlightedMessages, setFocusedMessageId, setMessages]);

  // Обработчик нажатия Ctrl+F для активации поиска
  useEffect(() => {
    if (!activeChannel) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchMode(true);
        
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 100);
      }
      
      if (e.key === 'Escape' && searchMode) {
        clearSearch();
        setHighlightedMessages(new Set());
        setFocusedMessageId(null);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeChannel, searchMode]);

  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
      const length = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(length, length);
    }
  }, [editingMessageId]);

  useEffect(() => {
    replyingToMessageRef.current = replyingToMessage;
  }, [replyingToMessage]);

  const handleSendMessage = useCallback(async (values: { content: string, images?: File[] }, { resetForm }: { resetForm: () => void }) => {
    if (!activeChannel || !user) return;

    const content = values.content.trim();
    const hasImages = values.images && values.images.length > 0;
    
    if (!content && !hasImages) return;

    resetForm();
    
    const tempId = Date.now();
    const replyMessage = replyingToMessageRef.current;
    
    setReplyingToMessage(null);
    
    try {
      const tempMessage: ExtendedMessage = {
        id: -1,
        content: values.content,
        author: user,
        created_at: new Date().toISOString(),
        last_modified_at: undefined,
        attachments: [],
        status: MessageStatus.SENT,
        read_by_count: 0,
        channel_id: activeChannel.id,
        reply: replyMessage ? {
          ...replyMessage,
          status: replyMessage.status || MessageStatus.SENT
        } : undefined
      };
      
      setTempMessages(prev => {
        const newMap = new Map(prev);
        newMap.set(String(tempId), tempMessage);
        return newMap;
      });
      
      setTimeout(() => {
        scrollToBottom();
      }, 10);
      
      resetForm();

      const apiPayload = {
        channelId: activeChannel.id,
        content: values.content,
        ...(hasImages ? { attachments: values.images } : {}),
        ...(replyMessage?.id ? { replyId: replyMessage.id } : {})
      };
      
      const result = await createMessage(apiPayload).unwrap();
      
      setTempMessages(prev => {
        const newMap = new Map(prev);
        newMap.delete(String(tempId));
        return newMap;
      });
      
      const newMessage: ExtendedMessage = {
        ...result,
        status: MessageStatus.SENT,
        channel_id: activeChannel.id,
        reply: result.reply ? {
          ...result.reply,
          status: (result.reply as any).status || MessageStatus.SENT
        } as ExtendedMessage : undefined
      };
      
      setMessages(prev => [...prev, newMessage]);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      setTempMessages(prev => {
        const newMap = new Map(prev);
        newMap.delete(String(tempId));
        return newMap;
      });
      
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403 && 'data' in error && typeof error.data === 'object' && error.data !== null && 'type' in error.data && error.data.type === 'ACCESS_DENIED') {
        notify('Недостаточно прав для отправки сообщения', 'error');
      } else {
        notify('Ошибка при отправке сообщения', 'error');
      }
    }
  }, [activeChannel, user, createMessage, notify, scrollToBottom]);

  const handleEditMessage = useCallback(async (values: { content: string }, { resetForm }: { resetForm: () => void }) => {
    if (!editingMessageId || !activeChannel) return;

    const content = values.content.trim();
    if (!content) return;

    const originalMessage = messages.find(msg => msg.id === editingMessageId);
    if (!originalMessage) return;

    if (content === originalMessage.content) {
      setEditingMessageId(null);
      resetForm();
      return;
    }

    const optimisticMessage: ExtendedMessage = {
      ...originalMessage,
      content: content,
      last_modified_at: new Date().toISOString()
    };
    
    setMessages(prev => prev.map(msg => 
      msg.id === editingMessageId ? optimisticMessage : msg
    ));
    
    setEditingMessageId(null);
    resetForm();
    
    try {
      const updatedMessage = await updateMessage({
        channelId: activeChannel.id,
        messageId: editingMessageId,
        content
      }).unwrap();
      
      setMessages(prev => prev.map(msg => 
        msg.id === editingMessageId ? convertToExtendedMessage(updatedMessage) : msg
      ));
      
    } catch (error) {
      console.error('Failed to edit message:', error);
      
      setMessages(prev => prev.map(msg => 
        msg.id === editingMessageId ? originalMessage : msg
      ));
      
      notify('Ошибка при обновлении сообщения', 'error');
    }
  }, [editingMessageId, activeChannel, updateMessage, messages, notify]);

  const handleDeleteMessage = useCallback((messageId: number) => {
    setMessageToDelete(messageId);
    setDeleteModalOpen(true);
    setDeleteForEveryone(false);
  }, [messages]);
  
  const confirmDeleteMessage = useCallback(async () => {
    if (!activeChannel || !messageToDelete) return;
    
    const messageToDeleteObj = messages.find(msg => msg.id === messageToDelete);
    if (!messageToDeleteObj) return;
    
    setDeleteModalOpen(false);
    
    setMessages(prev => {
      const filtered = prev.filter(m => m.id !== messageToDelete);
      
      return filtered.map(msg => {
        if (msg.reply && msg.reply.id === messageToDelete) {
          return { ...msg, reply: undefined };
        }
        return msg;
      });
    });
    
    try {
      await deleteMessage({
        channelId: activeChannel.id,
        messageId: messageToDelete,
        forEveryone: deleteForEveryone
      }).unwrap();
      
    } catch (error) {
      console.error('Ошибка при удалении сообщения', error);
      
      setMessages(prev => {
        if (!prev.some(m => m.id === messageToDelete)) {
          const messages = [...prev];
          const index = messages.findIndex(m => new Date(m.created_at) > new Date(messageToDeleteObj.created_at));
          
          if (index === -1) {
            messages.push(messageToDeleteObj);
          } else {
            messages.splice(index, 0, messageToDeleteObj);
          }
          
          return messages.map(msg => {
            if (msg.reply && msg.reply.id === messageToDelete) {
              return { ...msg, reply: messageToDeleteObj };
            }
            return msg;
          });
        }
        return prev;
      });
      
      notify('Ошибка при удалении сообщения', 'error');
    }
    
    setMessageToDelete(null);
    setDeleteForEveryone(false);
  }, [activeChannel, deleteMessage, messages, notify, messageToDelete, deleteForEveryone]);

  const handleSearchResultClick = useCallback((message: Message) => {
    const messageExists = messages.some(msg => msg.id === message.id);
    
    if (messageExists) {      
      clearSearch();
      
      setForceScrollToMessageId(message.id);
      
      requestAnimationFrame(() => {
        scrollToMessageIdRef.current = message.id;
      });
      
      setHighlightedMessages(new Set());
      setFocusedMessageId(null);
      
      setHighlightedMessages(prev => {
        const newSet = new Set(prev);
        newSet.add(message.id);
        return newSet;
      });
      setFocusedMessageId(message.id);
      
      setTimeout(() => {
        setHighlightedMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(message.id);
          return newSet;
        });
        setFocusedMessageId(null);
      }, 1500);
    } else {      
      paginationActions.setLoadingMode('around');
      paginationActions.setSkipMainQuery(true);
      paginationActions.setIsJumpingToMessage(true);
      
      clearSearch();
      
      setDisableAutoScroll(true);
      setLoadingWithTimeout(true);
      
      paginationActions.setBeforeId(null);
      
      setMessages([]);
      setTempMessages(new Map());
      messagesLengthRef.current = 0;
      
      setUnreadMessages(new Set());
      resetUnreadCounts();
      
      setTargetMessageId(message.id);
      paginationActions.setAroundMessageId(message.id);
    }
  }, [messages, clearSearch, paginationActions, setDisableAutoScroll, setLoadingWithTimeout, setMessages, setTempMessages, messagesLengthRef, setUnreadMessages, resetUnreadCounts, setTargetMessageId, scrollToMessageIdRef, setHighlightedMessages, setFocusedMessageId]);

  // Pagination effects - simplified for private chat but keeping the same structure
  useEffect(() => {
    if (messagesData && messagesData.length > 0 && paginationState.beforeId !== null && paginationState.afterId === null && paginationState.loadingMode === 'pagination' && !isLoading && !isFetching) {
      try {
        const firstMessageId = messagesData[0]?.id;
        if (firstMessageId && firstMessageId >= paginationState.beforeId) {
          setLoadingWithTimeout(false);
          paginationActions.setLoadingMode(null);
          paginationActions.setBeforeId(null);
          return;
        }
        
        const container = messagesContainerRef.current;
        if (!container) return;
        
        if (scrollCorrectionRef.current) {
          scrollCorrectionRef.current.prepareScrollCorrection();
          scrollCorrectionRef.current.setDisableSmoothScroll(true);
        }
        
        if (messagesData.length < MESSAGES_PER_PAGE) {
          paginationActions.setHasMoreMessages(false);
        }

        setDisableAutoScroll(true);
        
        const newExtendedMessages = messagesData.map(convertToExtendedMessage);
        
        setIsUpdatingFromRequest(true);
        setMessages((prev: ExtendedMessage[]) => {
          const messagesMap = new Map<number, ExtendedMessage>();
          
          prev.forEach(msg => {
            if (typeof msg.id === 'number' && msg.id > 0) {
              messagesMap.set(msg.id, msg);
            }
          });
          
          newExtendedMessages.forEach(msg => {
            if (typeof msg.id === 'number' && msg.id > 0) {
              messagesMap.set(msg.id, msg);
            }
          });
          
          const mergedMessages = Array.from(messagesMap.values())
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          return mergedMessages;
        });
        setTimeout(() => setIsUpdatingFromRequest(false), 100);

        setTimeout(() => {
          if (scrollCorrectionRef.current) {
            scrollCorrectionRef.current.setDisableSmoothScroll(false);
          }
          setLoadingWithTimeout(false);
          paginationActions.setLoadingMode(null);
        }, 100);
      } catch (error) {
        console.error('Error in pagination loading (before):', error);
        setLoadingWithTimeout(false);
        paginationActions.setLoadingMode(null);
      }
    }
  }, [messagesData, paginationState.beforeId, convertToExtendedMessage, paginationState.loadingMode, isLoading, isFetching, paginationActions, setLoadingWithTimeout]);

  useEffect(() => {
    if (messagesData && messagesData.length > 0 && paginationState.afterId !== null && paginationState.beforeId === null && paginationState.loadingMode === 'pagination' && !isLoading && !isFetching) {
      try {
        let dataToProcess = messagesData;
        const firstMessageId = messagesData[0]?.id;
        if (firstMessageId && firstMessageId <= paginationState.afterId) { 
          const newMessages = messagesData.filter(msg => msg.id > paginationState.afterId!);
          
          if (newMessages.length === 0) {
            paginationActions.setHasMoreMessagesAfter(false);
            paginationActions.setEnableAfterPagination(false);
            setLoadingWithTimeout(false);
            paginationActions.setLoadingMode(null);
            paginationActions.setAfterId(null);
            lastAfterIdRef.current = null;
            return;
          }
          
          dataToProcess = newMessages;
        }
        
        const container = messagesContainerRef.current;
        if (!container) {
          setLoadingWithTimeout(false);
          paginationActions.setLoadingMode(null);
          return;
        }
        
        if (dataToProcess.length < MESSAGES_PER_PAGE) {
          paginationActions.setHasMoreMessagesAfter(false);
          paginationActions.setEnableAfterPagination(false);
        } 

        setDisableAutoScroll(true);
        
        const newExtendedMessages = dataToProcess.map(convertToExtendedMessage);
        
        setIsUpdatingFromRequest(true);
        setMessages((prev: ExtendedMessage[]) => {
          const messagesMap = new Map<number, ExtendedMessage>();
          
          prev.forEach(msg => {
            if (typeof msg.id === 'number' && msg.id > 0) {
              messagesMap.set(msg.id, msg);
            }
          });
          
          newExtendedMessages.forEach(msg => {
            if (typeof msg.id === 'number' && msg.id > 0) {
              messagesMap.set(msg.id, msg);
            }
          });
          
          const mergedMessages = Array.from(messagesMap.values())
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            
          return mergedMessages;
        });
        setTimeout(() => setIsUpdatingFromRequest(false), 100);

        requestAnimationFrame(() => {
          setLoadingWithTimeout(false);
          paginationActions.setLoadingMode(null);
          if (!paginationState.hasMoreMessagesAfter) {
            paginationActions.setAfterId(null);
            lastAfterIdRef.current = null;
          }
          
          setTimeout(() => {
            paginationActions.clearAfterPaginationCooldown();
          }, 500);
        });
      } catch (error) {
        console.error('Error in pagination loading (after):', error);
        setLoadingWithTimeout(false);
        paginationActions.setLoadingMode(null);
        paginationActions.clearAfterPaginationCooldown();
      }
    }
  }, [messagesData, paginationState.afterId, convertToExtendedMessage, paginationState.loadingMode, isLoading, isFetching, paginationActions, paginationState.hasMoreMessagesAfter, lastAfterIdRef, setLoadingWithTimeout]);

  // Scroll tracking effect
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    let lastScrollTop = container.scrollTop;
    let intentionalScrollUp = false;
    let scrollMovementStartTime = 0;
    let scrollTimeoutId: NodeJS.Timeout | null = null;
    let scrollThrottle = false;
    let lastMarkAllAsReadTime = 0; // Дебаунсинг для markAllMessagesAsRead

    const handleScroll = () => {
      if (scrollThrottle) return;
      scrollThrottle = true;
      
      requestAnimationFrame(() => {
        if (scrollTimeoutId) {
          clearTimeout(scrollTimeoutId);
        }

        const currentScrollTop = container.scrollTop;
        const scrollPosition = container.scrollHeight - currentScrollTop - container.clientHeight;
        const isAtBottom = scrollPosition < 100;
        
        if (currentScrollTop < lastScrollTop) {
          if (!intentionalScrollUp) {
            intentionalScrollUp = true;
            scrollMovementStartTime = Date.now();
          }
        } else if (currentScrollTop > lastScrollTop) {
          if (isAtBottom) {
            intentionalScrollUp = false;
          }
        }
        
        lastScrollTop = currentScrollTop;
        
        const scrollTimeElapsed = Date.now() - scrollMovementStartTime;
        if (!intentionalScrollUp || scrollTimeElapsed > 1000) {
          setIsScrolledToBottom(isAtBottom);
        }
        
        if (isAtBottom && activeChannel) {
          setDisableAutoScroll(false);
          
          // Send bulk-read-all request with debouncing (only once per 1000ms)
          const now = Date.now();
          if (now - lastMarkAllAsReadTime > 1000) {
            lastMarkAllAsReadTime = now;
            markAllMessagesAsRead();
          }
          
          setMessages(prev => prev.map(msg => (
            msg.author.id !== user.id 
              ? { ...msg, status: MessageStatus.READ }
              : msg
          )));
          
          setUnreadMessages(new Set());
          resetUnreadCounts();
        }
      
        scrollTimeoutId = setTimeout(() => {
          scrollTimeoutId = null;
        }, 150);
        
        scrollThrottle = false;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeChannel, paginationState.enableAfterPagination, paginationState.hasMoreMessagesAfter, messages]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isScrolledToBottom && newMessagesCount > 0) {
        resetUnreadCounts();
    }
  }, [isScrolledToBottom, newMessagesCount, resetUnreadCounts]);

  useEffect(() => {
    if (forceScrollToMessageId !== null) {
      scrollToMessageIdRef.current = forceScrollToMessageId;
      
      setTimeout(() => {
        setForceScrollToMessageId(null);
      }, 100);
    }
  }, [forceScrollToMessageId]);

  useEffect(() => {
    if (!searchMode) {
      setSearchQuery('');
      setShowSearchResults(false);
      
      setTimeout(() => {
        if (messagesContainerRef.current && paginationState.loadingMode !== 'around' && !paginationState.isJumpingToMessage) {
          const { scrollHeight, scrollTop, clientHeight } = messagesContainerRef.current;
          const scrollPosition = scrollHeight - scrollTop - clientHeight;
          if (scrollPosition < 200) {
            scrollToBottom();
          }
        }
      }, 100);
    }
  }, [searchMode, scrollToBottom, paginationState.loadingMode, paginationState.isJumpingToMessage]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showSearchResults &&
        searchResultsRef.current &&
        searchInputRef.current &&
        !searchResultsRef.current.contains(event.target as Node) &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);

  const renderSkeleton = () => (
      <Box sx={{ 
        flex: 1, 
        height: '100%',
        p: 3, 
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {[...Array(MESSAGES_PER_PAGE)].map((_, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Skeleton 
            variant="circular" 
            width={40} 
            height={40} 
            animation="wave"
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.1)',
              flexShrink: 0,
            }} 
          />
          <Box sx={{ flex: 1 }}>
            <Skeleton 
              variant="text" 
              width={120} 
              height={24} 
              animation="wave"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 1 }} 
            />
            <Skeleton 
              variant="text" 
              width="80%" 
              height={20} 
              animation="wave"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} 
            />
            <Skeleton 
              variant="text" 
              width="60%" 
              height={20} 
              animation="wave"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} 
            />
          </Box>
        </Box>
      ))}
    </Box>
  );

  const renderMessages = () => (
    <PrivateMessageList
      activeChannel={activeChannel}
      messages={messages}
      tempMessages={tempMessages}
      searchMode={searchMode}
      searchQuery={searchQuery}
      highlightedMessages={highlightedMessages}
      focusedMessageId={focusedMessageId}
      unreadMessages={unreadMessages}
      isLoadingMore={isLoadingMoreRef.current}
      isLoadingAround={isLoadingAround}
      editingMessageId={editingMessageId}
      user={user}
      otherUser={otherUser}
      paginationState={paginationState}
      messagesPerPage={MESSAGES_PER_PAGE}
      showDateLabel={showDateLabel}
      currentDateLabel={currentDateLabel}
      messagesContainerRef={messagesContainerRef}
      messagesEndRef={messagesEndRef}
      editInputRef={editInputRef}
      highlightTimeoutRef={highlightTimeoutRef}
      scrollToMessageIdRef={scrollToMessageIdRef}
      setHighlightedMessages={setHighlightedMessages}
      setFocusedMessageId={setFocusedMessageId as React.Dispatch<React.SetStateAction<number | null>>}
      setEditingMessageId={setEditingMessageId}
      setMessages={setMessages}
      setTempMessages={setTempMessages}
      setReplyingToMessage={setReplyingToMessage}
      setTargetMessageId={setTargetMessageId}
      paginationActions={paginationActions}
      handleEditMessage={handleEditMessage}
      handleDeleteMessage={handleDeleteMessage}
      scrollCorrectionRef={scrollCorrectionRef}
      forceScrollToMessageId={forceScrollToMessageId}
    />
  );
  
  return (
    <Box
      sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        background: 'rgba(30,30,47,0.95)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
      }}
    >
      <DeleteMessageDialog
        open={deleteModalOpen}
        messageToDelete={messageToDelete}
        deleteForEveryone={deleteForEveryone}
        canManageMessages={canManageMessages}
        messages={messages}
        userId={user.id}
        onClose={() => {
          setDeleteModalOpen(false);
          setMessageToDelete(null);
          setDeleteForEveryone(false);
        }}
        onConfirm={confirmDeleteMessage}
        onDeleteForEveryoneChange={(value) => setDeleteForEveryone(value)}
      />
      
      <PrivateChatHeader
        activeChannel={activeChannel}
        otherUser={otherUser}
        searchMode={searchMode}
        setSearchMode={setSearchMode}
        searchQuery={searchQuery}
        searchInputRef={searchInputRef as React.RefObject<HTMLInputElement>}
        searchResultsRef={searchResultsRef as React.RefObject<HTMLDivElement>}
        showSearchResults={showSearchResults}
        setShowSearchResults={setShowSearchResults}
        searchResults={searchResults || []}
        isSearching={isSearching}
        debouncedSearchQuery={debouncedSearchQuery}
        handleSearchInputChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchInputChange(e.target.value)}
        clearSearch={clearSearch}
        onSearchResultClick={handleSearchResultClick}
        onLoadMore={loadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        isLoadingMessages={isLoading || isFetching}
        isLoadingAround={isLoadingAround}
        paginationState={{
          loadingMode: paginationState.loadingMode,
          beforeId: paginationState.beforeId,
          afterId: paginationState.afterId,
          isJumpingToMessage: paginationState.isJumpingToMessage,
        }}
      />

      {isLoading && !paginationState.beforeId ? renderSkeleton() : renderMessages()}

      <NewMessagesIndicator
        showScrollButton={showScrollButton}
        newMessagesCount={newMessagesCount}
        unreadCount={unreadCount}
        replyingToMessage={!!replyingToMessage}
        onScrollToBottom={handleScrollToBottomWithPagination}
      />

      <ChatFooter
        activeChannel={activeChannel}
        canSendMessages={canSendMessages}
        sending={sending}
        replyingToMessage={replyingToMessage}
        onSendMessage={handleSendMessage}
        onReplyCancel={() => setReplyingToMessage(null)}
        onReplyClick={scrollToMessage}
      />
      
    </Box>
  );
};

export default PrivateChatArea;