import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, IconButton, Tooltip } from '@mui/material';
import ReplyIcon from '@mui/icons-material/Reply';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

interface MessageActionsPortalProps {
  targetElement: HTMLElement | null;
  messageId: number;
  authorId: number;
  currentUserId: number;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onPortalMouseEnter?: () => void;
  onPortalMouseLeave?: () => void;
}

const MessageActionsPortal: React.FC<MessageActionsPortalProps> = ({
  targetElement,
  messageId,
  authorId,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onClose,
  onPortalMouseEnter,
  onPortalMouseLeave,
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!targetElement) return;

    const updatePosition = () => {
      const rect = targetElement.getBoundingClientRect();
      const scrollContainer = targetElement.closest('.messages-container');
      
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        
        // Calculate position relative to viewport
        const top = rect.top - 38; // 38px above the message
        const left = rect.left + rect.width / 2; // Center horizontally
        
        // Check if actions panel would be outside viewport
        if (top < containerRect.top) {
          // If too high, position below the message instead
          setPosition({ 
            top: rect.bottom + 8, 
            left 
          });
        } else {
          setPosition({ top, left });
        }
      }
    };

    updatePosition();

    // Update position on scroll
    const scrollContainer = targetElement.closest('.messages-container');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updatePosition);
      return () => scrollContainer.removeEventListener('scroll', updatePosition);
    }
  }, [targetElement]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (portalRef.current && !portalRef.current.contains(event.target as Node) &&
          targetElement && !targetElement.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [targetElement, onClose]);

  if (!targetElement) return null;

  return createPortal(
    <Box
      ref={portalRef}
      onMouseEnter={onPortalMouseEnter}
      onMouseLeave={onPortalMouseLeave}
      sx={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 1,
        zIndex: 1300,
        background: 'rgba(20,20,35,0.85)',
        borderRadius: 2,
        boxShadow: '0 8px 24px 0 rgba(0,0,0,0.3), 0 0 12px 0 rgba(149,128,255,0.2)',
        px: 1.5,
        py: 0.5,
        border: '1px solid rgba(149,128,255,0.25)',
        backdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.2s ease-out',
        '@keyframes fadeIn': {
          from: {
            opacity: 0,
            transform: 'translateX(-50%) translateY(-10px)',
          },
          to: {
            opacity: 1,
            transform: 'translateX(-50%) translateY(0)',
          },
        },
      }}
    >
      <Tooltip title="Ответить" enterDelay={1000} placement="top">
        <IconButton 
          size="small" 
          onClick={onReply} 
          sx={{ 
            color: '#00FFBA', 
            transition: 'all 0.2s ease',
            padding: '6px',
            backgroundColor: 'rgba(0, 255, 186, 0.12)',
            '&:hover': { 
              color: '#00FFBA',
              backgroundColor: 'rgba(0, 255, 186, 0.25)',
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 8px rgba(0, 255, 186, 0.3)'
            } 
          }}
        >
          <ReplyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      {authorId === currentUserId && (
        <Tooltip title="Редактировать" enterDelay={1000} placement="top">
          <IconButton 
            size="small" 
            onClick={onEdit} 
            sx={{ 
              color: '#00CFFF', 
              transition: 'all 0.2s ease',
              padding: '6px',
              backgroundColor: 'rgba(0, 207, 255, 0.12)',
              '&:hover': { 
                color: '#00CFFF',
                backgroundColor: 'rgba(0, 207, 255, 0.25)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 8px rgba(0, 207, 255, 0.3)'
              } 
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      
      <Tooltip title="Удалить" enterDelay={1000} placement="top">
        <IconButton 
          size="small" 
          onClick={onDelete} 
          sx={{ 
            color: '#FF3D71', 
            transition: 'all 0.2s ease',
            padding: '6px',
            backgroundColor: 'rgba(255, 61, 113, 0.12)',
            '&:hover': { 
              color: '#FF3D71',
              backgroundColor: 'rgba(255, 61, 113, 0.25)',
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 8px rgba(255, 61, 113, 0.3)'
            } 
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>,
    document.body
  );
};

export default MessageActionsPortal;