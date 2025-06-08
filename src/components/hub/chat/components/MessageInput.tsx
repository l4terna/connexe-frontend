import React, { useRef, useEffect, useState } from 'react';
import { Box, IconButton, Paper, Stack, Typography, Tooltip } from '@mui/material';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import ReplyIcon from '@mui/icons-material/Reply';
import ErrorIcon from '@mui/icons-material/Error';
import ImageIcon from '@mui/icons-material/Image';
import { Formik, Form, Field, FormikProps } from 'formik';
import * as Yup from 'yup';
import Input from '../../../common/Input';
import { Channel } from '../../../../api/channels';
import ImagePreviewModal from './ImagePreviewModal';

// Validation schema
const messageSchema = Yup.object().shape({
  content: Yup.string()
    .max(2000, 'Message is too long')
    // Allow empty content if images are attached
    .test('content-or-images', 'Message cannot be empty', function() {
      // This check is performed in the Formik submit handler
      // Allow all content here, but UI will disable button if both content and images are empty
      return true;
    })
});

interface ExtendedMessage {
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
  status?: number;
  read_by_count?: number;
  channel_id?: number;
  reply?: ExtendedMessage;
}

// Constants for image upload
const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_IMAGES = 5;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// ImageFile interface to track uploaded images with their validation status
interface ImageFile {
  file: File;
  preview: string;
  valid: boolean;
  error?: string;
}

interface MessageInputProps {
  activeChannel: Channel | null;
  canSendMessages: boolean;
  sending: boolean;
  replyingToMessage: ExtendedMessage | null;
  onSendMessage: (values: { content: string, images?: File[] }, formikHelpers: { resetForm: () => void }) => Promise<void>;
  onReplyCancel: () => void;
  onReplyClick?: (messageId: number) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  activeChannel,
  canSendMessages,
  sending,
  replyingToMessage,
  onSendMessage,
  onReplyCancel,
  onReplyClick
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formikRef = useRef<FormikProps<{ content: string }> | null>(null);
  const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState<number | null>(null);

  // Add effect to focus input when component mounts or channel changes
  useEffect(() => {
    if (activeChannel && inputRef.current) {
      inputRef.current.focus();
      // Place cursor at the end
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [activeChannel]);

  // Focus input when reply mode is activated
  useEffect(() => {
    if (replyingToMessage && inputRef.current) {
      inputRef.current.focus();
      // Place cursor at the end
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [replyingToMessage]);

  // Handle Escape key to cancel reply
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && replyingToMessage) {
        onReplyCancel();
      }
    };

    // Add event listener to document to catch Escape anywhere
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [replyingToMessage, onReplyCancel]);

  // Handle paste events for image insertion
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(item => item.type.startsWith('image/'));
      
      if (imageItems.length === 0) return;
      
      // Don't add more images if already at max
      if (selectedImages.length >= MAX_IMAGES) {
        return;
      }
      
      // Prevent default paste behavior for images
      e.preventDefault();
      
      // Process pasted images
      const newImagesToAdd: ImageFile[] = [];
      
      imageItems.slice(0, MAX_IMAGES - selectedImages.length).forEach(item => {
        const file = item.getAsFile();
        if (!file) return;
        
        // Check for duplicate based on file size and type
        const isDuplicate = selectedImages.some(existingImage => 
          existingImage.file.size === file.size && 
          existingImage.file.type === file.type &&
          existingImage.file.lastModified === file.lastModified
        );
        
        if (isDuplicate) {
          console.log('Duplicate image detected, skipping');
          return;
        }
        
        // Create a synthetic filename with timestamp and random component
        const timestamp = new Date().getTime();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = file.type.split('/')[1] || 'png';
        const syntheticFile = new File([file], `pasted-image-${timestamp}-${random}.${extension}`, {
          type: file.type,
          lastModified: file.lastModified || Date.now()
        });
        
        // Validate file type
        const isValidType = ALLOWED_IMAGE_TYPES.includes(syntheticFile.type);
        
        // Validate file size
        const isValidSize = syntheticFile.size <= MAX_IMAGE_SIZE;
        
        // Create image object with validation results
        const newImage = {
          file: syntheticFile,
          preview: URL.createObjectURL(syntheticFile),
          valid: isValidType && isValidSize,
          error: !isValidType 
            ? 'Неподдерживаемый формат файла' 
            : !isValidSize 
            ? 'Файл слишком большой (макс. 15MB)' 
            : undefined
        };
        
        newImagesToAdd.push(newImage);
      });
      
      // Add all new images at once
      if (newImagesToAdd.length > 0) {
        setSelectedImages(prev => [...prev, ...newImagesToAdd]);
      }
    };
    
    // Add event listener to the input field
    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener('paste', handlePaste);
      
