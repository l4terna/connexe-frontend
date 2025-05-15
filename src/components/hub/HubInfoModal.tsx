import React from 'react';
import { Box, Typography, IconButton, Paper, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AppModal from '../common/AppModal';

interface HubInfoModalProps {
  open: boolean;
  onClose: () => void;
  hub: {
    id: number;
    name: string;
    description?: string;
    avatar?: string;
  };
  onSearchClose: () => void;
}

const HubInfoModal: React.FC<HubInfoModalProps> = ({ open, onClose, hub, onSearchClose }) => {
  const handleJoinHub = () => {
    // TODO: Implement join hub functionality
    onSearchClose();
  };

  return (
    <AppModal open={open} onClose={onClose}>
      <Paper
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: '500px',
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 3,
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'text.secondary',
          }}
        >
          <CloseIcon />
        </IconButton>

        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {hub.avatar && (
              <Box
                component="img"
                src={hub.avatar}
                alt={hub.name}
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            )}
            <Box>
              <Typography variant="h6" component="h2">
                {hub.name}
              </Typography>
              {hub.description && (
                <Typography variant="body2" color="text.secondary">
                  {hub.description}
                </Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <IconButton
              onClick={onClose}
              sx={{
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
              }}
            >
              <CloseIcon />
            </IconButton>
            <IconButton
              onClick={handleJoinHub}
              sx={{
                color: 'primary.main',
                '&:hover': { color: 'primary.dark' },
              }}
            >
              Join Hub
            </IconButton>
          </Box>
        </Stack>
      </Paper>
    </AppModal>
  );
};

export default HubInfoModal; 