import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const PersistLoader: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        gap: 3,
      }}
    >
      <CircularProgress 
        size={60}
        sx={{
          color: '#FF69B4',
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          },
        }}
      />
      <Typography 
        variant="h6" 
        sx={{ 
          color: '#fff',
          fontWeight: 500,
          letterSpacing: '0.5px',
        }}
      >
        Loading...
      </Typography>
    </Box>
  );
};

export default PersistLoader;