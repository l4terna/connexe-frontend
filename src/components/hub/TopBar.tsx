import React from 'react';
import { Box, Typography, IconButton, Stack, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';

interface TopBarProps {
  hubName: string;
  onSearchClick: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ hubName, onSearchClick }) => {
  return (
    <Box
      sx={{
        height: 64,
        px: 4,
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(30,30,47,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 2px 8px 0 rgba(30,30,47,0.15)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 900,
          fontSize: '2rem',
          color: '#C2185B',
          letterSpacing: 2,
          lineHeight: 1.1,
        }}
      >
        {hubName || 'Hub'}
      </Typography>
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" spacing={1}>
        <Tooltip title="Search">
          <IconButton sx={{ color: '#1E90FF' }} onClick={onSearchClick}>
            <SearchIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Notifications">
          <IconButton sx={{ color: '#FF69B4' }}>
            <NotificationsIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton sx={{ color: '#FF69B4' }}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};

export default TopBar; 