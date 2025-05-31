import React from 'react';
import { Box, Avatar, Badge, Tooltip, IconButton } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import ChatIcon from '@mui/icons-material/Chat';

interface PrivateChannelItemProps {
  channelId: number;
  channelName: string | null;
}

const PrivateChannelItem: React.FC<PrivateChannelItemProps> = ({ channelId, channelName }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if current route is this private channel
  const isActive = location.pathname === `/p-channel/${channelId}`;
  const displayName = channelName || `Чат #${channelId}`;
  
  const handleClick = () => {
    navigate(`/p-channel/${channelId}`);
  };
  
  return (
    <Box sx={{ position: 'relative' }}>
      <Tooltip title={displayName} placement="right">
        <IconButton
          onClick={handleClick}
          sx={{
            width: 50,
            height: 50,
            borderRadius: 3,
            color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
            background: isActive 
              ? 'linear-gradient(135deg, rgba(194,24,91,0.9) 0%, rgba(25,118,210,0.9) 100%)'
              : 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: isActive ? '0 8px 32px rgba(194,24,91,0.3)' : '0 4px 16px rgba(0,0,0,0.1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              background: isActive 
                ? 'linear-gradient(135deg, rgba(194,24,91,1) 0%, rgba(25,118,210,1) 100%)'
                : 'rgba(255,255,255,0.08)',
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            },
          }}
        >
          <Badge 
            badgeContent={0} 
            color="error"
            invisible={true}
          >
            <Avatar 
              src={undefined} 
              sx={{ 
                width: 30, 
                height: 30,
                border: '2px solid',
                borderColor: 'transparent',
                fontSize: '0.875rem',
              }} 
            >
              {channelName ? channelName[0].toUpperCase() : <ChatIcon sx={{ fontSize: 16 }} />}
            </Avatar>
          </Badge>
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default PrivateChannelItem;