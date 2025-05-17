import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Stack, 
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useJoinHubMutation } from '@/api/hubs';
import { Hub } from '@/api/hubs';
import AppModal from '../AppModal';
import PeopleIcon from '@mui/icons-material/People';
import { useNotification } from '@/context/NotificationContext';
import { gradients } from '@/theme/theme';

interface HubJoinModalProps {
  open: boolean;
  onClose: () => void;
  hub: Hub;
  onSuccess?: () => void;
}

const HubJoinModal: React.FC<HubJoinModalProps> = ({ 
  open, 
  onClose, 
  hub, 
  onSuccess 
}) => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [joinHub, { isLoading }] = useJoinHubMutation();
  const [error, setError] = useState<string | null>(null);

  const handleJoinHub = async () => {
    try {
      setError(null);
      await joinHub(hub.id).unwrap();
      
      // Show success notification
      showNotification({
        severity: 'success',
        message: `Вы успешно присоединились к хабу ${hub.name}`
      });

      // Close modal
      onClose();
      
      // Call optional success callback
      if (onSuccess) {
        onSuccess();
      }
      
      // Navigate to the hub
      navigate(`/hubs/${hub.id}`);
    } catch (error: any) {
      console.error('Failed to join hub:', error);
      
      // Check for specific error types
      if (error.data?.type === 'ALREADY_EXISTS' || 
          error.data?.message?.toLowerCase().includes('already exists') ||
          error.data?.message?.toLowerCase().includes('already a member')) {
        showNotification({
          severity: 'info',
          message: 'Вы уже состоите в этом хабе'
        });
        onClose();
        return;
      }
      
      setError(error.data?.message || 'Не удалось присоединиться к хабу');
    }
  };

  return (
    <AppModal 
      open={open} 
      onClose={onClose}
      title="Присоединиться к хабу"
      sx={{
        '& .MuiDialog-paper': {
          background: 'linear-gradient(135deg, rgba(30,30,47,0.98) 0%, rgba(25,25,38,0.98) 100%)',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          backdropFilter: 'blur(10px)',
        }
      }}
    >
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: 3,
              background: hub.avatar 
                ? `url(${hub.avatar}) center/cover`
                : 'linear-gradient(135deg, rgba(194,24,91,0.2) 0%, rgba(25,118,210,0.2) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 24,
              color: '#fff',
              border: '2px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              backdropFilter: hub.avatar ? 'none' : 'blur(10px)',
            }}
          >
            {!hub.avatar && hub.name.charAt(0).toUpperCase()}
          </Box>
          <Box flex={1}>
            <Typography 
              variant="h5" 
              sx={{ 
                color: '#fff', 
                fontWeight: 'bold',
                mb: 0.5
              }}
            >
              {hub.name}
            </Typography>
            {hub.member_count !== undefined && (
              <Chip
                icon={<PeopleIcon />}
                label={`${hub.member_count} ${hub.member_count === 1 ? 'участник' : 'участников'}`}
                size="small"
                sx={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#B0B0B0',
                  border: '1px solid rgba(255,255,255,0.1)',
                  '& .MuiChip-icon': {
                    color: '#B0B0B0',
                  }
                }}
              />
            )}
          </Box>
        </Box>

        {hub.type !== undefined && (
          <Box>
            <Typography 
              variant="body2" 
              sx={{ color: '#B0B0B0', mb: 1 }}
            >
              Тип хаба
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ color: '#fff' }}
            >
              {hub.type === 1 ? 'Публичный' : 'Приватный'}
            </Typography>
          </Box>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        {error && (
          <Typography 
            sx={{ 
              color: '#ff4444', 
              fontSize: '14px',
              textAlign: 'center',
              p: 2,
              background: 'rgba(255,68,68,0.1)',
              borderRadius: 2,
              border: '1px solid rgba(255,68,68,0.2)'
            }}
          >
            {error}
          </Typography>
        )}

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={isLoading}
            sx={{
              color: '#B0B0B0',
              borderColor: 'rgba(255,255,255,0.2)',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.05)',
              }
            }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleJoinHub}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : null}
            sx={{
              background: gradients.neon,
              color: '#fff',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              '&:hover': {
                background: gradients.hover,
                boxShadow: '0 4px 15px rgba(255,105,180,0.4)',
              },
              '&:disabled': {
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.3)',
              }
            }}
          >
            {isLoading ? 'Присоединение...' : 'Присоединиться'}
          </Button>
        </Stack>
      </Stack>
    </AppModal>
  );
};

export default HubJoinModal;