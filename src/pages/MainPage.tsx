import React, { useState } from 'react';
import { Box, Typography, IconButton,  Tooltip} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SearchModal from '../components/SearchModal';
import { useCreateHubMutation, useGetHubsQuery } from '../api/hubs';
import { useAppSelector } from '../hooks/redux';
import { useGetCurrentUserQuery } from '../api/users';
import { useDispatch } from 'react-redux';
import { setUser } from '../store/userSlice';

const accentGradient = 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)';
const mainBg = '#181824';

// Приветственные сообщения
const greetings = [
  'Вау',
  'Ayo',
  'Yo-yo',
  'Хай',
  'Хаюшки',
  'Вот это встреча',
  'Легенда вернулась',
  'Воу-воу',
  'Вижу тебя',
  'Вот это да',
  'Залетай',
  'Приветик',
  'Опа',
  'Хэллоу',
  'Мяу',
  'Бесконечного свэга',
];

const getRandomGreeting = () => {
  return greetings[Math.floor(Math.random() * greetings.length)];
};

const MainPage: React.FC = () => {
  const dispatch = useDispatch();
  const currentUser = useAppSelector(state => state.user.currentUser);
  const { data: currentUserData, isLoading: isLoadingUser } = useGetCurrentUserQuery(undefined, {
    skip: !!currentUser // Skip if we already have user data
  });
  
  const [searchOpen, setSearchOpen] = useState(false);
  const [greeting] = useState(() => getRandomGreeting()); // Set greeting once on mount
  const { refetch: refetchHubs } = useGetHubsQuery({});
  const [createHub] = useCreateHubMutation();
  
  // Update Redux state if we fetched user data
  React.useEffect(() => {
    if (currentUserData && !currentUser) {
      dispatch(setUser(currentUserData));
    }
  }, [currentUserData, currentUser, dispatch]);
  
  const displayUser = currentUser || currentUserData;
  
  // Show loading state while user data is being loaded
  if (isLoadingUser || (!currentUser && !currentUserData)) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: mainBg }}>
        <Typography variant="h6" sx={{ color: '#fff' }}>Loading...</Typography>
      </Box>
    );
  }

  return (
    <>
      {/* Top Bar */}
      <Box
        sx={{
          height: 64,
          px: 4,
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(30,30,47,0.95)',
          borderBottom: '1px solid #23233a',
          boxShadow: '0 2px 8px 0 rgba(30,30,47,0.15)',
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            background: accentGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: 1,
          }}
        >
          {greeting}, {displayUser?.login || 'User'}!
        </Typography>
        <Box sx={{ flex: 1 }} />
        {/* Search only */}
        <Tooltip title="Поиск пользователей или хабов">
          <IconButton sx={{ color: '#1E90FF' }} onClick={() => setSearchOpen(true)}>
            <SearchIcon />
          </IconButton>
        </Tooltip>
      </Box>
      {/* Content Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at 60% 40%, rgba(255,105,180,0.08) 0%, rgba(30,144,255,0.08) 100%)',
        }}
      >
        <Box
          sx={{
            p: 5,
            borderRadius: 4,
            background: 'rgba(30,30,47,0.85)',
            boxShadow: '0 4px 32px 0 rgba(255,105,180,0.08)',
            minWidth: 340,
            textAlign: 'center',
          }}
        >
          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>
            🔥 Вау, ты тут!
          </Typography>
          <Typography variant="body1" sx={{ color: '#B0B0B0' }}>
            Это твой личный уголок в цифровом пространстве!<br />
            Чатики, мемасики и всякие фишки ждут тебя.<br />
            Залетай в хабы, вайбуй с друзьями и будь на чиле! 😎
          </Typography>
        </Box>
      </Box>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};

export default MainPage;