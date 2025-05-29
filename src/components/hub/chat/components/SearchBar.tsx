import React from 'react';
import { Box, IconButton, Typography, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Formik, Form, Field } from 'formik';
import DOMPurify from 'dompurify';
import { Message } from '../../../../api/channels';

interface SearchBarProps {
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

const SearchBar: React.FC<SearchBarProps> = ({
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
  onSearchResultClick
}) => {
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  if (!searchMode) {
    return (
      <Tooltip title="Поиск сообщений" placement="top">
        <IconButton 
          onClick={() => {
            setSearchMode(true);
            setTimeout(() => {
              if (searchInputRef.current) {
                searchInputRef.current.focus();
              }
            }, 100);
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

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      position: 'relative',
      zIndex: 1050
    }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        background: 'rgba(255,255,255,0.05)',
        borderRadius: showSearchResults && searchQuery.trim() && searchResults && searchResults.length > 0 ? '20px 20px 0 0' : '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        borderBottom: showSearchResults && searchQuery.trim() && searchResults && searchResults.length > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)',
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
                  {({ field, form }: any) => (
                    <input
                      {...field}
                      ref={searchInputRef}
                      onChange={(e) => {
                        field.onChange(e);
                        handleSearchInputChange(e.target.value);
                      }}
                      onFocus={() => {
                        if (field.value?.trim() && searchResults && searchResults.length > 0) {
                          setShowSearchResults(true);
                        }
                      }}
                      onBlur={(e) => {
                        e.preventDefault();
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
                            form.resetForm();
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
                      color: searchResults && searchResults.length > 0 ? '#00FFBA' : '#FF69B4',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(0,0,0,0.3)'
                    }}
                  >
                    {searchResults?.length || 0} {searchResults?.length === 1 ? 'result' : 'results'}
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
      {showSearchResults && searchQuery.trim() && (
        <Box
          ref={searchResultsRef}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            maxHeight: '300px',
            background: 'rgba(30,30,47,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderTop: 'none',
            borderRadius: '0 0 20px 20px',
            overflowY: 'auto',
            zIndex: 1100,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
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
          
          {/* Search results */}
          {!isSearching && searchResults && searchResults.length > 0 && searchResults.map((msg) => (
            <Box
              key={msg.id}
              onClick={() => onSearchResultClick(msg)}
              sx={{
                p: 2,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: 'rgba(255,255,255,0.05)',
                },
                '&:last-child': {
                  borderBottom: 'none',
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography sx={{ 
                  color: '#00CFFF', 
                  fontSize: '0.8rem', 
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '150px'
                }}>
                  {msg.author.login}
                </Typography>
                <Typography sx={{ 
                  color: 'rgba(255,255,255,0.4)', 
                  fontSize: '0.7rem',
                  ml: 'auto'
                }}>
                  {formatMessageTime(msg.created_at)}
                </Typography>
              </Box>
              <Typography
                sx={{ 
                  color: 'rgba(255,255,255,0.8)', 
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  '& mark': {
                    background: 'rgba(255, 105, 180, 0.3)',
                    color: '#FF69B4',
                    padding: '1px 2px',
                    borderRadius: '2px',
                    fontWeight: 600
                  }
                }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    (() => {
                      let content = msg.content;
                      
                      if (content.length > 150) {
                        content = content.substring(0, 150) + '...';
                      }
                      
                      content = content.replace(/\r\n/g, ' ').replace(/\n/g, ' ');
                      
                      if (debouncedSearchQuery.trim()) {
                        const query = debouncedSearchQuery.trim();
                        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`(${escapedQuery})`, 'gi');
                        content = content.replace(regex, '<mark>$1</mark>');
                      }
                      
                      return content;
                    })()
                  )
                }}
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default SearchBar;