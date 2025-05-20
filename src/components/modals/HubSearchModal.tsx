import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { Hub } from '../../api/hubs';
import { useGetHubsQuery } from '../../api/hubs';
import AppModal from '../AppModal';
import { debounce } from 'lodash';
import HubJoinModal from '../hub/HubJoinModal';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import DOMPurify from 'dompurify';

interface HubSearchModalProps {
  open: boolean;
  onClose: () => void;
  onCreateHub?: () => void;
}

const searchSchema = Yup.object().shape({
  query: Yup.string()
    .transform(value => DOMPurify.sanitize(value?.trim() || ''))
    .max(50, 'Максимум 50 символов')
});

const HubSearchModal: React.FC<HubSearchModalProps> = ({ open, onClose, onCreateHub }) => {
  const [searchResults, setSearchResults] = useState<Hub[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedSetQuery = useCallback(
    debounce((value: string) => {
      const sanitized = DOMPurify.sanitize(value.trim());
      if (sanitized) {
        setDebouncedQuery(sanitized);
        setPage(0);
        setSearchResults([]);
      }
    }, 500),
    []
  );

  const { data: hubResults, isFetching: isHubFetching } = useGetHubsQuery({
    name: debouncedQuery,
    page,
    size: 20,
    sort: 'createdAt,desc'
  }, {
    skip: !debouncedQuery || !open,
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
    setSearchResults(prev => page === 0 ? (hubResults || []) : [...prev, ...(hubResults || [])]);
  }, [hubResults, page]);

  const handleHubClick = (hub: Hub) => {
    setSelectedHub(hub);
  };

  const handleModalClose = () => {
    onClose();
    setDebouncedQuery('');
    setSearchResults([]);
    setPage(0);
  };

  return (
    <>
      <AppModal
        open={open}
        onClose={handleModalClose}
        title="Найти хаб"
        extraAction={onCreateHub ? {
          icon: <AddCircleOutlineIcon />,
          onClick: onCreateHub,
          tooltip: "Создать новый хаб"
        } : undefined}
      >
        <Formik
          initialValues={{ query: '' }}
          validationSchema={searchSchema}
          onSubmit={() => {}}
        >
          {({ values, errors, touched, handleChange }) => (
            <Form>
              <Box sx={{ position: 'relative', mb: 2 }}>
                <Field name="query">
                  {({ field }: any) => (
                    <input
                      {...field}
                      placeholder="Введите название хаба..."
                      autoFocus
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        handleChange(e);
                        debouncedSetQuery(e.target.value);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        paddingLeft: '48px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '16px',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      }}
                    />
                  )}
                </Field>
                <SearchIcon sx={{ 
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  color: '#1E90FF',
                  transform: 'translateY(-50%)'
                }} />
              </Box>
              {errors.query && touched.query && (
                <Typography sx={{ color: '#ff4444', fontSize: '12px', mt: 1 }}>
                  {errors.query}
                </Typography>
              )}
            </Form>
          )}
        </Formik>
        
        {debouncedQuery && isHubFetching && page === 0 ? (
          <Typography sx={{ color: '#B0B0B0', textAlign: 'center', mt: 3 }}>
            Поиск...
          </Typography>
        ) : debouncedQuery && searchResults.length > 0 ? (
          <List
            ref={listRef}
            sx={{
              maxHeight: '400px',
              overflow: 'auto',
              mt: 2,
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
            {searchResults.map((hub) => (
              <ListItem
                key={hub.id}
                onClick={() => handleHubClick(hub)}
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
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: 3,
                      background: hub.avatar 
                        ? `url(${hub.avatar}) center/cover`
                        : 'linear-gradient(135deg, rgba(194,24,91,0.2) 0%, rgba(25,118,210,0.2) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 18,
                      color: '#fff',
                      mr: 2,
                      border: '2px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      backdropFilter: hub.avatar ? 'none' : 'blur(10px)',
                    }}
                  >
                    {!hub.avatar && hub.name.charAt(0).toUpperCase()}
                  </Box>
                  <ListItemText
                    primary={hub.name}
                    primaryTypographyProps={{
                      sx: {
                        color: '#fff',
                        fontWeight: 500,
                      },
                    }}
                    secondary={String(hub.type) === '0' ? 'Приватный' : 'Публичный'}
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
            {isHubFetching && page > 0 && (
              <Typography sx={{ color: '#B0B0B0', textAlign: 'center', py: 2 }}>
                Загрузка...
              </Typography>
            )}
          </List>
        ) : debouncedQuery ? (
          <Typography sx={{ color: '#B0B0B0', textAlign: 'center', mt: 3 }}>
            Ничего не найдено
          </Typography>
        ) : (
          <Typography sx={{ color: '#B0B0B0', textAlign: 'center', mt: 3 }}>
            Введите название хаба для поиска
          </Typography>
        )}
      </AppModal>

      {selectedHub && (
        <HubJoinModal
          open={!!selectedHub}
          onClose={() => setSelectedHub(null)}
          hub={selectedHub}
          onSuccess={handleModalClose}
        />
      )}
    </>
  );
};

export default HubSearchModal;