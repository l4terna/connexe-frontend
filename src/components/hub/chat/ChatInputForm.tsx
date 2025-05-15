import React, { RefObject } from 'react';
import { Paper, Stack, IconButton } from '@mui/material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import Input from '../../common/Input';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SendIcon from '@mui/icons-material/Send';

interface ChatInputFormProps {
  onSend: (values: { content: string }, helpers: { resetForm: () => void }) => void;
  sending: boolean;
  inputRef: RefObject<HTMLInputElement>;
  activeChannel: any;
}

const messageSchema = Yup.object().shape({
  content: Yup.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message is too long')
});

const ChatInputForm: React.FC<ChatInputFormProps> = ({ onSend, sending, inputRef, activeChannel }) => {
  return (
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
        onSubmit={onSend}
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
  );
};

export default ChatInputForm; 