import React from 'react';
import MessageActionsPortal from './MessageActionsPortal';
import { ExtendedMessage } from '../types/message';

interface MessageActionsWrapperProps {
  hoveredMessage: {
    element: HTMLElement;
    message: ExtendedMessage;
  } | null;
  userId: number;
  isHoveringPortal: React.MutableRefObject<boolean>;
  hoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setHoveredMessage: React.Dispatch<React.SetStateAction<{
    element: HTMLElement;
    message: ExtendedMessage;
  } | null>>;
  setReplyingToMessage: React.Dispatch<React.SetStateAction<ExtendedMessage | null>>;
  setEditingMessageId: React.Dispatch<React.SetStateAction<number | null>>;
  handleDeleteMessage: (messageId: number) => void;
}

/**
 * Component that wraps MessageActionsPortal with all necessary handlers
 */
const MessageActionsWrapper: React.FC<MessageActionsWrapperProps> = ({
  hoveredMessage,
  userId,
  isHoveringPortal,
  hoverTimeoutRef,
  setHoveredMessage,
  setReplyingToMessage,
  setEditingMessageId,
  handleDeleteMessage,
}) => {
  if (!hoveredMessage) return null;

  return (
    <MessageActionsPortal
      targetElement={hoveredMessage.element}
      messageId={hoveredMessage.message.id}
      authorId={hoveredMessage.message.author.id}
      currentUserId={userId}
      onReply={() => {
        setReplyingToMessage(hoveredMessage.message);
        setHoveredMessage(null);
      }}
      onEdit={() => {
        setEditingMessageId(hoveredMessage.message.id);
        setHoveredMessage(null);
      }}
      onDelete={() => {
        handleDeleteMessage(hoveredMessage.message.id);
        setHoveredMessage(null);
      }}
      onClose={() => setHoveredMessage(null)}
      onPortalMouseEnter={() => {
        isHoveringPortal.current = true;
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
      }}
      onPortalMouseLeave={() => {
        isHoveringPortal.current = false;
        hoverTimeoutRef.current = setTimeout(() => {
          setHoveredMessage(null);
        }, 100);
      }}
    />
  );
};

export default MessageActionsWrapper;
