import React from 'react';
import { Box, IconButton, Typography, Fade, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface AppModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  sx?: any;
  extraAction?: {
    icon: React.ReactNode;
    onClick: () => void;
    tooltip?: string;
  };
}

const AppModal: React.FC<AppModalProps> = ({ open, onClose, title, children, sx, extraAction }) => {
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
            width: '500px',
            maxWidth: '90%',
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
            ...sx
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
              <Box sx={{ display: 'flex', gap: 1 }}>
                {extraAction && (
                  <Tooltip title={extraAction.tooltip}>
                    <IconButton
                      onClick={extraAction.onClick}
                      sx={{
                        background: 'linear-gradient(135deg, #FF69B4 0%, #1E90FF 100%)',
                        color: '#fff',
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        p: 0.5,
                        boxShadow: '0 2px 8px rgba(255,105,180,0.3)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #FF1493 0%, #00BFFF 100%)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 12px rgba(255,105,180,0.4)',
                        },
                      }}
                    >
                      {extraAction.icon}
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Закрыть">
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
                </Tooltip>
              </Box>
            </Box>
          )}
          <Box sx={{ p: 2, overflowY: 'auto' }}>{children}</Box>
        </Box>
      </Box>
    </Fade>
  );
};

export default AppModal; 