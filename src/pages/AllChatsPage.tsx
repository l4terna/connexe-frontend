import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Avatar,
  Badge,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Chip,
  Fab,
  Tabs,
  Tab,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import GroupIcon from '@mui/icons-material/Group';
import { useNavigate } from 'react-router-dom';

interface Chat {
  id: number;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  avatar: string;
  online: boolean;
  unread: number;
  type: 'personal' | 'group';
}

const AllChatsPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState(0);

  // Mock data for chats
  const mockChats: Chat[] = [
    {
      id: 1,
      name: '20= 5B@>2',
      lastMessage: '@825B! 0: 45;0?',
      lastMessageTime: '10:30',
      avatar: 'https://i.pravatar.cc/150?u=1',
      online: true,
      unread: 3,
      type: 'personal',
    },
    {
      id: 2,
      name: '0@8O 20=>20',
      lastMessage: 'Спасибо за помощь вчера',
      lastMessageTime: 'Вчера',
      avatar: 'https://i.pravatar.cc/150?u=2',
      online: false,
      unread: 0,
      type: 'personal',
    },
    {
      id: 3,
      name: 'Дизайн команда',
      lastMessage: 'Новый макет готов к ревью',
      lastMessageTime: '15:45',
      avatar: 'https://i.pravatar.cc/150?u=3',
      online: true,
      unread: 12,
      type: 'group',
    },
    {
      id: 4,
      name: 'Frontend разработчики',
      lastMessage: 'Деплой прошел успешно',
      lastMessageTime: '2 часа назад',
      avatar: 'https://i.pravatar.cc/150?u=4',
      online: true,
      unread: 5,
      type: 'group',
    },
    {
      id: 5,
      name: 'Александр Смирнов',
      lastMessage: 'Увидимся на встрече',
      lastMessageTime: '3 дня назад',
      avatar: 'https://i.pravatar.cc/150?u=5',
      online: false,
      unread: 0,
      type: 'personal',
    },
  ];

  const filteredChats = mockChats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (currentTab === 0) return matchesSearch;
    if (currentTab === 1) return matchesSearch && chat.type === 'personal';
    if (currentTab === 2) return matchesSearch && chat.type === 'group';
    return false;
  });

  const ChatItem = ({ chat }: { chat: Chat }) => (
    <ListItem
      disablePadding
      sx={{
        mb: 1,
        '& .MuiListItemButton-root': {
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            background: 'rgba(255,255,255,0.08)',
            transform: 'translateX(4px)',
            borderColor: 'rgba(194,24,91,0.5)',
          },
        },
      }}
    >
      <ListItemButton onClick={() => navigate(`/chat/${chat.id}`)}>
        <ListItemAvatar>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              chat.online ? (
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: '#4caf50',
                    border: '2px solid #0d0d1a',
                  }}
                />
              ) : null
            }
          >
            <Avatar
              src={chat.avatar}
              sx={{
                width: 56,
                height: 56,
                border: '2px solid',
                borderColor: chat.online ? 'rgba(76,175,80,0.5)' : 'rgba(255,255,255,0.1)',
              }}
            />
          </Badge>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                {chat.name}
              </Typography>
              {chat.type === 'group' && (
                <GroupIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
              )}
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', ml: 'auto' }}>
                {chat.lastMessageTime}
              </Typography>
            </Box>
          }
          secondary={
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '80%',
                }}
              >
                {chat.lastMessage}
              </Typography>
              {chat.unread > 0 && (
                <Chip
                  label={chat.unread}
                  size="small"
                  sx={{
                    height: 24,
                    minWidth: 24,
                    background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                />
              )}
            </Box>
          }
        />
      </ListItemButton>
    </ListItem>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 100%)',
        p: 4,
      }}
    >
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h3"
            sx={{
              color: '#fff',
              fontWeight: 700,
              mb: 2,
              background: 'linear-gradient(90deg, #C2185B 0%, #1976D2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Все чаты
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Ваши личные сообщения и групповые чаты
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={currentTab}
            onChange={(e, newValue) => setCurrentTab(newValue)}
            sx={{
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.6)',
                textTransform: 'none',
                fontSize: 16,
                '&.Mui-selected': {
                  color: '#FF69B4',
                },
              },
              '& .MuiTabs-indicator': {
                background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
                height: 3,
              },
            }}
          >
            <Tab label="Все чаты" />
            <Tab label="Личные" />
            <Tab label="Групповые" />
          </Tabs>
        </Box>

        {/* Search Bar */}
        <Box sx={{ mb: 4 }}>
          <TextField
            fullWidth
            placeholder="Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
                </InputAdornment>
              ),
              sx: {
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 2,
                color: '#fff',
                '& fieldset': { border: 'none' },
                '&:hover': {
                  background: 'rgba(255,255,255,0.08)',
                },
                '&.Mui-focused': {
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(194,24,91,0.5)',
                },
              },
            }}
          />
        </Box>

        {/* Chats List */}
        <List sx={{ px: 0 }}>
          {filteredChats.map((chat) => (
            <ChatItem key={chat.id} chat={chat} />
          ))}
        </List>

        {filteredChats.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
            }}
          >
            <ChatIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Чаты не найдены
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', mt: 1 }}>
              Попробуйте изменить параметры поиска
            </Typography>
          </Box>
        )}

        {/* Floating Action Button */}
        <Fab
          color="primary"
          onClick={() => navigate('/chats/new')}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
            color: '#fff',
            '&:hover': {
              background: 'linear-gradient(90deg, #FF1493 0%, #00BFFF 100%)',
            },
          }}
        >
          <AddIcon />
        </Fab>
      </Box>
    </Box>
  );
};

export default AllChatsPage;