import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, List, ListItem, ListItemText } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { User, useSearchUsersQuery } from '../../api/users';
import AppModal from '../AppModal';
import UserAvatar from '../UserAvatar';
import { debounce } from 'lodash';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import DOMPurify from 'dompurify';
import { useNavigate } from 'react-router-dom';

interface UserSearchModalProps {
  open: boolean;
  onClose: () => void;
  onStartChat?: (user: User) => void;
}

const searchSchema = Yup.object().shape({
  query: Yup.string()
    .transform(value => DOMPurify.sanitize(value?.trim() || ''))
    .max(50, 'Максимум 50 символов')
});

const UserSearchModal: React.FC<UserSearchModalProps> = ({ open, onClose, onStartChat }) => {
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedSetQuery = useCallback(
    debounce((value: string) => {
      const sanitized = DOMPurify.sanitize(value.trim());
      if (sanitized) {
        setDebouncedQuery(sanitized);
        setSearchResults([]);
      }
    }, 500),
    []
  );

  const { data: userResults, isFetching: isUserFetching } = useSearchUsersQuery(
    debouncedQuery,
    {
      skip: !debouncedQuery || !open,
      refetchOnMountOrArgChange: false
    }
  );

  useEffect(() => {
    if (userResults) {
      setSearchResults(userResults);
    }
  }, [userResults]);

  const handleUserClick = (user: User) => {
    if (onStartChat) {
      onStartChat(user);
    } else {
      // Default behavior - navigate to p-channel with user id
      navigate(`/p-channel/${user.id}`);
    }
    handleModalClose();
  };

  const handleModalClose = () => {
    onClose();
    setDebouncedQuery('');
    setSearchResults([]);
  };

  return (
    <AppModal
      open={open}
      onClose={handleModalClose}
      title="Найти пользователя"
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
                    placeholder="Введите имя пользователя..."
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
      
      {debouncedQuery && isUserFetching ? (
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
          {searchResults.map((user) => (
            <ListItem
              key={user.id}
              onClick={() => handleUserClick(user)}
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
                <Box sx={{ position: 'relative', mr: 1 }}>
                  <UserAvatar
                    src={user.avatar}
                    alt={user.login}
                    userId={user.id}
                    sx={{
                      width: 32,
                      height: 32,
                      background: 'linear-gradient(135deg, #C2185B 0%, #1976D2 100%)',
                    }}
                  />
                </Box>
                <ListItemText
                  primary={user.login}
                  primaryTypographyProps={{
                    sx: {
                      color: '#fff',
                      fontWeight: 500,
                    },
                  }}
                  secondary={user.status || 'Пользователь'}
                  secondaryTypographyProps={{
                    sx: {
                      color: '#B0B0B0',
                      fontSize: '0.8rem',
                    },
                  }}
                />
              </Box>
            </ListItem>
          ))}
        </List>
      ) : debouncedQuery ? (
        <Typography sx={{ color: '#B0B0B0', textAlign: 'center', mt: 3 }}>
          Ничего не найдено
        </Typography>
      ) : (
        <Typography sx={{ color: '#B0B0B0', textAlign: 'center', mt: 3 }}>
          Введите имя пользователя для поиска
        </Typography>
      )}
    </AppModal>
  );
};

export default UserSearchModal;