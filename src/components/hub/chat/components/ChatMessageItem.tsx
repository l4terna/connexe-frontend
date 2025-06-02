import React, { useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ReplyIcon from '@mui/icons-material/Reply';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import UserAvatar from '../../../UserAvatar';
import DOMPurify from 'dompurify';
import { ExtendedMessage, ReplyMessage } from '../types/message';
import SignedMediaImage from './SignedMediaImage';
import MessageImagePreviewModal from './MessageImagePreviewModal';

export interface ChatMessageItemProps {
  message: ExtendedMessage;
  // Support both naming conventions for backward compatibility
  isFirstInGroup?: boolean;
  isFirstOfGroup?: boolean;
  isLastInGroup?: boolean;
  // Original props
  isTempMessage?: boolean;
  isHighlighted?: boolean;
  isUnread?: boolean;
  isFocused?: boolean;
  isSearchMode?: boolean;
  searchQuery?: string;
  currentUserId: number;
  hubId?: number;
  signedUrls?: Map<string, string>;
  loadingMode?: 'initial' | 'pagination' | 'around' | null;
  // Callback handlers
  onReply?: (message: ExtendedMessage) => void;
  onEdit?: (message: ExtendedMessage | number) => void;
  onDelete?: (message: ExtendedMessage | number) => void;
  onReplyClick?: (replyId: number) => void;
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>, message?: ExtendedMessage) => void;
  onMouseLeave?: (event?: React.MouseEvent<HTMLDivElement>) => void;
}

const formatMessageTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

const formatReplyContent = (message: ReplyMessage | ExtendedMessage) => {
  // If there's text content, return it
  if (message.content && message.content.trim()) {
    return message.content;
  }
  
  // If no text but has attachments, show attachment count
  const attachmentCount = 'attachments_count' in message 
    ? message.attachments_count 
    : (message.attachments?.length || 0);

  if (attachmentCount > 0) {
    // For now we assume all attachments are images, but this can be extended
    // to support different types of attachments in the future
    if (attachmentCount === 1) {
      return '📎 Вложение';
    } else if (attachmentCount >= 2 && attachmentCount <= 4) {
      return `📎 ${attachmentCount} вложения`;
    } else {
      return `📎 ${attachmentCount} вложений`;
    }
  }
  
  // Fallback for empty message - show as attachment since there's no content
  return '📎 Вложение';
};

