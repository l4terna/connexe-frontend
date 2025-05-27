import React from 'react';
import { Box, Typography } from '@mui/material';
import SearchBar from './SearchBar';
import { Channel, Message } from '../../../../api/channels';

interface ChatHeaderProps {
  activeChannel: Channel | null;
  searchMode: boolean;
  setSearchMode: (mode: boolean) => void;
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchResultsRef: React.RefObject<HTMLDivElement | null>;
  showSearchResults: boolean;
  setShowSearchResults: (show: boolean) => void;
  searchResults: Message[] | undefined;
  isSearching: boolean;
  debouncedSearchQuery: string;
  handleSearchInputChange: (value: string) => void;
  clearSearch: () => void;
  onSearchResultClick: (message: Message) => void;
}

/**
 * ChatHeader component displays the channel name and search functionality
 */
const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeChannel,
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
}) => {
  return (
    <Box sx={{ 
      height: 60, 
      px: 3,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
        {activeChannel?.name || 'Select a channel'}
      </Typography>
      
      <SearchBar
        searchMode={searchMode}
        setSearchMode={setSearchMode}
        searchQuery={searchQuery}
        searchInputRef={searchInputRef}
        searchResultsRef={searchResultsRef}
        showSearchResults={showSearchResults}
        setShowSearchResults={setShowSearchResults}
        searchResults={searchResults}
        isSearching={isSearching}
        debouncedSearchQuery={debouncedSearchQuery}
        handleSearchInputChange={handleSearchInputChange}
        clearSearch={clearSearch}
        onSearchResultClick={onSearchResultClick}
      />
    </Box>
  );
};

export default ChatHeader;
