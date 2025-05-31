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
  loadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
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
  const [beforeId, setBeforeId] = useState<number | undefined>(undefined);
  const [allResults, setAllResults] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchResultsRef = useRef<HTMLDivElement | null>(null);
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Search query
  const queryArgs = {
    channelId: channelId ?? 0,
    search: debouncedSearchQuery,
    size: 20,
    ...(beforeId && { beforeId })
  };
  
  const shouldSkip = !channelId || !debouncedSearchQuery || !searchMode;
  
  const { data: searchResults, isLoading: isSearching, isFetching } = useSearchMessagesQuery(
    queryArgs,
    {
      skip: shouldSkip,
      refetchOnMountOrArgChange: true
    }
  );
  
  const isLoadingMore = isFetching && beforeId !== undefined;

  // Handle search input change with debouncing
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchQuery(value);

    // Clear previous timer
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    // Reset pagination on new search
    setBeforeId(undefined);
    setAllResults([]);
    setHasMore(true);

    // Set new timer for debouncing
    searchDebounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(value);
      if (value.trim()) {
        setShowSearchResults(true);
        // Don't manually refetch - let RTK Query handle it through debouncedSearchQuery change
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
    setBeforeId(undefined);
    setAllResults([]);
    setHasMore(true);
  }, []);
  
  // Load more results
  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore && allResults.length > 0) {
      const lastMessage = allResults[allResults.length - 1];
      console.log('Loading more, last message id:', lastMessage.id, 'hasMore:', hasMore);
      setBeforeId(lastMessage.id);
    }
  }, [hasMore, isLoadingMore, allResults]);

  // Handle search results
  useEffect(() => {
    if (searchResults) {
      if (!beforeId) {
        // First page - replace results
        setAllResults(searchResults);
      } else {
        // Subsequent pages - append results without duplicates
        setAllResults(prev => {
          const existingIds = new Set(prev.map(msg => msg.id));
          const newResults = searchResults.filter(msg => !existingIds.has(msg.id));
          
          // If no new results, it means we've reached the end
          if (newResults.length === 0) {
            setHasMore(false);
          }
          
          return [...prev, ...newResults];
        });
      }
      
      // Check if there are more results
      setHasMore(searchResults.length === 20);
    } else if (!debouncedSearchQuery) {
      // Clear results when search query is empty
      setAllResults([]);
    }
  }, [searchResults, beforeId, debouncedSearchQuery]);

  // Handle search mode changes
  useEffect(() => {
    if (!searchMode) {
      // When search mode is disabled, clear search results
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setShowSearchResults(false);
      setBeforeId(undefined);
      setAllResults([]);
      setHasMore(true);
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
    searchResults: allResults,
    isSearching: isSearching && beforeId === undefined,
    handleSearchInputChange,
    handleSearchResultClick,
    clearSearch,
    loadMore,
    hasMore,
    isLoadingMore
  };
};