export const ChatMessageItem = React.memo<ChatMessageItemProps>((props) => {
  const { 
    message, 
    // Support both naming conventions
    isFirstInGroup = props.isFirstOfGroup || false,
    // Original props
    isTempMessage = false,
    isHighlighted = false,
    isUnread = false,
    isFocused = false,
    isSearchMode = false,
    searchQuery = '',
    currentUserId,
    hubId = 0,
    loadingMode = null,
    // Callback handlers
    onReply,
    onEdit,
    onDelete,
    onReplyClick,
    onMouseEnter,
    onMouseLeave
  } = props;

  const [isHovered, setIsHovered] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Check if message has image attachments
  const hasAttachments = message.attachments && message.attachments.length > 0;

  
  // Handle image preview click
  const handleImageClick = (storageKey: string, index: number) => {
    setViewingImage(storageKey);
    setCurrentImageIndex(index);
  };
  

  // Support different callback patterns
  const handleReplyClick = () => {
    if (message.reply && onReplyClick) {
      onReplyClick(message.reply.id);
    }
  };

  const handleReplyToClick = () => {
    if (message && onReply) {
      onReply(message); // Reply to this message, not the reply message
    }
  };

  const handleEditClick = () => {
    if (onEdit) {
      // Support both new and old callback patterns
      if (typeof onEdit === 'function') {
        onEdit(message.id);
      }
    }
  };

  const handleDeleteClick = () => {
    if (onDelete) {
      // Support both new and old callback patterns
      if (typeof onDelete === 'function') {
        onDelete(message.id);
      }
    }
  };

  return (
    <>
      <Box
        id={`message-${message.id}`}
        className="message-item"
        data-date={message.created_at}
        data-msg-id={message.id.toString()}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          setIsHovered(true);
          if (onMouseEnter) onMouseEnter(e, message);
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          setIsHovered(false);
          if (onMouseLeave) onMouseLeave(e);
        }}
        sx={{
          contentVisibility: 'auto',
          containIntrinsicSize: '0 80px',
          contain: 'layout style paint',
          display: 'flex',
          gap: 2,
          alignItems: 'flex-start',
          position: 'relative',
          borderRadius: '10px',
          willChange: 'auto',   
          transition: 'background-color 0.3s ease, box-shadow 0.5s ease',
          opacity: isTempMessage ? 0.6 : 1,
          mt: isFirstInGroup ? 3 : 0.5,
          px: 1.5,
          py: 0.5,
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
        {/* Message Actions - positioned relative to the entire message */}
        {isHovered && (
          <Box
            sx={{
              position: 'absolute',
              top: -40,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 0.5,
              zIndex: 1000,
              padding: '6px 8px',
              borderRadius: '20px',
              background: 'rgba(40, 44, 52, 0.85)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
              opacity: 1,
              animation: 'fadeIn 0.2s ease-in-out',
              '@keyframes fadeIn': {
                from: { opacity: 0, transform: 'translateX(-50%) translateY(5px)' },
                to: { opacity: 1, transform: 'translateX(-50%) translateY(0)' }
              }
            }}
          >
            <Tooltip title="Ответить" enterDelay={1000} placement="top">
              <IconButton 
                size="small" 
                onClick={handleReplyToClick}
                sx={{ 
                  color: '#00CFFF', 
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    color: '#E5FBFF',
                    transform: 'scale(1.1)',
                  }
                }}
              >
                <ReplyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            {message.author.id === currentUserId && (
              <>
                <Tooltip title="Редактировать" enterDelay={1000} placement="top">
                  <IconButton 
                    size="small" 
                    onClick={handleEditClick}
                    sx={{ 
                      color: '#00CFFF', 
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        color: '#E5FBFF',
                        transform: 'scale(1.1)',
                      }
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Удалить" enterDelay={1000} placement="top">
                  <IconButton 
                    size="small" 
                    onClick={handleDeleteClick}
                    sx={{ 
                      color: '#FF3D71', 
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        color: '#FF708D',
                        transform: 'scale(1.1)',
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        )}
        
        {/* Avatar column */}
        <Box
          sx={{
            width: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mt: 1,
          }}
        >
          {isFirstInGroup ? (
            <div style={{ cursor: 'pointer' }}>
              <UserAvatar 
                src={message.author.avatar || undefined} 
                alt={message.author.login} 
                userId={message.author.id}
                hubId={hubId}
              />
            </div>
          ) : null}
        </Box>
        
        {/* Message content */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <Box sx={{ maxWidth: '99%' }}>
            <Box sx={{ py: '5px', px: '0px', pl: 0 }}>
              {isFirstInGroup && (
                <Typography sx={{ color: '#00CFFF', fontWeight: 700, mb: 0.5, fontSize: '1rem', letterSpacing: 0.2 }}>
                  {message.author.login}
                </Typography>
              )}
              
              {/* Reply reference */}
              {message.reply && (
                <Box
                  sx={{
                    mb: 0.8,
                    mt: 0.25,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      ml: 0,
                      background: 'rgba(0, 207, 255, 0.06)',
                      borderLeft: '3px solid #00CFFF',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: 'rgba(0, 207, 255, 0.1)',
                        transform: 'translateX(2px)',
                      }
                    }}
                    onClick={handleReplyClick}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ 
                        color: '#00CFFF', 
                        fontSize: '0.75rem', 
                        fontWeight: '600',
                        letterSpacing: 0.3
                      }}>
                        {message.reply.author.login}
                      </Typography>
                    </Box>
                    <Typography sx={{ 
                      color: 'rgba(255,255,255,0.6)', 
                      fontSize: '0.8rem', 
                      mt: 0.2, 
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '400px'
                    }}>
                      {formatReplyContent(message.reply)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
          
          {/* Modern Image Gallery */}
          {hasAttachments && (
            <Box sx={{ mt: 1.5, mb: 1 }}>
              {(() => {
                const count = message.attachments?.length || 0;
                
                // Single image - large display
                if (count === 1) {
                  return (
                    <Box 
                      sx={{
                        position: 'relative',
                        borderRadius: 3,
                        overflow: 'hidden',
                        maxWidth: '450px',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                          border: '1px solid rgba(0, 207, 255, 0.3)',
                          '& .zoom-overlay': { opacity: 1 },
                          '& .attachment-image': { transform: 'scale(1.03)' }
                        }
                      }}
                      onClick={() => handleImageClick(message.attachments[0], 0)}
                    >
                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          paddingTop: '75%', // 4:3 aspect ratio
                          '& > *': {
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                          }
                        }}
                      >
                        <SignedMediaImage
                          storageKey={message.attachments[0]}
                          className="attachment-image"
                          alt="Attachment"
                          loadingMode={loadingMode}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />
                        <Box
                          className="zoom-overlay"
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                            backdropFilter: 'blur(3px)',
                          }}
                        >
                          <ZoomInIcon sx={{ 
                            color: 'white', 
                            fontSize: '36px',
                            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))'
                          }} />
                        </Box>
                      </Box>
                    </Box>
                  );
                }
                
                // Two images - side by side
                if (count === 2) {
                  return (
                    <Box sx={{ display: 'flex', gap: 1, maxWidth: '450px' }}>
                      {message.attachments.map((attachment: string, index: number) => (
                        <Box 
                          key={index}
                          sx={{
                            position: 'relative',
                            borderRadius: 2.5,
                            overflow: 'hidden',
                            flex: 1,
                            height: '200px',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 6px 24px rgba(0,0,0,0.1)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            '&:hover': {
                              transform: 'translateY(-2px) scale(1.02)',
                              boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
                              border: '1px solid rgba(0, 207, 255, 0.3)',
                              zIndex: 2,
                              '& .zoom-overlay': { opacity: 1 },
                              '& .attachment-image': { transform: 'scale(1.05)' }
                            }
                          }}
                          onClick={() => handleImageClick(attachment, index)}
                        >
                          <SignedMediaImage loadingMode={loadingMode}
                            storageKey={attachment}
                            className="attachment-image"
                            alt="Attachment"
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          />
                          <Box
                            className="zoom-overlay"
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: 0,
                              transition: 'opacity 0.3s ease',
                              backdropFilter: 'blur(2px)',
                            }}
                          >
                            <ZoomInIcon sx={{ 
                              color: 'white', 
                              fontSize: '28px',
                              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))'
                            }} />
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: 'rgba(0,0,0,0.75)',
                              color: 'white',
                              borderRadius: '12px',
                              px: 1.5,
                              py: 0.5,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backdropFilter: 'blur(6px)',
                              border: '1px solid rgba(255,255,255,0.15)',
                            }}
                          >
                            {index + 1}/{count}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  );
                }
                
                // Three images - one large + two small
                if (count === 3) {
                  return (
                    <Box sx={{ display: 'flex', gap: 1, maxWidth: '450px', height: '280px' }}>
                      {/* First large image */}
                      <Box 
                        sx={{
                          position: 'relative',
                          borderRadius: 2.5,
                          overflow: 'hidden',
                          flex: 2,
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 6px 24px rgba(0,0,0,0.1)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          '&:hover': {
                            transform: 'scale(1.02)',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(0, 207, 255, 0.3)',
                            zIndex: 2,
                            '& .zoom-overlay': { opacity: 1 },
                            '& .attachment-image': { transform: 'scale(1.05)' }
                          }
                        }}
                        onClick={() => handleImageClick(message.attachments[0], 0)}
                      >
                        <SignedMediaImage loadingMode={loadingMode}
                          storageKey={message.attachments[0]}
                          className="attachment-image"
                          alt="Attachment"
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />
                        <Box
                          className="zoom-overlay"
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                            backdropFilter: 'blur(2px)',
                          }}
                        >
                          <ZoomInIcon sx={{ 
                            color: 'white', 
                            fontSize: '32px',
                            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))'
                          }} />
                        </Box>
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: 'rgba(0,0,0,0.75)',
                            color: 'white',
                            borderRadius: '12px',
                            px: 1.5,
                            py: 0.5,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backdropFilter: 'blur(6px)',
                            border: '1px solid rgba(255,255,255,0.15)',
                          }}
                        >
                          1/{count}
                        </Box>
                      </Box>
                      {/* Two smaller images */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                        {message.attachments.slice(1, 3).map((attachment: string, index: number) => (
                          <Box 
                            key={index + 1}
                            sx={{
                              position: 'relative',
                              borderRadius: 2,
                              overflow: 'hidden',
                              flex: 1,
                              cursor: 'pointer',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              '&:hover': {
                                transform: 'scale(1.03)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                border: '1px solid rgba(0, 207, 255, 0.3)',
                                zIndex: 2,
                                '& .zoom-overlay': { opacity: 1 },
                                '& .attachment-image': { transform: 'scale(1.08)' }
                              }
                            }}
                            onClick={() => handleImageClick(attachment, index + 1)}
                          >
                            <SignedMediaImage loadingMode={loadingMode}
                              storageKey={attachment}
                              className="attachment-image"
                              alt="Attachment"
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                            />
                            <Box
                              className="zoom-overlay"
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0,
                                transition: 'opacity 0.3s ease',
                                backdropFilter: 'blur(2px)',
                              }}
                            >
                              <ZoomInIcon sx={{ 
                                color: 'white', 
                                fontSize: '24px',
                                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))'
                              }} />
                            </Box>
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                backgroundColor: 'rgba(0,0,0,0.75)',
                                color: 'white',
                                borderRadius: '10px',
                                px: 1,
                                py: 0.25,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                backdropFilter: 'blur(6px)',
                                border: '1px solid rgba(255,255,255,0.15)',
                              }}
                            >
                              {index + 2}/{count}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  );
                }
                
                // Four images - 2x2 grid
                if (count === 4) {
                  return (
                    <Box sx={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 1,
                      maxWidth: '400px',
                      aspectRatio: '1',
                    }}>
                      {message.attachments.map((attachment: string, index: number) => (
                        <Box 
                          key={index}
                          sx={{
                            position: 'relative',
                            borderRadius: 2,
                            overflow: 'hidden',
                            aspectRatio: '1',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            '&:hover': {
                              transform: 'scale(1.05)',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                              border: '1px solid rgba(0, 207, 255, 0.3)',
                              zIndex: 2,
                              '& .zoom-overlay': { opacity: 1 },
                              '& .attachment-image': { transform: 'scale(1.08)' }
                            }
                          }}
                          onClick={() => handleImageClick(attachment, index)}
                        >
                          <SignedMediaImage loadingMode={loadingMode}
                            storageKey={attachment}
                            className="attachment-image"
                            alt="Attachment"
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          />
                          <Box
                            className="zoom-overlay"
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: 0,
                              transition: 'opacity 0.3s ease',
                              backdropFilter: 'blur(2px)',
                            }}
                          >
                            <ZoomInIcon sx={{ 
                              color: 'white', 
                              fontSize: '28px',
                              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))'
                            }} />
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              backgroundColor: 'rgba(0,0,0,0.75)',
                              color: 'white',
                              borderRadius: '10px',
                              px: 1,
                              py: 0.25,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              backdropFilter: 'blur(6px)',
                              border: '1px solid rgba(255,255,255,0.15)',
                            }}
                          >
                            {index + 1}/{count}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  );
                }
                
                // Five or more images - special layout with overlay
                if (count >= 5) {
                  return (
                    <Box sx={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 1,
                      maxWidth: '450px',
                      aspectRatio: '3/2',
                    }}>
                      {/* First large image spanning 2 columns */}
                      <Box 
                        sx={{
                          position: 'relative',
                          borderRadius: 2.5,
                          overflow: 'hidden',
                          gridColumn: 'span 2',
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 6px 24px rgba(0,0,0,0.1)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          '&:hover': {
                            transform: 'scale(1.02)',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(0, 207, 255, 0.3)',
                            zIndex: 2,
                            '& .zoom-overlay': { opacity: 1 },
                            '& .attachment-image': { transform: 'scale(1.05)' }
                          }
                        }}
                        onClick={() => handleImageClick(message.attachments[0], 0)}
                      >
                        <SignedMediaImage loadingMode={loadingMode}
                          storageKey={message.attachments[0]}
                          className="attachment-image"
                          alt="Attachment"
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />
                        <Box
                          className="zoom-overlay"
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                            backdropFilter: 'blur(2px)',
                          }}
                        >
                          <ZoomInIcon sx={{ 
                            color: 'white', 
                            fontSize: '32px',
                            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))'
                          }} />
                        </Box>
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: 'rgba(0,0,0,0.75)',
                            color: 'white',
                            borderRadius: '12px',
                            px: 1.5,
                            py: 0.5,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backdropFilter: 'blur(6px)',
                            border: '1px solid rgba(255,255,255,0.15)',
                          }}
                        >
                          1/{count}
                        </Box>
                      </Box>
                      
                      {/* Remaining images in right column */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {message.attachments.slice(1, 3).map((attachment: string, index: number) => (
                          <Box 
                            key={index + 1}
                            sx={{
                              position: 'relative',
                              borderRadius: 2,
                              overflow: 'hidden',
                              flex: 1,
                              cursor: 'pointer',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              '&:hover': {
                                transform: 'scale(1.05)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                border: '1px solid rgba(0, 207, 255, 0.3)',
                                zIndex: 2,
                                '& .zoom-overlay': { opacity: 1 },
                                '& .attachment-image': { transform: 'scale(1.08)' }
                              }
                            }}
                            onClick={() => handleImageClick(attachment, index + 1)}
                          >
                            <SignedMediaImage loadingMode={loadingMode}
                              storageKey={attachment}
                              className="attachment-image"
                              alt="Attachment"
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                            />
                            <Box
                              className="zoom-overlay"
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0,
                                transition: 'opacity 0.3s ease',
                                backdropFilter: 'blur(2px)',
                              }}
                            >
                              {/* Show "+N more" overlay on the last visible image */}
                              {index === 1 && count > 3 ? (
                                <Box sx={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 0.5
                                }}>
                                  <Typography sx={{
                                    color: 'white',
                                    fontSize: '1.2rem',
                                    fontWeight: 700,
                                    textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                                  }}>
                                    +{count - 3}
                                  </Typography>
                                  <Typography sx={{
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                                    opacity: 0.9
                                  }}>
                                    ещё
                                  </Typography>
                                </Box>
                              ) : (
                                <ZoomInIcon sx={{ 
                                  color: 'white', 
                                  fontSize: '20px',
                                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))'
                                }} />
                              )}
                            </Box>
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                backgroundColor: 'rgba(0,0,0,0.75)',
                                color: 'white',
                                borderRadius: '10px',
                                px: 1,
                                py: 0.25,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                backdropFilter: 'blur(6px)',
                                border: '1px solid rgba(255,255,255,0.15)',
                              }}
                            >
                              {index + 2}/{count}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  );
                }
                
                return null;
              })()
              }
            </Box>
          )}
          
          {/* Message content */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            position: 'relative'
          }}>
            {message.content && (
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
            )}
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
      
      {/* Image Lightbox Modal */}
      {/* Full-screen image modal */}
      <MessageImagePreviewModal
        open={!!viewingImage}
        images={message.attachments || []}
        currentIndex={currentImageIndex}
        onClose={() => setViewingImage(null)}
        onNavigate={(index) => {
          setCurrentImageIndex(index);
          setViewingImage(message.attachments[index]);
        }}
      />
    </>
  );
});

ChatMessageItem.displayName = 'ChatMessageItem';

// Add default export to maintain compatibility with existing imports
export default ChatMessageItem;
