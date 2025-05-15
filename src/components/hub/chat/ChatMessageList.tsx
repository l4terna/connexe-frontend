import React from 'react';
import { Box } from '@mui/material';
import { Message } from '../../../api/channels';
import ChatMessage from './ChatMessage';

interface ChatMessageListProps {
  messages: Message[];
  tempMessages: Map<string, Message>;
  editingMessageId: number | null;
  editInputRef: React.RefObject<HTMLInputElement>;
  handleEditMessage: any;
  messageSchema: any;
  onAvatarClick: (userId: number, event: React.MouseEvent<HTMLElement>) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

const isWithinTimeThreshold = (timestamp1: string, timestamp2: string, thresholdMinutes: number = 30) => {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  const diffInMinutes = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
  return diffInMinutes <= thresholdMinutes;
};

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  tempMessages,
  editingMessageId,
  editInputRef,
  handleEditMessage,
  messageSchema,
  onAvatarClick,
  onEdit,
  onDelete
}) => {
  let prevAuthorId: number | null = null;
  let prevMessageTime: string | null = null;

  // Combine real and temporary messages
  const allMessages = [...messages, ...Array.from(tempMessages.values())].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {allMessages.map((msg, idx) => {
        const isFirstOfGroup = prevAuthorId !== msg.author.id || 
          (prevMessageTime && !isWithinTimeThreshold(prevMessageTime, msg.created_at));
        const isTempMessage = msg.id === -1;
        prevAuthorId = msg.author.id;
        prevMessageTime = msg.created_at;
        return (
          <ChatMessage
            key={isTempMessage ? `temp-${msg.created_at}` : msg.id}
            msg={msg}
            isFirstOfGroup={!!isFirstOfGroup}
            isTempMessage={isTempMessage}
            onAvatarClick={onAvatarClick}
            onEdit={onEdit}
            onDelete={onDelete}
            editingMessageId={editingMessageId}
            editInputRef={editInputRef}
            handleEditMessage={handleEditMessage}
            messageSchema={messageSchema}
          />
        );
      })}
    </Box>
  );
};

export default ChatMessageList; 