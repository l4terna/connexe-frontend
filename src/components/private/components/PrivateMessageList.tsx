import React from 'react';
import MessageList from '../../hub/chat/components/MessageList';
import { Channel } from '../../../api/channels';
import { ExtendedMessage } from '../../hub/chat/types/message';

interface User {
  id: number;
  login: string;
  avatar: string | null;
}

interface PrivateMessageListProps {
  activeChannel: Channel;
  messages: ExtendedMessage[];
  tempMessages: Map<string, ExtendedMessage>;
  searchMode: boolean;
  searchQuery: string;
  highlightedMessages: Set<number>;
  focusedMessageId: number | null;
  unreadMessages: Set<number>;
  isLoadingMore: boolean;
  isLoadingAround: boolean;
  editingMessageId: number | null;
  user: User;
  otherUser?: User;
  paginationState: any;
  messagesPerPage: number;
  showDateLabel: boolean;
  currentDateLabel: string | null;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  editInputRef: React.RefObject<HTMLInputElement>;
  highlightTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  scrollToMessageIdRef: React.MutableRefObject<number | null>;
  setHighlightedMessages: React.Dispatch<React.SetStateAction<Set<number>>>;
  setFocusedMessageId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingMessageId: React.Dispatch<React.SetStateAction<number | null>>;
  setMessages: React.Dispatch<React.SetStateAction<ExtendedMessage[]>>;
  setTempMessages: React.Dispatch<React.SetStateAction<Map<string, ExtendedMessage>>>;
  setReplyingToMessage: React.Dispatch<React.SetStateAction<ExtendedMessage | null>>;
  setTargetMessageId: React.Dispatch<React.SetStateAction<number | null>>;
  paginationActions: any;
  handleEditMessage: (values: { content: string }, { resetForm }: { resetForm: () => void }) => Promise<void>;
  handleDeleteMessage: (messageId: number) => void;
  scrollCorrectionRef: React.MutableRefObject<any>;
  forceScrollToMessageId: number | null;
}

const PrivateMessageList: React.FC<PrivateMessageListProps> = (props) => {
  // For private chats, we can reuse the existing MessageList component
  // We don't pass hubId for private chats
  const { otherUser, ...messageListProps } = props;
  return (
    <MessageList
      {...messageListProps}
      // Don't pass hubId - let it be undefined for private chats
    />
  );
};

export default PrivateMessageList;