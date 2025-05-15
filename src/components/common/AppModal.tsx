import React from 'react';
import { Modal, Box } from '@mui/material';

interface AppModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const AppModal: React.FC<AppModalProps> = ({ open, onClose, children }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: '600px',
          outline: 'none',
        }}
      >
        {children}
      </Box>
    </Modal>
  );
};

export default AppModal; 