import React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ReplyIcon from '@mui/icons-material/Reply';
import UserAvatar from '../../UserAvatar';
import DOMPurify from 'dompurify';

enum MessageStatus {
  SENT = 0,
  READ = 1,
  NEW = 2
}

interface Message {
  id: number;
  content: string;
  author: {
    id: number;
    login: string;
    avatar: string | null;
  };
  created_at: string;
  last_modified_at?: string;
  attachments: any[];
  read_by_count?: number;
  reply?: Message;
}

interface ExtendedMessage extends Message {
  status: MessageStatus;
  channel_id?: number;
}

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
  onReply,
  onEdit,
  onDelete,
  onReplyClick,
}) => {
  return (
    <Box
      id={`message-${message.id}`}
      className="message-item"
      data-date={message.created_at}
      data-msg-id={message.id.toString()}
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
        '&:hover .message-actions': {
          opacity: isTempMessage ? 0 : 1,
          pointerEvents: isTempMessage ? 'none' : 'auto',
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
        {!isTempMessage && (
          <Box
            className="message-actions"
            sx={{
              position: 'absolute',
              top: -38,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 1,
              opacity: 0,
              pointerEvents: 'none',
              transition: 'opacity 0.2s',
              zIndex: 10,
              background: 'rgba(20,20,35,0.85)',
              borderRadius: 2,
              boxShadow: '0 8px 24px 0 rgba(0,0,0,0.3), 0 0 12px 0 rgba(149,128,255,0.2)',
              px: 1.5,
              py: 0.5,
              border: '1px solid rgba(149,128,255,0.25)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Tooltip title="Ответить" enterDelay={1000} placement="top">
              <IconButton 
                size="small" 
                onClick={() => onReply(message)} 
                sx={{ 
                  color: '#00FFBA', 
                  transition: 'all 0.2s ease',
                  padding: '6px',
                  backgroundColor: 'rgba(0, 255, 186, 0.12)',
                  '&:hover': { 
                    color: '#00FFBA',
                    backgroundColor: 'rgba(0, 255, 186, 0.25)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 8px rgba(0, 255, 186, 0.3)'
                  } 
                }}
              >
                <ReplyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            {/* Edit button only for user's own messages */}
            {message.author.id === currentUserId && (
              <Tooltip title="Редактировать" enterDelay={1000} placement="top">
                <IconButton 
                  size="small" 
                  onClick={() => onEdit(message.id)} 
                  sx={{ 
                    color: '#00CFFF', 
                    transition: 'all 0.2s ease',
                    padding: '6px',
                    backgroundColor: 'rgba(0, 207, 255, 0.12)',
                    '&:hover': { 
                      color: '#00CFFF',
                      backgroundColor: 'rgba(0, 207, 255, 0.25)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 8px rgba(0, 207, 255, 0.3)'
                    } 
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            {/* Delete button for all messages */}
            <Tooltip title="Удалить" enterDelay={1000} placement="top">
              <IconButton 
                size="small" 
                onClick={() => onDelete(message.id)} 
                sx={{ 
                  color: '#FF3D71', 
                  transition: 'all 0.2s ease',
                  padding: '6px',
                  backgroundColor: 'rgba(255, 61, 113, 0.12)',
                  '&:hover': { 
                    color: '#FF3D71',
                    backgroundColor: 'rgba(255, 61, 113, 0.25)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 8px rgba(255, 61, 113, 0.3)'
                  } 
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
});

ChatMessageItem.displayName = 'ChatMessageItem';

export default ChatMessageItem;