      return () => {
        inputElement.removeEventListener('paste', handlePaste);
      };
    }
  }, [selectedImages.length]);
  
  // Clean up image previews when component unmounts
  useEffect(() => {
    return () => {
      // Revoke object URLs to avoid memory leaks
      selectedImages.forEach(image => URL.revokeObjectURL(image.preview));
    };
  }, [selectedImages]);


  const handleReplyClick = () => {
    if (replyingToMessage && onReplyClick) {
      onReplyClick(replyingToMessage.id);
    }
  };

  const formatReplyContent = (message: ExtendedMessage) => {
    // If there's text content, return it
    if (message.content && message.content.trim()) {
      return truncateContent(message.content);
    }
    
    // If no text but has attachments, show attachment count
    const attachmentCount = message.attachments?.length || 0;
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

  const truncateContent = (content: string) => {
    // Handle extremely long messages with no spaces
    if (content.length > 150) {
      // Check if it's a long string with no spaces (which causes layout issues)
      const hasSpaces = content.indexOf(' ') !== -1;
      if (!hasSpaces && content.length > 100) {
        // For long strings with no spaces, be more aggressive with truncation
        return content.substring(0, 100) + '...';
      } else {
        // Normal truncation for text with spaces
        return content.substring(0, 150) + '...';
      }
    }
    return content;
  };
  
  // Handler for file input change
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files.length) return;
    
    // Convert FileList to array for easier processing
    const files = Array.from(event.target.files);
    
    // Reset file input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Don't add more images if already at max
    if (selectedImages.length >= MAX_IMAGES) {
      return;
    }
    
    // Process each file with validation and duplicate check
    const newImages: ImageFile[] = [];
    
    files.slice(0, MAX_IMAGES - selectedImages.length).forEach(file => {
      // Check for duplicate based on file size, type, and last modified
      const isDuplicate = selectedImages.some(existingImage => 
        existingImage.file.size === file.size && 
        existingImage.file.type === file.type &&
        existingImage.file.name === file.name &&
        existingImage.file.lastModified === file.lastModified
      );
      
      if (isDuplicate) {
        console.log('Duplicate file detected, skipping:', file.name);
        return;
      }
      
      // Validate file type
      const isValidType = ALLOWED_IMAGE_TYPES.includes(file.type);
      
      // Validate file size
      const isValidSize = file.size <= MAX_IMAGE_SIZE;
      
      // Create image object with validation results
      const imageFile: ImageFile = {
        file,
        preview: URL.createObjectURL(file),
        valid: isValidType && isValidSize,
        error: !isValidType 
          ? 'Неподдерживаемый формат файла' 
          : !isValidSize 
          ? 'Файл слишком большой (макс. 15MB)' 
          : undefined
      };
      
      newImages.push(imageFile);
    });
    
    // Add new images to the selected images array
    if (newImages.length > 0) {
      setSelectedImages(prev => [...prev, ...newImages]);
    }
  };
  
  // Handler to remove an image
  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => {
      // Create a copy of the array without the removed image
      const updated = [...prev];
      
      // Revoke object URL to prevent memory leak
      URL.revokeObjectURL(updated[index].preview);
      
      // Remove the image from the array
      updated.splice(index, 1);
      return updated;
    });
  };
  
  // Click handler for the attach button
  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImageClick = (index: number) => {
    setFullscreenImageIndex(index);
  };

  return (
    <Box sx={{ p: 2 }}>
      {canSendMessages ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {replyingToMessage && (
            <Paper
              sx={{
                p: '8px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                background: 'rgba(30,30,47,0.95)',
                border: '1px solid rgba(149,128,255,0.25)',
                borderRadius: 2,
                position: 'relative',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                mb: 1,
                pl: 3,
                width: '100%'
              }}
            >
              <Box 
                sx={{ 
                  position: 'absolute', 
                  left: 0, 
                  top: 0, 
                  bottom: 0, 
                  width: '4px', 
                  backgroundColor: '#00CFFF',
                  borderTopLeftRadius: 2,
                  borderBottomLeftRadius: 2
                }}
              />
              <Box 
                sx={{ flex: 1, cursor: 'pointer' }}
                onClick={handleReplyClick}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <ReplyIcon sx={{ color: '#00CFFF', fontSize: '0.9rem' }} />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#00CFFF', 
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    Ответ {replyingToMessage.author?.login ? `@${replyingToMessage.author.login}` : ''}
                  </Typography>
                </Box>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.7)', 
                    fontSize: '0.85rem',
                    lineHeight: 1.4,
                    wordBreak: 'break-word'
                  }}
                >
                  {formatReplyContent(replyingToMessage)}
                </Typography>
              </Box>
              <IconButton 
                size="small" 
                onClick={onReplyCancel}
                sx={{ 
                  color: 'rgba(255,255,255,0.5)',
                  '&:hover': { color: 'rgba(255,255,255,0.8)' }
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Paper>
          )}
          
          {/* Selected images preview */}
          {selectedImages.length > 0 && (
            <Paper
              sx={{
                p: 2,
                background: 'rgba(30,30,47,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 2,
                mb: 1,
              }}
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedImages.map((image, index) => (
                  <Box
                    key={index}
                    sx={{ width: { xs: 'calc(33.33% - 8px)', sm: 'calc(25% - 8px)', md: 'calc(16.66% - 8px)' } }}>
                    <Box
                      sx={{
                        position: 'relative',
                        height: 100,
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: image.valid ? '1px solid rgba(255,255,255,0.1)' : '1px solid #f44336',
                        '&:hover .image-remove-btn': {
                          opacity: 1,
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={image.preview}
                        alt="Preview"
                        onClick={() => handleImageClick(index)}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          cursor: 'pointer',
                        }}
                      />
                      {/* Error indicator for invalid images */}
                      {!image.valid && (
                        <Tooltip title={image.error || 'Invalid image'}>
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 5,
                              left: 5,
                              bgcolor: 'rgba(0,0,0,0.7)',
                              borderRadius: '50%',
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <ErrorIcon sx={{ color: '#f44336', fontSize: '16px' }} />
                          </Box>
                        </Tooltip>
                      )}
                      {/* Remove button that appears on hover */}
                      <IconButton
                        className="image-remove-btn"
                        size="small"
                        onClick={() => handleRemoveImage(index)}
                        sx={{
                          position: 'absolute',
                          top: 5,
                          right: 5,
                          bgcolor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          p: '4px',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          '&:hover': {
                            bgcolor: 'rgba(0,0,0,0.85)',
                          },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: '16px' }} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
              
              {/* Counter for images */}
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  {selectedImages.length} / {MAX_IMAGES} изображений
                </Typography>
                
                {/* Clear all button */}
                {selectedImages.length > 1 && (
                  <Typography 
                    variant="caption" 
                    onClick={() => {
                      selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
                      setSelectedImages([]);
                    }}
                    sx={{ 
                      color: '#1976D2', 
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' }
                    }}
                  >
                    Очистить все
                  </Typography>
                )}
              </Box>
            </Paper>
          )}
          
          {/* Hidden file input */}
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            multiple
            ref={fileInputRef}
            onChange={handleImageSelect}
            style={{ display: 'none' }}
            max={MAX_IMAGES.toString()}
          />
          
          {/* Message input */}
          <Paper
            sx={{
              p: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 3,
            }}
          >
            <Formik
              innerRef={formikRef}
              initialValues={{ content: '' }}
              validationSchema={messageSchema}
              onSubmit={async (values, formikHelpers) => {
                // Get valid images
                const validImages = selectedImages
                  .filter(img => img.valid)
                  .map(img => img.file);
                
                try {
                  // Call onSendMessage with content and images
                  await onSendMessage(
                    { 
                      content: values.content, 
                      images: validImages.length > 0 ? validImages : undefined 
                    }, 
                    formikHelpers
                  );
                  
                  // Clear images only on successful send
                  selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
                  setSelectedImages([]);
                } catch (error) {
                  // On error, just log it - let the parent handle the error display
                  console.error('Error sending message:', error);
                }
              }}
            >
              {({ handleSubmit, values }) => (
                <>
                  <Form style={{ width: '100%' }}>
                    <Field
                      name="content"
                      component={Input}
                      placeholder="Type a message..."
                      multiline
                      maxRows={4}
                      size="small"
                      disabled={!activeChannel || sending}
                      inputRef={inputRef}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'transparent',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'transparent',
                          },
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'transparent',
                          },
                        },
                      }}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                    />
                  </Form>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title={selectedImages.length >= MAX_IMAGES ? `Максимум ${MAX_IMAGES} изображений` : 'Прикрепить изображения'}>
                      <Box>  {/* Wrapper to make tooltip work with disabled button */}
                        <IconButton 
                          size="small" 
                          sx={{ 
                            color: selectedImages.length >= MAX_IMAGES ? 'rgba(255,255,255,0.3)' : '#1E90FF'
                          }}
                          onClick={handleAttachClick}
                          disabled={selectedImages.length >= MAX_IMAGES}
                        >
                          <ImageIcon />
                        </IconButton>
                      </Box>
                    </Tooltip>
                    <IconButton
                      size="small"
                      sx={{
                        color: (values.content || selectedImages.length > 0) ? '#1976D2' : 'rgba(255,255,255,0.3)',
                        transition: 'color 0.25s cubic-bezier(.4,0,.2,1)',
                        '&:hover': {
                          color: (values.content || selectedImages.length > 0) ? '#1976D2' : 'rgba(255,255,255,0.3)',
                        }
                      }}
                      onClick={() => handleSubmit()}
                      disabled={sending || (!values.content && selectedImages.length === 0)}
                    >
                      <SendIcon />
                    </IconButton>
                  </Stack>
                </>
              )}
            </Formik>
          </Paper>
        </Box>
      ) : (
        <Paper
          sx={{
            p: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
          }}
        >
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
            Недостаточно прав для отправки сообщений
          </Typography>
        </Paper>
      )}
      
      <ImagePreviewModal
        open={fullscreenImageIndex !== null}
        images={selectedImages}
        currentIndex={fullscreenImageIndex || 0}
        onClose={() => setFullscreenImageIndex(null)}
        onNavigate={setFullscreenImageIndex}
      />
    </Box>
  );
};

export default MessageInput;