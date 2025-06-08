import React from 'react';
import { Box, Typography, Fade } from '@mui/material';

interface NewMessagesSeparatorProps {
  show: boolean;
}

export const NewMessagesSeparator: React.FC<NewMessagesSeparatorProps> = ({ show }) => {
  return (
    <Fade in={show} timeout={{ enter: 300, exit: 800 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          my: 2,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 69, 180, 0.4) 20%, rgba(255, 69, 180, 0.7) 50%, rgba(255, 69, 180, 0.4) 80%, transparent 100%)',
            zIndex: 0
          }
        }}
      >
        <Box
          sx={{
            backgroundColor: 'rgba(30,30,47,0.95)',
            backdropFilter: 'blur(8px)',
            px: 3,
            py: 1.5,
            borderRadius: '20px',
            boxShadow: '0 4px 16px rgba(255, 69, 180, 0.3)',
            border: '2px solid rgba(255, 69, 180, 0.5)',
            zIndex: 1,
            animation: 'glow 2s ease-in-out infinite alternate',
            '@keyframes glow': {
              from: {
                boxShadow: '0 4px 16px rgba(255, 69, 180, 0.3)',
                borderColor: 'rgba(255, 69, 180, 0.5)'
              },
              to: {
                boxShadow: '0 6px 24px rgba(255, 69, 180, 0.5)',
                borderColor: 'rgba(255, 69, 180, 0.7)'
              }
            }
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: '#FF45B4',
              fontWeight: 700,
              fontSize: '0.9rem',
              letterSpacing: '0.5px',
              textShadow: '0 0 8px rgba(255, 69, 180, 0.6)'
            }}
          >
            Новые сообщения
          </Typography>
        </Box>
      </Box>
    </Fade>
  );
};