import { useState, useCallback } from 'react';
import { Message } from '@/api/channels';
import { ExtendedMessage, MessageStatus } from '../types/message';

export const useMessageState = () => {
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [tempMessages, setTempMessages] = useState<Map<string, ExtendedMessage>>(new Map());
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [newMessagesCount, setNewMessagesCount] = useState<number>(0);
  
  const convertToExtendedMessage = useCallback((message: Message): ExtendedMessage => {
    return {
      ...message,
      status: 'status' in message ? (message as any).status : MessageStatus.SENT,
      reply: message.reply ? {
        ...message.reply,
        status: 'status' in message.reply ? (message.reply as any).status : MessageStatus.SENT
      } : null
    };
  }, []);

  const resetMessageStates = useCallback(() => {
    setMessages([]);
    setTempMessages(new Map());
    setUnreadMessages(new Set());
    setUnreadCount(0);
    setNewMessagesCount(0);
  }, []);

  const updateMessageReadStatus = useCallback((messageId: number, userId: number) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId && msg.author.id !== userId
        ? { ...msg, status: MessageStatus.READ }
        : msg
    ));
  }, []);

  const markAllMessagesAsReadInState = useCallback((userId: number) => {
    setMessages(prev => prev.map(msg => (
      msg.author.id !== userId 
        ? { ...msg, status: MessageStatus.READ }
        : msg
    )));
    setUnreadMessages(new Set());
    setUnreadCount(0);
    setNewMessagesCount(0);
  }, []);

  const updateMessageReadByCount = useCallback((range: { from: number; to: number }, userId: number) => {
    setMessages(prevMessages => {
      return prevMessages.map(msg => {
        if (msg.id >= range.from && msg.id <= range.to && msg.author.id === userId) {
          const currentCount = msg.read_by_count || 0;
          return {
            ...msg,
            read_by_count: currentCount + 1
          };
        }
        return msg;
      });
    });
  }, []);

  const deleteMessageFromState = useCallback((messageId: number) => {
    setMessages(prevMessages => {
      const messageExists = prevMessages.some(msg => msg.id === messageId);
      if (!messageExists) return prevMessages;

      const filtered = prevMessages.filter(msg => msg.id !== messageId);
      
      return filtered.map(msg => {
        if (msg.reply && msg.reply.id === messageId) {
          return { ...msg, reply: undefined };
        }
        return msg;
      });
    });
  }, []);

  const updateMessageInState = useCallback((updatedMessage: ExtendedMessage) => {
    setMessages(prevMessages => {
      const messageExists = prevMessages.some(msg => msg.id === updatedMessage.id);
      if (!messageExists) return prevMessages;

      return prevMessages.map(msg => 
        msg.id === updatedMessage.id ? updatedMessage : msg
      );
    });
  }, []);

  const addMessageToState = useCallback((newMessage: ExtendedMessage) => {
    setMessages(prevMessages => {
      const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
      if (messageExists) return prevMessages;
      
      return [...prevMessages, newMessage];
    });
  }, []);

  const addUnreadMessage = useCallback((messageId: number) => {
    setUnreadMessages(prev => {
      const newSet = new Set(prev);
      newSet.add(messageId);
      return newSet;
    });
    setUnreadCount(prev => prev + 1);
    setNewMessagesCount(prev => prev + 1);
  }, []);

  const removeUnreadMessage = useCallback((messageId: number) => {
    setUnreadMessages(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
    setUnreadCount(prev => Math.max(0, prev - 1));
    setNewMessagesCount(prev => Math.max(0, prev - 1));
  }, []);

  const updateUnreadCount = useCallback((change: number) => {
    setUnreadCount(prev => Math.max(0, prev + change));
    setNewMessagesCount(prev => Math.max(0, prev + change));
  }, []);

  const resetUnreadCounts = useCallback(() => {
    setUnreadCount(0);
    setNewMessagesCount(0);
  }, []);

  return {
    // State
    messages,
    setMessages,
    tempMessages,
    setTempMessages,
    unreadMessages,
    setUnreadMessages,
    unreadCount,
    setUnreadCount,
    newMessagesCount,
    setNewMessagesCount,
    
    // Functions
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
  };
};