import React, { Suspense } from 'react';
import { Box } from '@mui/material';
import PersistLoader from '@/components/PersistLoader';

interface RouteTransitionProps {
  children: React.ReactNode;
}

export const RouteTransition: React.FC<RouteTransitionProps> = ({ children }) => {
  return (
    <Suspense fallback={<PersistLoader />}>
      <Box
        sx={{
          minHeight: '100vh',
          transition: 'opacity 0.15s ease-in-out',
          opacity: 1,
        }}
      >
        {children}
      </Box>
    </Suspense>
  );
};