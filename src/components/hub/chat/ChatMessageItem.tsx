import React from 'react';
import { Box, Typography } from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ReplyIcon from '@mui/icons-material/Reply';
import UserAvatar from '../../UserAvatar';
import DOMPurify from 'dompurify';
import { ExtendedMessage, MessageStatus } from './types/message';

interface ChatMessageItemProps {
  message: ExtendedMessage;
  isFirstOfGroup: boolean;
  isTempMessage: boolean;
  isHighlighted: boolean;
  isUnread: boolean;
  isFocused: boolean;
  isSearchMode: boolean;
  searchQuery: string;
  currentUserId: number;
  hubId: number;
  onReply: (message: ExtendedMessage) => void;
  onEdit: (messageId: number) => void;
  onDelete: (messageId: number) => void;
  onReplyClick: (replyId: number) => void;
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>, message: ExtendedMessage) => void;
  onMouseLeave?: () => void;
}

const formatMessageTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

const ChatMessageItem = React.memo<ChatMessageItemProps>(({
  message,
  isFirstOfGroup,
  isTempMessage,
  isHighlighted,
  isUnread,
  isFocused,
  isSearchMode,
  searchQuery,
  currentUserId,
  hubId,
  onReplyClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <Box
      id={`message-${message.id}`}
      className="message-item"
      data-date={message.created_at}
      data-msg-id={message.id.toString()}
      onMouseEnter={(e) => !isTempMessage && onMouseEnter?.(e, message)}
      onMouseLeave={() => !isTempMessage && onMouseLeave?.()}
      sx={{
        display: 'flex',
        gap: 2,
        alignItems: 'flex-start',
        position: 'relative',
        borderRadius: '10px',
        transition: 'background-color 0.3s ease, box-shadow 0.5s ease',
        opacity: isTempMessage ? 0.6 : 1,
        backgroundColor: isFocused
          ? 'rgba(0, 207, 255, 0.25)' // Bright blue highlight for focused message (reply source)
          : isHighlighted
            ? 'rgba(33, 150, 243, 0.25)' // Bright blue highlight for search results
            : isUnread
              ? 'rgba(25,118,210,0.1)' // Blue for unread messages
              : 'transparent',
        '&.highlight-pulse': {
          animation: 'pulse 2s infinite',
        },
        '&:hover': {
          backgroundColor: isFocused
            ? 'rgba(0, 207, 255, 0.35)'
            : isHighlighted
              ? 'rgba(33, 150, 243, 0.35)'
              : isUnread 
                ? 'rgba(25,118,210,0.15)' 
                : 'rgba(255,255,255,0.05)',
        },
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'flex-start', 
          width: 40,
          ml: 1,
          mt: 1,
        }}
      >
        {isFirstOfGroup ? (
          <div
            style={{ cursor: 'pointer' }}
          >
            <UserAvatar 
              src={message.author.avatar || undefined} 
              alt={message.author.login} 
              userId={message.author.id}
              hubId={hubId}
            />
          </div>
        ) : null}
      </Box>
      <Box sx={{ flex: 1, position: 'relative' }}>
        <Box sx={{ maxWidth: '100%' }}>
          <Box sx={{ py: '5px', px: '0px', pl: 0 }}>
            {isFirstOfGroup && (
              <Typography sx={{ color: '#00CFFF', fontWeight: 700, mb: 0.5, fontSize: '1rem', letterSpacing: 0.2 }}>
                {message.author.login}
              </Typography>
            )}
            {message.reply && (
              <Box 
                sx={{ 
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  mb: 1,
                  cursor: 'pointer',
                  p: '4px 8px',
                  width: '100%',
                  ml: -1,
                  mr: -1,
                  borderRadius: 1,
                  backgroundColor: 'rgba(0, 207, 255, 0.05)',
                  borderLeft: '3px solid #00CFFF',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 207, 255, 0.1)'
                  }
                }}
                onClick={() => onReplyClick(message.reply!.id)}
              >
                <ReplyIcon sx={{ color: '#00CFFF', fontSize: '0.85rem', mt: '2px' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: '#00CFFF', fontWeight: 600, fontSize: '0.75rem', mb: 0.25 }}>
                    {message.reply.author.login}
                  </Typography>
                  <Typography 
                    sx={{ 
                      color: 'rgba(255,255,255,0.6)', 
                      fontSize: '0.75rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {message.reply.content}
                  </Typography>
                </Box>
              </Box>
            )}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              position: 'relative'
            }}>
              <Typography
                sx={{ 
                  color: 'rgba(255,255,255,0.85)', 
                  wordBreak: 'break-word', 
                  fontSize: '1.01rem',
                  whiteSpace: 'pre-wrap',
                  pr: '120px',
                  pl: 0,
                  lineHeight: 1.4
                }}
                component="span"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    (() => {
                      // Process content to highlight search terms
                      let content = message.content.replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
                      
                      // Highlight search terms if in search mode with non-empty query
                      if (isSearchMode && searchQuery.trim()) {
                        const query = searchQuery.trim();
                        // Escape special regex characters in the search query
                        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        // Create a regular expression that matches the whole word case-insensitive
                        const regex = new RegExp(`(${escapedQuery})`, 'gi');
                        // Replace with highlighted version
                        content = content.replace(regex, '<span style="background-color: rgba(0, 207, 255, 0.3); color: #fff; border-radius: 2px; padding: 0; font-weight: 600;">$1</span>');
                      }
                      
                      return content;
                    })()
                  )
                }}
              />
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                position: 'absolute',
                top: 0,
                right: 0,
                padding: '0 8px',
              }}>
                {message.last_modified_at && message.last_modified_at !== message.created_at && (
                  <span style={{ 
                    color: '#90caf9', 
                    fontSize: '0.85em', 
                    fontStyle: 'italic',
                    fontWeight: 500
                  }}>ред.</span>
                )}
                {message.author.id === currentUserId && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mr: 0.5
                    }}
                  >
                    <DoneAllIcon 
                      sx={{ 
                        fontSize: '1rem',
                        color: message.read_by_count && message.read_by_count > 0 ? '#FF69B4' : 'rgba(255,255,255,0.35)'
                      }} 
                    />
                  </Box>
                )}
                <Typography sx={{ 
                  color: 'rgba(255,255,255,0.35)', 
                  fontSize: '0.78rem', 
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}>
                  {formatMessageTime(message.created_at)}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

ChatMessageItem.displayName = 'ChatMessageItem';

export default ChatMessageItem;