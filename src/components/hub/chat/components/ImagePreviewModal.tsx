import React, { useEffect } from 'react';
import { Box, Modal, Fade, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface ImageFile {
  file: File;
  preview: string;
  valid: boolean;
  error?: string;
}

interface ImagePreviewModalProps {
  open: boolean;
  images: ImageFile[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  open,
  images,
  currentIndex,
  onClose,
  onNavigate,
}) => {
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
        onNavigate(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentIndex, images.length, onClose, onNavigate]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(10, 10, 26, 0.85)',
      }}
    >
      <Fade in={open}>
        <Box
          sx={{
            position: 'relative',
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(13,13,26,0.95) 0%, rgba(26,26,46,0.95) 100%)',
            outline: 'none',
          }}
          onClick={onClose}
        >
          {images[currentIndex] && (
            <>
              <Box
                sx={{
                  position: 'relative',
                  maxWidth: '90vw',
                  maxHeight: '90vh',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Box
                  component="img"
                  src={images[currentIndex].preview}
                  alt="Fullscreen preview"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '90vh',
                    objectFit: 'contain',
                    borderRadius: 2,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  }}
                />
              </Box>
              
              {/* Navigation arrows */}
              {currentIndex > 0 && (
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(currentIndex - 1);
                  }}
                  sx={{
                    position: 'absolute',
                    left: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(255, 105, 180, 0.1) 0%, rgba(30, 144, 255, 0.1) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: -2,
                      borderRadius: '50%',
                      padding: 2,
                      background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
                      mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      maskComposite: 'exclude',
                      opacity: 0,
                      transition: 'opacity 0.3s',
                    },
                    '&:hover': { 
                      transform: 'translateX(-4px) scale(1.1)',
                      boxShadow: '0 8px 32px rgba(255, 105, 180, 0.4)',
                      background: 'linear-gradient(135deg, rgba(255, 105, 180, 0.2) 0%, rgba(30, 144, 255, 0.2) 100%)',
                      '&::before': {
                        opacity: 1,
                      },
                    },
                  }}
                >
                  <ChevronLeftIcon sx={{ fontSize: 28, color: 'rgba(255, 255, 255, 0.9)' }} />
                </Box>
              )}
              
              {currentIndex < images.length - 1 && (
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(currentIndex + 1);
                  }}
                  sx={{
                    position: 'absolute',
                    right: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(255, 105, 180, 0.1) 0%, rgba(30, 144, 255, 0.1) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: -2,
                      borderRadius: '50%',
                      padding: 2,
                      background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
                      mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      maskComposite: 'exclude',
                      opacity: 0,
                      transition: 'opacity 0.3s',
                    },
                    '&:hover': { 
                      transform: 'translateX(4px) scale(1.1)',
                      boxShadow: '0 8px 32px rgba(255, 105, 180, 0.4)',
                      background: 'linear-gradient(135deg, rgba(255, 105, 180, 0.2) 0%, rgba(30, 144, 255, 0.2) 100%)',
                      '&::before': {
                        opacity: 1,
                      },
                    },
                  }}
                >
                  <ChevronRightIcon sx={{ fontSize: 28, color: 'rgba(255, 255, 255, 0.9)' }} />
                </Box>
              )}
              
              {/* Close button */}
              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                sx={{
                  position: 'absolute',
                  top: 40,
                  right: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(255, 61, 113, 0.1) 0%, rgba(255, 61, 113, 0.2) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 61, 113, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: -2,
                    borderRadius: '50%',
                    padding: 2,
                    background: 'linear-gradient(90deg, #FF3D71 0%, #FF69B4 100%)',
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude',
                    opacity: 0,
                    transition: 'opacity 0.3s',
                  },
                  '&:hover': { 
                    transform: 'scale(1.1) rotate(90deg)',
                    boxShadow: '0 8px 32px rgba(255, 61, 113, 0.4)',
                    background: 'linear-gradient(135deg, rgba(255, 61, 113, 0.2) 0%, rgba(255, 61, 113, 0.3) 100%)',
                    '&::before': {
                      opacity: 1,
                    },
                  },
                }}
              >
                <CloseIcon sx={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.9)' }} />
              </Box>
              
              {/* Image counter */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 40,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                {images.map((_, index) => (
                  <Box
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(index);
                    }}
                    sx={{
                      width: index === currentIndex ? 32 : 8,
                      height: 8,
                      borderRadius: 1,
                      bgcolor: index === currentIndex 
                        ? '#FF69B4' 
                        : 'rgba(255, 255, 255, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        bgcolor: index === currentIndex 
                          ? '#FF69B4' 
                          : 'rgba(255, 255, 255, 0.5)',
                      },
                    }}
                  />
                ))}
              </Box>
              
              {/* Additional info */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 40,
                  left: 40,
                  color: 'white',
                  bgcolor: 'rgba(30, 30, 47, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                }}
              >
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {currentIndex + 1} из {images.length}
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Fade>
    </Modal>
  );
};

export default ImagePreviewModal;