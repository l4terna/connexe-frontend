import React from 'react';
import MessageInput from './MessageInput';
import { ExtendedMessage } from '../types/message';
import { Channel } from '../../../../api/channels';

interface ChatFooterProps {
  activeChannel: Channel | null;
  canSendMessages: boolean;
  sending: boolean;
  replyingToMessage: ExtendedMessage | null;
  onSendMessage: (values: { content: string }, helpers: { resetForm: () => void }) => Promise<void>;
  onReplyCancel: () => void;
  onReplyClick: (messageId: number) => void;
}

/**
 * ChatFooter component displays the message input area and handles message actions
 */
const ChatFooter: React.FC<ChatFooterProps> = ({
  activeChannel,
  canSendMessages,
  sending,
  replyingToMessage,
  onSendMessage,
  onReplyCancel,
  onReplyClick,
}) => {
  return (
    <MessageInput
      activeChannel={activeChannel}
      canSendMessages={canSendMessages}
      sending={sending}
      replyingToMessage={replyingToMessage}
      onSendMessage={onSendMessage}
      onReplyCancel={onReplyCancel}
      onReplyClick={onReplyClick}
    />
  );
};

export default ChatFooter;
