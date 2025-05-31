import React from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import UserAvatar from '../../UserAvatar';
import SearchBar from '../../hub/chat/components/SearchBar';
import { Channel, Message } from '../../../api/channels';

interface User {
  id: number;
  login: string;
  avatar: string | null;
  presence?: string;
}

interface PrivateChatHeaderProps {
  activeChannel: Channel;
  otherUser?: User;
  searchMode: boolean;
  setSearchMode: (mode: boolean) => void;
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement>;
  searchResultsRef: React.RefObject<HTMLDivElement>;
  showSearchResults: boolean;
  setShowSearchResults: (show: boolean) => void;
  searchResults: Message[];
  isSearching: boolean;
  debouncedSearchQuery: string;
  handleSearchInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearSearch: () => void;
  onSearchResultClick: (message: Message) => void;
  isLoadingMessages: boolean;
  isLoadingAround: boolean;
  paginationState: {
    loadingMode: string | null;
    beforeId: number | null;
    afterId: number | null;
    isJumpingToMessage: boolean;
  };
}

const PrivateChatHeader: React.FC<PrivateChatHeaderProps> = ({
  activeChannel: _activeChannel,
  otherUser,
  searchMode,
  setSearchMode,
  searchQuery,
  searchInputRef,
  searchResultsRef,
  showSearchResults,
  setShowSearchResults,
  searchResults,
  isSearching,
  debouncedSearchQuery,
  handleSearchInputChange,
  clearSearch,
  onSearchResultClick,
  isLoadingMessages,
  isLoadingAround,
  paginationState
}) => {
  const isLoading = isLoadingMessages || isLoadingAround || 
    paginationState.loadingMode === 'around' || 
    paginationState.isJumpingToMessage;

  const getDisplayName = () => {
    if (otherUser) {
      return otherUser.login;
    }
    return 'Private Chat';
  };

  const getOnlineStatus = () => {
    if (otherUser?.presence) {
      return otherUser.presence.toLowerCase();
    }
    return 'offline';
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 24px',
        background: 'linear-gradient(135deg, rgba(25,25,40,0.95) 0%, rgba(35,35,55,0.95) 100%)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
        minHeight: '64px',
      }}
    >
      {/* Left side - User info */}
      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
        {otherUser && (
          <Box sx={{ position: 'relative', mr: 2 }}>
            <UserAvatar
              userId={otherUser.id}
              src={otherUser.avatar || undefined}
              alt={otherUser.login}
              sx={{ width: 40, height: 40 }}
            />
            {/* Online status indicator */}
            {otherUser.presence === 'ONLINE' && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 12,
                  height: 12,
                  backgroundColor: '#44b700',
                  borderRadius: '50%',
                  border: '2px solid rgba(25,25,40,0.95)',
                }}
              />
            )}
          </Box>
        )}
        
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h6"
              sx={{
                color: 'white',
                fontWeight: 600,
                fontSize: '18px',
              }}
            >
              {getDisplayName()}
            </Typography>
            
            {isLoading && (
              <CircularProgress
                size={16}
                thickness={4}
                sx={{
                  color: 'rgba(255,255,255,0.6)',
                  '& .MuiCircularProgress-circle': {
                    strokeLinecap: 'round',
                  },
                }}
              />
            )}
          </Box>
          
          {otherUser && (
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '14px',
                lineHeight: 1.2,
              }}
            >
              {(() => {
                const status = getOnlineStatus();
                if (status === 'online') return 'В сети';
                if (status === 'away') return 'Отошел';
                if (status === 'busy') return 'Занят';
                if (status === 'offline') return 'Не в сети';
                return 'Был недавно';
              })()}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Right side - Search */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {!searchMode ? (
          <IconButton
            onClick={() => setSearchMode(true)}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              '&:hover': {
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            <SearchIcon />
          </IconButton>
        ) : (
          <Box sx={{ position: 'relative', minWidth: 300 }}>
            <SearchBar
              searchQuery={searchQuery}
              searchInputRef={searchInputRef}
              searchResultsRef={searchResultsRef}
              showSearchResults={showSearchResults}
              setShowSearchResults={setShowSearchResults}
              searchResults={searchResults}
              isSearching={isSearching}
              debouncedSearchQuery={debouncedSearchQuery}
              handleSearchInputChange={(value: string) => handleSearchInputChange({ target: { value } } as React.ChangeEvent<HTMLInputElement>)}
              onSearchResultClick={onSearchResultClick}
              placeholder="Search in conversation..."
            />
            <IconButton
              onClick={clearSearch}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.7)',
                '&:hover': {
                  color: 'white',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                },
                zIndex: 10,
              }}
              size="small"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PrivateChatHeader;