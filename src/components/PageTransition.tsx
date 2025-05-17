import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState('fadeIn');

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage('fadeOut');
    }
  }, [location, displayLocation]);

  useEffect(() => {
    if (transitionStage === 'fadeOut') {
      const timer = setTimeout(() => {
        setTransitionStage('fadeIn');
        setDisplayLocation(location);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [transitionStage, location]);

  return (
    <Box
      sx={{
        opacity: transitionStage === 'fadeIn' ? 1 : 0.7,
        transition: 'opacity 0.1s ease-in-out',
        minHeight: '100vh',
        backgroundColor: '#181824',
      }}
    >
      {children}
    </Box>
  );
};