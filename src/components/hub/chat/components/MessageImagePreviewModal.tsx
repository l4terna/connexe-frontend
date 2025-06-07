import React, { useCallback, useMemo } from 'react';
import { Dialog, IconButton, styled, Box } from '@mui/material';
import { Close, ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';
import { colors } from '../../../../theme/theme';
import SimpleMediaImage from './SimpleMediaImage';

interface MessageImagePreviewModalProps {
  open: boolean;
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const StyledDialog = styled(Dialog)({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    backdropFilter: 'blur(8px)',
  },
  '& .MuiDialog-paper': {
    backgroundColor: 'transparent',
    boxShadow: 'none',
    maxWidth: 'none',
    maxHeight: 'none',
    margin: 0,
    overflow: 'hidden',
  },
});

const ImageContainer = styled('div')({
  position: 'relative',
  width: '100vw',
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
});

const NavButton = styled(IconButton)({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 56,
  height: 56,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  border: `1px solid ${colors.primary}30`,
  color: colors.text.primary,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: `${colors.primary}20`,
    borderColor: `${colors.primary}60`,
    transform: 'translateY(-50%) scale(1.1)',
    boxShadow: `0 0 20px ${colors.primary}40`,
  },
  '&:active': {
    transform: 'translateY(-50%) scale(0.95)',
  },
});

const CloseButton = styled(IconButton)({
  position: 'absolute',
  top: 20,
  right: 20,
  width: 48,
  height: 48,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  border: '1px solid rgba(255, 61, 113, 0.3)',
  color: colors.text.primary,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(255, 61, 113, 0.2)',
    borderColor: 'rgba(255, 61, 113, 0.6)',
    transform: 'scale(1.1) rotate(90deg)',
    boxShadow: '0 0 20px rgba(255, 61, 113, 0.4)',
  },
});

const ImageCounter = styled(Box)({
  position: 'absolute',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '8px 16px',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  border: `1px solid ${colors.primary}30`,
  borderRadius: '20px',
  color: colors.text.primary,
  fontSize: '14px',
  fontWeight: 600,
  backdropFilter: 'blur(10px)',
});

const DotsContainer = styled(Box)({
  position: 'absolute',
  bottom: 60,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
});

const Dot = styled('button')<{ active?: boolean }>(({ active }) => ({
  width: active ? 24 : 8,
  height: 8,
  border: 'none',
  borderRadius: '4px',
  backgroundColor: active ? colors.primary : 'rgba(255, 255, 255, 0.3)',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: active ? colors.primary : 'rgba(255, 255, 255, 0.5)',
    transform: 'scale(1.2)',
  },
}));

const StyledImageContainer = styled(Box)({
  maxWidth: 'calc(100vw - 120px)',
  maxHeight: 'calc(100vh - 120px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const MessageImagePreviewModal: React.FC<MessageImagePreviewModalProps> = ({
  open,
  images,
  currentIndex,
  onClose,
  onNavigate,
}) => {
  const currentStorageKey = useMemo(() => images[currentIndex], [images, currentIndex]);
  
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, images.length, onNavigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        handlePrevious();
        break;
      case 'ArrowRight':
        handleNext();
        break;
    }
  }, [onClose, handlePrevious, handleNext]);

  if (!currentStorageKey) return null;

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      fullScreen
      onKeyDown={handleKeyDown}
    >
      <ImageContainer onClick={onClose}>
        <StyledImageContainer onClick={(e) => e.stopPropagation()}>
          <SimpleMediaImage
            storageKey={currentStorageKey}
            alt="Preview"
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '12px',
              filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.8))',
              transition: 'transform 0.2s ease',
              '&:hover': {
                transform: 'scale(1.01)',
              },
            }}
          />
        </StyledImageContainer>
        
        {currentIndex > 0 && (
          <NavButton
            onClick={(e) => {
              e.stopPropagation();
              handlePrevious();
            }}
            style={{ left: 32 }}
          >
            <ArrowBackIos />
          </NavButton>
        )}
        
        {currentIndex < images.length - 1 && (
          <NavButton
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            style={{ right: 32 }}
          >
            <ArrowForwardIos />
          </NavButton>
        )}
        
        <CloseButton
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <Close />
        </CloseButton>
        
        {images.length > 1 && (
          <>
            <ImageCounter>
              {currentIndex + 1} / {images.length}
            </ImageCounter>
            
            <DotsContainer>
              {images.map((_, index) => (
                <Dot
                  key={index}
                  active={index === currentIndex}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(index);
                  }}
                />
              ))}
            </DotsContainer>
          </>
        )}
      </ImageContainer>
    </StyledDialog>
  );
};

export default MessageImagePreviewModal;