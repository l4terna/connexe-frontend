import { useState, useRef, useCallback, useEffect } from 'react';
import type { Message } from '@/api/channels';
import { useMessageSearch } from './useMessageSearch';
import debounce from 'lodash/debounce';

interface UseSearchBarProps {
  activeChannelId: number | null;
}

export const useSearchBar = ({ activeChannelId }: UseSearchBarProps) => {
  // Состояния поиска
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Refs для доступа к DOM-элементам
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  
  // Используем существующий хук для выполнения запроса поиска
  const { 
    searchResults, 
    isSearching, 
    hasMore, 
    isLoadingMore, 
    loadMore, 
    clearSearch: resetSearch 
  } = useMessageSearch({
    channelId: activeChannelId !== null ? activeChannelId : undefined,
    onSearchResultClick: () => {} // Пустая функция, реальный обработчик будет передан через параметры
  });

  // Debounce для запроса поиска
  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => {
      setDebouncedSearchQuery(value);
    }, 300),
    []
  );

  // Обработка изменения значения поиска
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchQuery(value);
    debouncedSetSearchQuery(value);
    
    // Если введен текст, показываем результаты
    if (value.trim()) {
      setShowSearchResults(true);
    }
  }, [debouncedSetSearchQuery]);

  // Очистка поиска
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setShowSearchResults(false);
    resetSearch();
    
    if (!searchMode) {
      // Если мы уже вышли из режима поиска, очищаем input
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }
    }
  }, [searchMode, resetSearch]);
  
  // Обработчик клика по результату поиска
  const handleResultClick = useCallback(
    (_message: Message) => {
      setShowSearchResults(false);
      setSearchMode(false);
      clearSearch();
      // Обработчик будет передан через пропс
    },
    [clearSearch]
  );

  // Обработчик клика вне области результатов поиска
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchResultsRef.current && 
        !searchResultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Сброс при смене канала
  useEffect(() => {
    clearSearch();
    setSearchMode(false);
  }, [activeChannelId, clearSearch]);

  return {
    // Состояния
    searchMode,
    setSearchMode,
    searchQuery,
    searchResults,
    debouncedSearchQuery,
    isSearching,
    showSearchResults,
    setShowSearchResults,
    hasMore,
    isLoadingMore,
    
    // Refs
    searchInputRef,
    searchResultsRef,
    
    // Методы
    handleSearchInputChange,
    clearSearch,
    loadMore,
    handleResultClick
  };
};
