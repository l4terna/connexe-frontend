import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  Fab,
  Skeleton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router-dom';
import { useGetHubsQuery } from '../api/hubs';
import { useAppSelector } from '../hooks/redux';

const AllHubsPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const user = useAppSelector((state) => state.user.currentUser);
  
  const { data: hubsData = [], isLoading } = useGetHubsQuery({
    page: 0,
    size: 100,
    sort: 'createdAt,desc'
  });

  const filteredHubs = hubsData.filter(hub => 
    hub.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const HubCard = ({ hub }: { hub: any }) => (
    <Card
      sx={{
        height: '100%',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 40px rgba(194,24,91,0.3)',
          borderColor: 'rgba(194,24,91,0.5)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              backgroundColor: 'rgba(194,24,91,0.2)',
              border: '2px solid rgba(194,24,91,0.5)',
              mr: 2,
            }}
          >
            <Typography sx={{ fontSize: 24, fontWeight: 700 }}>
              {hub.name[0].toUpperCase()}
            </Typography>
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
              {hub.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {hub.type === '1' ? (
                <Chip
                  icon={<PublicIcon sx={{ fontSize: 16 }} />}
                  label="Публичный"
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(76,175,80,0.2)',
                    color: '#4caf50',
                    border: '1px solid rgba(76,175,80,0.5)',
                  }}
                />
              ) : (
                <Chip
                  icon={<LockIcon sx={{ fontSize: 16 }} />}
                  label="Приватный"
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255,152,0,0.2)',
                    color: '#ff9800',
                    border: '1px solid rgba(255,152,0,0.5)',
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>

        <Typography
          variant="body2"
          sx={{
            color: 'rgba(255,255,255,0.7)',
            mb: 2,
            minHeight: 40,
          }}
        >
          {hub.description || 'Добро пожаловать в наш хаб!'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <PeopleIcon sx={{ fontSize: 18, mr: 0.5, color: 'rgba(255,255,255,0.5)' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              {hub.member_count || 0} участников
            </Typography>
          </Box>
        </Box>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        {hub.is_member ? (
          <Button
            variant="contained"
            fullWidth
            onClick={() => navigate(`/hub/${hub.id}`)}
            sx={{
              background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
              color: '#fff',
              '&:hover': {
                background: 'linear-gradient(90deg, #FF1493 0%, #00BFFF 100%)',
              },
            }}
          >
            Перейти
          </Button>
        ) : (
          <Button
            variant="outlined"
            fullWidth
            onClick={() => navigate(`/hub/${hub.id}`)}
            sx={{
              borderColor: 'rgba(194,24,91,0.5)',
              color: '#C2185B',
              '&:hover': {
                borderColor: '#C2185B',
                backgroundColor: 'rgba(194,24,91,0.1)',
              },
            }}
          >
            Присоединиться
          </Button>
        )}
      </CardActions>
    </Card>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 100%)',
        p: 4,
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
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
            Все хабы
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Найдите сообщество по интересам или создайте свое
          </Typography>
        </Box>

        {/* Search Bar */}
        <Box sx={{ mb: 4 }}>
          <TextField
            fullWidth
            placeholder="Поиск хабов..."
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

        {/* Hubs Grid */}
        <Grid container spacing={3}>
          {isLoading ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card
                  sx={{
                    height: 250,
                    background: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Skeleton variant="circular" width={56} height={56} sx={{ mr: 2 }} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="80%" height={28} />
                        <Skeleton variant="text" width="40%" height={20} />
                      </Box>
                    </Box>
                    <Skeleton variant="text" width="100%" height={20} />
                    <Skeleton variant="text" width="90%" height={20} />
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Skeleton variant="rectangular" width="100%" height={36} sx={{ borderRadius: 1 }} />
                  </CardActions>
                </Card>
              </Grid>
            ))
          ) : (
            filteredHubs.map((hub) => (
              <Grid item xs={12} sm={6} md={4} key={hub.id}>
                <HubCard hub={hub} />
              </Grid>
            ))
          )}
        </Grid>

        {/* Floating Action Button */}
        <Fab
          color="primary"
          onClick={() => navigate('/hubs/new')}
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

export default AllHubsPage;