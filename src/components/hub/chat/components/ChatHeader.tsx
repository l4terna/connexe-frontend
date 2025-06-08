import React from 'react';
import { Box, Typography } from '@mui/material';
import SearchBar from './SearchBar';
import { Channel, Message } from '../../../../api/channels';
import { LoadingMode } from '../hooks/useMessagePagination';

interface ChatHeaderProps {
  activeChannel: Channel | null;
  onSearchResultClick: (message: Message) => void;
  // Loading states
  isLoadingMessages?: boolean;
  isLoadingAround?: boolean;
  paginationState?: {
    loadingMode: LoadingMode;
    beforeId: number | null;
    afterId: number | null;
    isJumpingToMessage: boolean;
  };
}

/**
 * ChatHeader component displays the channel name and search functionality
 */
const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeChannel,
  onSearchResultClick,
  isLoadingMessages = false,
  isLoadingAround = false,
  paginationState,
}) => {
  // Determine if we should show loading indicator
  const isLoading = isLoadingMessages || isLoadingAround || 
    (paginationState?.loadingMode === 'pagination' && 
     (paginationState.beforeId !== null || paginationState.afterId !== null)) ||
    (paginationState?.loadingMode === 'around' && paginationState.isJumpingToMessage);

  return (
    <Box sx={{ 
      height: 60, 
      px: 3,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      position: 'relative',
    }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
        {activeChannel?.name || 'Select a channel'}
      </Typography>
      
      <SearchBar
        activeChannelId={activeChannel?.id || null}
        onSearchResultClick={onSearchResultClick}
      />

      {/* Loading indicator bar */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: 'rgba(0, 207, 255, 0.2)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: '100%',
              background: 'linear-gradient(90deg, transparent, #00CFFF, transparent)',
              animation: 'loadingSlide 1.5s infinite',
              '@keyframes loadingSlide': {
                '0%': {
                  transform: 'translateX(-100%)',
                },
                '100%': {
                  transform: 'translateX(100%)',
                },
              },
            }}
          />
        </Box>
      )}


    </Box>
  );
};

export default ChatHeader;
