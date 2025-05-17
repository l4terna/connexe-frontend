import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Paper, Tabs, Tab, IconButton, List, ListItem, ListItemText, ListItemAvatar, Avatar } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ChatIcon from '@mui/icons-material/Chat';
import { Hub } from '../api/hubs';
import { User, useSearchUsersQuery } from '../api/users';
import { useGetHubsQuery } from '../api/hubs';
import Input from './common/Input';
import AppModal from './AppModal';
import { debounce } from 'lodash';
import HubInfoModal from './hub/HubInfoModal';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ open, onClose }) => {
  const [tab, setTab] = useState(0);
  const [searchResults, setSearchResults] = useState<(Hub | User)[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedSetQuery = useCallback(
    debounce((value: string) => {
      setDebouncedQuery(value);
      setPage(0);
      setSearchResults([]);
    }, 500),
    []
  );

  useEffect(() => {
    debouncedSetQuery(query);
    return () => {
      debouncedSetQuery.cancel();
    };
  }, [query, debouncedSetQuery]);

  const { data: userResults, isFetching: isUserFetching } = useSearchUsersQuery(
    debouncedQuery.trim(),
    {
      skip: !debouncedQuery.trim() || tab !== 0,
      refetchOnMountOrArgChange: false
    }
  );

  const { data: hubResults, isFetching: isHubFetching } = useGetHubsQuery({
    name: debouncedQuery.trim(),
    page,
    size: 20,
    sort: 'createdAt,desc'
  }, {
    skip: !debouncedQuery.trim() || tab !== 1,
    refetchOnMountOrArgChange: false
  });

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      setPage(prev => prev + 1);
    }
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.addEventListener('scroll', handleScroll);
      return () => list.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    if (tab === 0) {
      setSearchResults(prev => page === 0 ? (userResults || []) : [...prev, ...(userResults || [])]);
    } else {
      setSearchResults(prev => page === 0 ? (hubResults || []) : [...prev, ...(hubResults || [])]);
    }
  }, [tab, userResults, hubResults, page]);

  const isLoading = tab === 0 ? isUserFetching : isHubFetching;

  const handleHubClick = (hub: Hub) => {
    setSelectedHub(hub);
  };

  return (
    <>
      <AppModal
        open={open}
        onClose={onClose}
        
        title="Поиск"
      >
        <Tabs
          value={tab}
          onChange={(_, v) => {
            setTab(v);
            setSearchResults([]);
            setQuery('');
            setDebouncedQuery('');
            setPage(0);
          }}
          centered
          sx={{
            mb: 3,
            '& .MuiTabs-indicator': {
              display: 'none'
            },
            '& .MuiTab-root': {
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
                opacity: 0,
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                transform: 'scaleX(0)',
              },
              '&.Mui-selected::after': {
                opacity: 1,
                transform: 'scaleX(1)',
              }
            }
          }}
        >
          <Tab 
            label="Пользователи" 
            sx={{ 
              color: tab === 0 ? '#FF69B4' : '#B0B0B0', 
              fontWeight: 700,
            }} 
          />
          <Tab 
            label="Хабы" 
            sx={{ 
              color: tab === 1 ? '#1E90FF' : '#B0B0B0', 
              fontWeight: 700,
            }} 
          />
        </Tabs>
        <Input
          name="query"
          placeholder={tab === 0 ? "Введите логин пользователя..." : "Введите название хаба..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <SearchIcon sx={{ color: tab === 0 ? '#FF69B4' : '#1E90FF', mr: 1 }} />
            ),
          }}
        />
        {isLoading && page === 0 ? (
          <Typography sx={{ color: '#B0B0B0', textAlign: 'center', mt: 3 }}>
            Поиск...
          </Typography>
        ) : searchResults.length > 0 ? (
          <List
            ref={listRef}
            sx={{
              maxHeight: '400px',
              overflow: 'auto',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '4px',
                '&:hover': {
                  background: 'rgba(255,255,255,0.3)',
                },
              },
            }}
          >
            {searchResults.map((item) => (
              <ListItem
                key={item.id}
                onClick={() => tab === 1 && handleHubClick(item as Hub)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 1,
                  },
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <ListItemAvatar>
                    <Avatar
                      src={item.avatar}
                      sx={{
                        bgcolor: tab === 0 ? 'rgba(255,105,180,0.2)' : 'rgba(30,144,255,0.2)',
                        color: tab === 0 ? '#FF69B4' : '#1E90FF',
                      }}
                    >
                      {tab === 0 
                        ? (item as User).login.charAt(0).toUpperCase() 
                        : (item as Hub).name.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={tab === 0 
                      ? (item as User).login 
                      : (item as Hub).name}
                    primaryTypographyProps={{
                      sx: {
                        color: '#fff',
                        fontWeight: 500,
                      },
                    }}
                    secondary={tab === 0
                      ? (item as User).status || ''
                      : String((item as Hub).type) === '0' ? 'Приватный' : 'Публичный'}
                    secondaryTypographyProps={{
                      sx: {
                        color: '#B0B0B0',
                        fontSize: '0.75rem',
                      },
                    }}
                  />
                </Box>
              </ListItem>
            ))}
            {isLoading && page > 0 && (
              <Typography sx={{ color: '#B0B0B0', textAlign: 'center', py: 2 }}>
                Загрузка...
              </Typography>
            )}
          </List>
        ) : query ? (
          <Typography sx={{ color: '#B0B0B0', textAlign: 'center', mt: 3 }}>
            Ничего не найдено
          </Typography>
        ) : (
          <Typography sx={{ color: '#B0B0B0', textAlign: 'center', mt: 3 }}>
            {tab === 0 ? 'Введите логин пользователя для поиска' : 'Введите название хаба для поиска'}
          </Typography>
        )}
      </AppModal>

      {selectedHub && (
        <HubInfoModal
          open={!!selectedHub}
          onClose={() => setSelectedHub(null)}
          hub={selectedHub}
          onSearchClose={onClose}
        />
      )}
    </>
  );
};

export default SearchModal; 