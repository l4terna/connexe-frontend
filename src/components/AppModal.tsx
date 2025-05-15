import React from 'react';
import { Box, IconButton, Typography, Fade } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface AppModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  sx?: any;
}

const AppModal: React.FC<AppModalProps> = ({ open, onClose, title, maxWidth = 'sm', children, sx }) => {
  return (
    <Fade in={open} timeout={300}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1300,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      >
        <Box
          sx={{
            position: 'relative',
            width: '35%',
            minWidth: '300px',
            maxWidth: {
              xs: '90%',
              sm: '350px',
              md: '400px',
              lg: '450px',
              xl: '500px'
            }[maxWidth],
            maxHeight: '82vh',
            bgcolor: 'rgba(30, 30, 47, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            margin: 'auto',
            padding: '16px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                marginBottom: '16px',
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                }}
              >
                {title}
              </Typography>
              <IconButton
                onClick={onClose}
                sx={{
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          )}
          <Box sx={{ p: 2, overflowY: 'auto' }}>{children}</Box>
        </Box>
      </Box>
    </Fade>
  );
};

export default AppModal; 