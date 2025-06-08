import { useState, useRef, useCallback } from 'react';
import { ExtendedMessage, MessageStatus } from '../types/message';

interface QueuedMessage {
  id: string;
  content: string;
  images?: File[];
  replyMessage?: ExtendedMessage | null;
  tempMessage: ExtendedMessage;
  resetForm: () => void;
}

interface MessageQueueOptions {
  onSendMessage: (values: { content: string; images?: File[] }, replyMessage?: ExtendedMessage | null) => Promise<any>;
  onAddTempMessage: (tempId: string, tempMessage: ExtendedMessage) => void;
  onRemoveTempMessage: (tempId: string) => void;
  onUpdateTempMessage: (tempId: string, status: 'sending' | 'error') => void;
  activeChannel: { id: number } | null;
  user: { id: number; login: string; avatar: string | null } | null;
}

export const useMessageQueue = ({
  onSendMessage,
  onAddTempMessage,
  onRemoveTempMessage,
  onUpdateTempMessage,
  activeChannel,
  user
}: MessageQueueOptions) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const queueRef = useRef<QueuedMessage[]>([]);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processQueue = useCallback(async () => {
    if (isProcessing || queueRef.current.length === 0) return;
    
    setIsProcessing(true);
    
    while (queueRef.current.length > 0) {
      const queuedMessage = queueRef.current.shift();
      if (!queuedMessage) break;
      
      try {
        // Обновляем статус временного сообщения на "отправляется"
        onUpdateTempMessage(queuedMessage.id, 'sending');
        
        // Отправляем сообщение
        await onSendMessage(
          {
            content: queuedMessage.content,
            images: queuedMessage.images
          },
          queuedMessage.replyMessage
        );
        
        // Удаляем временное сообщение после успешной отправки
        onRemoveTempMessage(queuedMessage.id);
        
      } catch (error) {
        console.error('Failed to send queued message:', error);
        
        // Обновляем статус на ошибку
        onUpdateTempMessage(queuedMessage.id, 'error');
        
        // Можно добавить логику для повторной попытки или удаления
        // Пока просто удаляем сообщение с ошибкой через некоторое время
        setTimeout(() => {
          onRemoveTempMessage(queuedMessage.id);
        }, 3000);
      }
      
      // Небольшая задержка между отправками для предотвращения спама
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    setIsProcessing(false);
  }, [isProcessing, onSendMessage, onUpdateTempMessage, onRemoveTempMessage]);

  const queueMessage = useCallback((values: { content: string; images?: File[] }, { resetForm }: { resetForm: () => void }, replyMessage?: ExtendedMessage | null) => {
    if (!activeChannel || !user) return;

    const content = values.content.trim();
    const hasImages = values.images && values.images.length > 0;
    
    // Require either content or images
    if (!content && !hasImages) return;

    // Clear the input field immediately
    resetForm();
    
    // Создаем уникальный ID для временного сообщения
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    
    // Создаем временное сообщение
    const tempMessage: ExtendedMessage = {
      id: -1, // Temporary ID
      content: values.content,
      author: user,
      created_at: new Date().toISOString(),
      last_modified_at: undefined,
      attachments: [], // Required by Message interface
      status: MessageStatus.SENT,
      read_by_count: 0,
      channel_id: activeChannel.id,
      reply: replyMessage || undefined
    };
    
    // Добавляем временное сообщение в UI
    onAddTempMessage(tempId, tempMessage);
    
    // Добавляем сообщение в очередь
    const queuedMessage: QueuedMessage = {
      id: tempId,
      content: values.content,
      images: values.images,
      replyMessage,
      tempMessage,
      resetForm
    };
    
    queueRef.current.push(queuedMessage);
    
    // Очищаем предыдущий таймаут и устанавливаем новый с дебаунсом
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    processingTimeoutRef.current = setTimeout(() => {
      processQueue();
    }, 300); // 300ms дебаунс
    
  }, [activeChannel, user, onAddTempMessage, processQueue]);

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setIsProcessing(false);
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  return {
    queueMessage,
    clearQueue,
    isProcessing,
    queueLength: queueRef.current.length
  };
};