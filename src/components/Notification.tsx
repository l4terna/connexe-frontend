import { Snackbar, Alert } from '@mui/material';

interface NotificationProps {
  message: string;
  open: boolean;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, open, onClose }) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={3000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{
        '& .MuiSnackbar-root': {
          top: '24px',
          right: '24px',
        }
      }}
    >
      <Alert 
        onClose={onClose} 
        severity="success" 
        sx={{ 
          width: '100%',
          bgcolor: 'rgba(30,30,47,0.95)',
          color: '#fff',
          '& .MuiAlert-icon': {
            color: '#4caf50'
          },
          '& .MuiAlert-message': {
            color: '#fff'
          },
          '& .MuiAlert-action': {
            color: '#fff'
          },
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default Notification; 