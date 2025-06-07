import { useState, useRef, useCallback, useEffect } from 'react';
import type { Message } from '@/api/channels';
import { useSearchMessagesQuery } from '@/api/channels';
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
  
  // Состояние для пагинации поиска
  const [beforeId, setBeforeId] = useState<number | undefined>(undefined);
  const [allResults, setAllResults] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  
  // API запрос для поиска сообщений
  const queryParams = activeChannelId !== null && debouncedSearchQuery.trim() ? {
    channelId: activeChannelId,
    search: debouncedSearchQuery,
    size: 20,
    ...(beforeId ? { beforeId } : {})
  } : undefined;

  const {
    data: searchResultsData,
    isFetching: isSearching,
    error: searchError
  } = useSearchMessagesQuery(
    queryParams,
    {
      skip: !activeChannelId || !debouncedSearchQuery.trim()
    }
  );

  // Debounce для запроса поиска
  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => {
      setDebouncedSearchQuery(value);
    }, 300),
    []
  );

  // Эффект для обработки результатов поиска
  useEffect(() => {
    if (searchResultsData) {
      if (beforeId) {
        // Пагинация - добавляем к существующим результатам
        setAllResults(prev => [...prev, ...searchResultsData]);
      } else {
        // Новый поиск - заменяем результаты
        setAllResults(searchResultsData);
      }
      
      // Проверяем, есть ли еще результаты
      setHasMore(searchResultsData.length >= 20);
    }
  }, [searchResultsData, beforeId]);

  // Очистка результатов при изменении запроса
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setAllResults([]);
      setBeforeId(undefined);
      setHasMore(true);
    } else {
      // При новом запросе сбрасываем пагинацию
      setBeforeId(undefined);
    }
  }, [debouncedSearchQuery]);

  // Обработка изменения значения поиска
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchQuery(value);
    debouncedSetSearchQuery(value);
    
    // Если введен текст, показываем результаты
    if (value.trim()) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  }, [debouncedSetSearchQuery]);

  // Загрузка дополнительных результатов
  const loadMore = useCallback(() => {
    if (hasMore && allResults.length > 0 && !isSearching) {
      const lastResult = allResults[allResults.length - 1];
      setBeforeId(lastResult.id);
    }
  }, [hasMore, allResults, isSearching]);

  // Состояние загрузки дополнительных результатов
  const isLoadingMore = isSearching && beforeId !== undefined;

  // Очистка поиска
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setShowSearchResults(false);
    setSearchMode(false);
    setAllResults([]);
    setBeforeId(undefined);
    setHasMore(true);
    
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
  }, []);
  
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
    searchResults: allResults,
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
