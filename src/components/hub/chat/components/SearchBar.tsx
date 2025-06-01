// SearchBar.tsx - изолированная версия
import React, { useCallback, useMemo } from 'react';
import { Box, IconButton, Typography, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Formik, Form, Field } from 'formik';
import { SearchResultItem } from './SearchResultItem';
import { useSearchBar } from '../hooks/useSearchBar';
import type { Message } from '@/api/channels';

interface SearchBarProps {
  activeChannelId: number | null;
  onSearchResultClick: (message: Message) => void;
  // Optional search-related props from parent
  searchMode?: boolean;
  setSearchMode?: (mode: boolean) => void;
  searchQuery?: string;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  searchResultsRef?: React.RefObject<HTMLDivElement | null>;
  showSearchResults?: boolean;
  setShowSearchResults?: (show: boolean) => void;
  searchResults?: Message[];
  isSearching?: boolean;
  debouncedSearchQuery?: string;
  handleSearchInputChange?: (value: string) => void;
  clearSearch?: () => void;
  loadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  activeChannelId,
  onSearchResultClick,
  // Optional props from parent
  searchMode: passedSearchMode,
  setSearchMode: passedSetSearchMode,
  searchQuery: passedSearchQuery,
  searchInputRef: passedSearchInputRef,
  searchResultsRef: passedSearchResultsRef,
  showSearchResults: passedShowSearchResults,
  setShowSearchResults: passedSetShowSearchResults,
  searchResults: passedSearchResults,
  isSearching: passedIsSearching,
  debouncedSearchQuery: passedDebouncedSearchQuery,
  handleSearchInputChange: passedHandleSearchInputChange,
  clearSearch: passedClearSearch,
  loadMore: passedLoadMore,
  hasMore: passedHasMore,
  isLoadingMore: passedIsLoadingMore
}) => {
  // Используем хук для изоляции логики поиска только если не переданы пропсы
  const hookValues = useSearchBar({ activeChannelId });
  
  // Use passed props if they exist, otherwise use hook values
  const searchMode = passedSearchMode !== undefined ? passedSearchMode : hookValues.searchMode;
  const setSearchMode = passedSetSearchMode || hookValues.setSearchMode;
  const searchQuery = passedSearchQuery !== undefined ? passedSearchQuery : hookValues.searchQuery;
  const searchResults = passedSearchResults || hookValues.searchResults;
  const debouncedSearchQuery = passedDebouncedSearchQuery !== undefined ? passedDebouncedSearchQuery : hookValues.debouncedSearchQuery;
  const isSearching = passedIsSearching !== undefined ? passedIsSearching : hookValues.isSearching;
  const showSearchResults = passedShowSearchResults !== undefined ? passedShowSearchResults : hookValues.showSearchResults;
  const setShowSearchResults = passedSetShowSearchResults || hookValues.setShowSearchResults;
  const hasMore = passedHasMore !== undefined ? passedHasMore : hookValues.hasMore;
  const isLoadingMore = passedIsLoadingMore !== undefined ? passedIsLoadingMore : hookValues.isLoadingMore;
  const searchInputRef = passedSearchInputRef || hookValues.searchInputRef;
  const searchResultsRef = passedSearchResultsRef || hookValues.searchResultsRef;
  const handleSearchInputChange = passedHandleSearchInputChange || hookValues.handleSearchInputChange;
  const clearSearch = passedClearSearch || hookValues.clearSearch;
  const loadMore = passedLoadMore || hookValues.loadMore;
  const hookHandleResultClick = hookValues.handleResultClick;
  // Мемоизируем обработчик скролла
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollHeight, scrollTop, clientHeight } = container;
    
    // Проверяем, достигли ли конца списка
    if (scrollHeight - scrollTop - clientHeight < 100) {
      if (loadMore && hasMore && !isLoadingMore) {
        loadMore();
      }
    }
  }, [loadMore, hasMore, isLoadingMore]);

  // Мемоизируем обработчик клика на результат
  const handleResultClick = useCallback((message: Message) => {
    // Важно: не закрываем поиск здесь, это будет сделано в обработчике
    // Сначала проверяем наличие внешнего обработчика
    if (onSearchResultClick) {
      onSearchResultClick(message);
    } else if (hookHandleResultClick) {
      // Иначе используем внутренний обработчик из хука
      hookHandleResultClick(message);
    }
    // Не закрываем поиск здесь, чтобы не прерывать навигацию
  }, [onSearchResultClick, hookHandleResultClick]);

  // Мемоизируем количество результатов
  const resultsCount = searchResults?.length || 0;
  const resultsText = useMemo(() => 
    `${resultsCount} ${resultsCount === 1 ? 'result' : 'results'}`,
    [resultsCount]
  );

  if (!searchMode) {
    return (
      <Tooltip title="Поиск сообщений" placement="top">
        <IconButton 
          onClick={() => {
            setSearchMode(true);
            // Используем RAF для оптимизации
            requestAnimationFrame(() => {
              searchInputRef.current?.focus();
            });
          }}
          sx={{
            color: 'rgba(255,255,255,0.6)',
            '&:hover': {
              color: 'rgba(255,255,255,0.9)',
              background: 'rgba(255,255,255,0.05)'
            }
          }}
        >
          <SearchIcon />
        </IconButton>
      </Tooltip>
    );
  }

  const hasResults = searchResults && searchResults.length > 0;
  const shouldShowResults = showSearchResults && searchQuery.trim();

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      position: 'relative',
      zIndex: 10001
    }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        background: 'rgba(255,255,255,0.05)',
        borderRadius: shouldShowResults && hasResults ? '20px 20px 0 0' : '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        borderBottom: shouldShowResults && hasResults ? 'none' : '1px solid rgba(255,255,255,0.1)',
        paddingLeft: 2,
        paddingRight: 1,
        width: '300px',
        transition: 'all 0.3s ease'
      }}>
        <Formik
          initialValues={{ query: searchQuery }}
          onSubmit={() => {}}
          enableReinitialize
        >
          {({ setFieldValue }) => (
            <Form style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                <Field name="query">
                  {({ field }: any) => (
                    <input
                      {...field}
                      ref={searchInputRef}
                      onChange={(e) => {
                        field.onChange(e);
                        handleSearchInputChange(e.target.value);
                      }}
                      onFocus={() => {
                        if (field.value?.trim() && hasResults) {
                          setShowSearchResults(true);
                        }
                      }}
                      placeholder="Поиск сообщений..."
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: '#fff',
                        fontSize: '0.9rem',
                        padding: '8px 0'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          if (showSearchResults) {
                            setShowSearchResults(false);
                          } else {
                            clearSearch();
                          }
                        }
                      }}
                    />
                  )}
                </Field>
                {searchQuery.trim() && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      position: 'absolute',
                      right: 0,
                      top: '-18px',
                      color: hasResults ? '#00FFBA' : '#FF69B4',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(0,0,0,0.3)'
                    }}
                  >
                    {resultsText}
                  </Typography>
                )}
              </Box>
              <IconButton 
                type="button"
                size="small" 
                onClick={() => {
                  if (showSearchResults) {
                    setShowSearchResults(false);
                  } else {
                    clearSearch();
                    setFieldValue('query', '');
                  }
                }}
                sx={{ 
                  color: 'rgba(255,255,255,0.5)',
                  '&:hover': {
                    color: 'rgba(255,255,255,0.9)',
                    background: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                {showSearchResults ? <KeyboardArrowDownIcon fontSize="small" /> : <CloseIcon fontSize="small" />}
              </IconButton>
            </Form>
          )}
        </Formik>
      </Box>
      
      {/* Search Results Dropdown */}
      {shouldShowResults && (
        <Box
          ref={searchResultsRef}
          onMouseDown={(e) => e.preventDefault()}
          onScroll={handleScroll}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            maxHeight: '300px',
            background: 'rgba(20, 20, 35, 0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderTop: 'none',
            borderRadius: '0 0 20px 20px',
            overflowY: 'auto',
            overflowX: 'hidden',
            zIndex: 10002,
            backdropFilter: 'blur(15px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            // Оптимизация скролла
            willChange: 'scroll-position',
            contain: 'layout style paint',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(255,255,255,0.3)',
              borderRadius: '3px',
              '&:hover': {
                background: 'rgba(255,255,255,0.5)',
              },
            },
          }}
        >
          {/* Loading indicator */}
          {isSearching && (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Box 
                sx={{ 
                  width: 24, 
                  height: 24, 
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderTop: '2px solid #00CFFF',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' }
                  }
                }}
              />
              <Typography sx={{ ml: 1, color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                Поиск...
              </Typography>
            </Box>
          )}
          
          {/* No results message */}
          {!isSearching && searchResults && searchResults.length === 0 && debouncedSearchQuery && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                По запросу <Box component="span" sx={{ fontWeight: 'bold', color: '#00CFFF' }}>{debouncedSearchQuery}</Box> ничего не найдено
              </Typography>
            </Box>
          )}
          
          {/* Search results with memoized items */}
          {!isSearching && hasResults && searchResults.map((msg, index) => (
            <SearchResultItem
              key={`${msg.id}-${index}`}
              message={msg}
              searchQuery={debouncedSearchQuery}
              onResultClick={handleResultClick}
            />
          ))}
          
          {/* Loading more indicator */}
          {isLoadingMore && (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Box 
                sx={{ 
                  width: 20, 
                  height: 20, 
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderTop: '2px solid #00CFFF',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <Typography sx={{ ml: 1, color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                Загрузка...
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default SearchBar;