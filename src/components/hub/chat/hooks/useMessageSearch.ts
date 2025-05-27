import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchMessagesQuery } from '@/api/channels';
import type { Message } from '@/api/channels';

interface UseMessageSearchProps {
  channelId: number | undefined;
  onSearchResultClick: (messageId: number) => void;
}

interface UseMessageSearchReturn {
  searchMode: boolean;
  setSearchMode: (mode: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  debouncedSearchQuery: string;
  showSearchResults: boolean;
  setShowSearchResults: (show: boolean) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchResultsRef: React.RefObject<HTMLDivElement | null>;
  highlightedMessages: Set<number>;
  setHighlightedMessages: React.Dispatch<React.SetStateAction<Set<number>>>;
  focusedMessageId: number | null;
  setFocusedMessageId: (id: number | null) => void;
  searchResults: Message[] | undefined;
  isSearching: boolean;
  handleSearchInputChange: (value: string) => void;
  handleSearchResultClick: (message: Message) => void;
  clearSearch: () => void;
}

export const useMessageSearch = ({
  channelId,
  onSearchResultClick
}: UseMessageSearchProps): UseMessageSearchReturn => {
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [highlightedMessages, setHighlightedMessages] = useState<Set<number>>(new Set());
  const [focusedMessageId, setFocusedMessageId] = useState<number | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchResultsRef = useRef<HTMLDivElement | null>(null);
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Search query
  const { data: searchResults, isLoading: isSearching } = useSearchMessagesQuery(
    {
      channelId: channelId ?? 0,
      search: debouncedSearchQuery,
      size: 20
    },
    {
      skip: !channelId || !debouncedSearchQuery || !searchMode
    }
  );

  // Handle search input change with debouncing
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchQuery(value);

    // Clear previous timer
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    // Set new timer for debouncing
    searchDebounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(value);
      if (value.trim()) {
        setShowSearchResults(true);
      }
    }, 300);
  }, []);

  // Handle search result click
  const handleSearchResultClick = useCallback((message: Message) => {
    // Clear search
    setSearchMode(false);
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setShowSearchResults(false);
    
    // Clear any existing highlights
    setHighlightedMessages(new Set());
    setFocusedMessageId(null);
    
    // Navigate to the message
    onSearchResultClick(message.id);
  }, [onSearchResultClick]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchMode(false);
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setShowSearchResults(false);
    setHighlightedMessages(new Set());
    setFocusedMessageId(null);
  }, []);

  // Handle search mode changes
  useEffect(() => {
    if (!searchMode) {
      // When search mode is disabled, clear search results
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setShowSearchResults(false);
    }
  }, [searchMode]);

  // Handle click outside to close search results dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showSearchResults &&
        searchResultsRef.current &&
        searchInputRef.current &&
        !searchResultsRef.current.contains(event.target as Node) &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, []);

  return {
    searchMode,
    setSearchMode,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    showSearchResults,
    setShowSearchResults,
    searchInputRef,
    searchResultsRef,
    highlightedMessages,
    setHighlightedMessages,
    focusedMessageId,
    setFocusedMessageId,
    searchResults,
    isSearching,
    handleSearchInputChange,
    handleSearchResultClick,
    clearSearch
  };
};