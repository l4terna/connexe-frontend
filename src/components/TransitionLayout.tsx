import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';

interface TransitionLayoutProps {
  children: React.ReactNode;
}

export const TransitionLayout: React.FC<TransitionLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    setFadeIn(false);
    
    const timer = setTimeout(() => {
      setFadeIn(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        opacity: fadeIn ? 1 : 0.95,
        transition: 'opacity 0.15s ease-in-out',
        backgroundColor: '#181824',
      }}
    >
      {children}
    </Box>
  );
};