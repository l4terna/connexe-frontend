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
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [allResults, setAllResults] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [lastProcessedPage, setLastProcessedPage] = useState<number>(-1);
  
  // API запрос для поиска сообщений
  const queryParams = activeChannelId !== null && debouncedSearchQuery.trim() ? {
    channelId: activeChannelId,
    search: debouncedSearchQuery,
    size: 50,
    ...(currentPage > 0 ? { page: currentPage } : {})
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
      if (currentPage > 0 && currentPage !== lastProcessedPage) {
        // Пагинация - добавляем к существующим результатам только если это новая страница
        setAllResults(prev => [...prev, ...searchResultsData]);
        setLastProcessedPage(currentPage);
      } else if (currentPage === 0 && lastProcessedPage !== -1) {
        // Новый поиск - заменяем результаты
        setAllResults(searchResultsData);
        setLastProcessedPage(0);
      } else if (currentPage === 0 && lastProcessedPage === -1) {
        // Первая загрузка результатов
        setAllResults(searchResultsData);
        setLastProcessedPage(0);
      }
      
      // Проверяем, есть ли еще результаты
      setHasMore(searchResultsData.length >= 20);
    }
  }, [searchResultsData, currentPage, lastProcessedPage]);

  // Очистка результатов при изменении запроса
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setAllResults([]);
      setCurrentPage(0);
      setHasMore(true);
      setLastProcessedPage(-1);
    } else {
      // При новом запросе сбрасываем пагинацию
      setCurrentPage(0);
      setLastProcessedPage(-1);
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
    if (hasMore && !isSearching) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasMore, isSearching]);

  // Состояние загрузки дополнительных результатов
  const isLoadingMore = isSearching && currentPage > 0;

  // Очистка поиска
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setShowSearchResults(false);
    setSearchMode(false);
    setAllResults([]);
    setCurrentPage(0);
    setHasMore(true);
    setLastProcessedPage(-1);
    
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
