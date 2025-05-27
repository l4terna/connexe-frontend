import React, { useRef, useEffect } from 'react';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import ReplyIcon from '@mui/icons-material/Reply';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import Input from '../../../common/Input';
import { Channel } from '../../../../api/channels';

// Validation schema
const messageSchema = Yup.object().shape({
  content: Yup.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message is too long')
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

interface MessageInputProps {
  activeChannel: Channel | null;
  canSendMessages: boolean;
  sending: boolean;
  replyingToMessage: ExtendedMessage | null;
  onSendMessage: (values: { content: string }, formikHelpers: { resetForm: () => void }) => Promise<void>;
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

  // Add effect to focus input when component mounts or channel changes
  useEffect(() => {
    if (activeChannel && inputRef.current) {
      inputRef.current.focus();
      // Place cursor at the end
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [activeChannel]);

  const handleReplyClick = () => {
    if (replyingToMessage && onReplyClick) {
      onReplyClick(replyingToMessage.id);
    }
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
                  <Typography sx={{ color: '#00CFFF', fontWeight: 600, fontSize: '0.9rem' }}>
                    {replyingToMessage.author.login}
                  </Typography>
                </Box>
                <Typography 
                  sx={{ 
                    color: 'rgba(255,255,255,0.7)', 
                    fontSize: '0.85rem',
                    maxWidth: '500px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxHeight: '1.5em'
                  }}
                >
                  {truncateContent(replyingToMessage.content)}
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
              initialValues={{ content: '' }}
              validationSchema={messageSchema}
              onSubmit={onSendMessage}
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
                    <IconButton size="small" sx={{ color: '#FF69B4' }}>
                      <EmojiEmotionsIcon />
                    </IconButton>
                    <IconButton size="small" sx={{ color: '#1E90FF' }}>
                      <AttachFileIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{
                        color: values.content ? '#1976D2' : 'rgba(255,255,255,0.3)',
                        transition: 'color 0.25s cubic-bezier(.4,0,.2,1)',
                        '&:hover': {
                          color: values.content ? '#1976D2' : 'rgba(255,255,255,0.3)',
                        }
                      }}
                      onClick={() => handleSubmit()}
                      disabled={sending || !values.content}
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
    </Box>
  );
};

export default MessageInput;