import React from 'react';
import { Box, Fade, IconButton, Paper, Typography } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

interface NewMessagesIndicatorProps {
  showScrollButton: boolean;
  newMessagesCount: number;
  unreadCount: number;
  replyingToMessage: boolean;
  onScrollToBottom: () => void;
}

/**
 * Component that displays the scroll to bottom button and new messages count indicator
 */
const NewMessagesIndicator: React.FC<NewMessagesIndicatorProps> = ({
  showScrollButton,
  newMessagesCount,
  unreadCount,
  replyingToMessage,
  onScrollToBottom,
}) => {
  const bottomPosition = replyingToMessage ? 160 : 100; // Increased bottom margin when reply panel is visible
  
  return (
    <>
      {/* Scroll to bottom button */}
      <Fade in={showScrollButton}>
        <IconButton
          onClick={onScrollToBottom}
          sx={{
            position: 'absolute',
            bottom: bottomPosition,
            right: 20,
            backgroundColor: 'rgba(30,30,47,0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            '&:hover': {
              backgroundColor: 'rgba(40,40,57,0.95)',
            },
            zIndex: 1000,
            transition: 'bottom 0.2s ease-out', // Smooth transition for position change
          }}
        >
          <KeyboardArrowDownIcon sx={{ color: '#fff' }} />
        </IconButton>
      </Fade>

      {/* New messages count indicator */}
      <Fade in={newMessagesCount > 0 || unreadCount > 0}>
        <Box
          sx={{
            position: 'absolute',
            bottom: bottomPosition,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            transition: 'bottom 0.2s ease-out', // Smooth transition for position change
          }}
        >
          <Paper
            sx={{
              backgroundColor: '#FF69B4',
              color: '#fff',
              px: 2,
              py: 1,
              borderRadius: '20px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255,105,180,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover': {
                backgroundColor: '#FF1493',
              },
            }}
            onClick={onScrollToBottom}
          >
            <KeyboardArrowDownIcon />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {(newMessagesCount || unreadCount)} {(newMessagesCount || unreadCount) === 1 ? 'новое сообщение' : 'новых сообщений'}
            </Typography>
          </Paper>
        </Box>
      </Fade>
    </>
  );
};

export default NewMessagesIndicator;
