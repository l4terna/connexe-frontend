import React from 'react';
import { Box, Typography, Checkbox, Button } from '@mui/material';
import AppModal from '../../../AppModal';
import { ExtendedMessage } from '../types/message';

interface DeleteMessageDialogProps {
  open: boolean;
  messageToDelete: number | null;
  deleteForEveryone: boolean;
  canManageMessages: boolean;
  messages: ExtendedMessage[];
  userId: number;
  onClose: () => void;
  onConfirm: () => void;
  onDeleteForEveryoneChange: (value: boolean) => void;
}

/**
 * Dialog component for confirming message deletion
 */
const DeleteMessageDialog: React.FC<DeleteMessageDialogProps> = ({
  open,
  messageToDelete,
  deleteForEveryone,
  canManageMessages,
  messages,
  userId,
  onClose,
  onConfirm,
  onDeleteForEveryoneChange,
}) => {
  const message = messageToDelete ? messages.find(msg => msg.id === messageToDelete) : null;
  const isOwnMessage = message && message.author.id === userId;
  const showDeleteForEveryoneOption = isOwnMessage || canManageMessages;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Удалить сообщение"
    >
      <Box sx={{ 
        p: 2, 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {messageToDelete && (
          <Box sx={{ mb: 3, width: '100%', maxWidth: 300 }}>
            {showDeleteForEveryoneOption && (
              <Box 
                onClick={() => onDeleteForEveryoneChange(!deleteForEveryone)}
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 1.5,
                  mb: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  backgroundColor: deleteForEveryone ? 'rgba(255, 61, 113, 0.1)' : 'rgba(0,0,0,0.15)',
                  border: `1px solid ${deleteForEveryone ? 'rgba(255, 61, 113, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: deleteForEveryone ? 'rgba(255, 61, 113, 0.15)' : 'rgba(0,0,0,0.2)',
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Checkbox
                    checked={deleteForEveryone}
                    onChange={(e) => onDeleteForEveryoneChange(e.target.checked)}
                    sx={{ 
                      color: 'rgba(255,255,255,0.5)',
                      p: 0.5,
                      mr: 1,
                      '&.Mui-checked': {
                        color: '#FF3D71',
                      }
                    }}
                  />
                  <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    Удалить у всех
                  </Typography>
                </Box>
                
                <Typography variant="body2" sx={{ 
                  color: 'rgba(255,255,255,0.6)', 
                  fontStyle: 'italic',
                  fontSize: '0.75rem',
                  textAlign: 'center'
                }}>
                  {deleteForEveryone 
                    ? "Сообщение исчезнет у всех участников чата" 
                    : "Сообщение останется видимым для других"}
                </Typography>
              </Box>
            )}
            
            <Typography sx={{ 
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.75rem',
              textAlign: 'center',
              mt: 1
            }}>
              {!showDeleteForEveryoneOption 
                ? "Сообщение будет скрыто только для вас" 
                : deleteForEveryone 
                  ? "" 
                  : "Сообщение будет скрыто только в вашем интерфейсе"}
            </Typography>
          </Box>
        )}
        
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={onClose}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              borderColor: 'rgba(255,255,255,0.2)',
              borderRadius: 2,
              px: 3,
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.4)',
                backgroundColor: 'rgba(255,255,255,0.05)',
              },
            }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={onConfirm}
            sx={{
              backgroundColor: '#FF3D71',
              color: '#fff',
              borderRadius: 2,
              px: 3,
              '&:hover': {
                backgroundColor: '#FF1744',
              },
            }}
          >
            Удалить
          </Button>
        </Box>
      </Box>
    </AppModal>
  );
};

export default DeleteMessageDialog;
