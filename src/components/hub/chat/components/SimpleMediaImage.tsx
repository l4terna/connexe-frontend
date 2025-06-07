import React, { useState, useCallback, useEffect } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useMedia } from '@/context/MediaContext';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { useSharedIntersectionObserver } from '@/hooks/useSharedIntersectionObserver';

interface SimpleMediaImageProps {
  storageKey: string;
  alt?: string;
  sx?: any;
  className?: string;
  onClick?: () => void;
  loadingMode?: 'initial' | 'pagination' | 'around' | null;
  staggerIndex?: number; // For staggered loading
}

const SimpleMediaImage: React.FC<SimpleMediaImageProps> = ({ 
  storageKey, 
  alt = '', 
  sx, 
  className, 
  onClick,
  loadingMode = null,
  staggerIndex = 0
}) => {
  const { getSignedUrl, hasSignedUrl } = useMedia();
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  
  // Shared intersection observer callback
  const handleIntersection = useCallback((isIntersecting: boolean) => {
    if (isIntersecting && !hasBeenVisible) {
      setHasBeenVisible(true);
      
      // Staggered loading: add delay based on index
      const delay = Math.min(staggerIndex * 50, 500); // Max 500ms delay
      setTimeout(() => {
        setShouldLoad(true);
      }, delay);
    }
  }, [hasBeenVisible, staggerIndex]);
  
  // Use shared intersection observer
  const { elementRef } = useSharedIntersectionObserver(handleIntersection);

  if (!currentUser) {
    return (
      <Skeleton
        ref={elementRef}
        variant="rectangular"
        className={className}
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: 'rgba(255,255,255,0.05)',
          cursor: onClick ? 'pointer' : 'default',
          ...sx
        }}
      />
    );
  }

  // Only try to get signed URL if image should load
  const signedUrl = shouldLoad ? getSignedUrl(storageKey, currentUser.id) : null;
  
  // If not ready to load or no signed URL available, show skeleton
  if (!shouldLoad || !signedUrl || !hasSignedUrl(storageKey)) {
    return (
      <Skeleton
        ref={elementRef}
        variant="rectangular"
        className={className}
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: 'rgba(255,255,255,0.05)',
          cursor: onClick ? 'pointer' : 'default',
          ...sx,
          '&::after': {
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            animationDuration: '1.5s',
          }
        }}
      />
    );
  }

  return (
    <Box
      ref={elementRef}
      className={className}
      onClick={onClick}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        ...sx
      }}
    >
      {/* Show skeleton while loading */}
      {isLoading && (
        <Skeleton
          variant="rectangular"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(255,255,255,0.05)',
            zIndex: 1,
            '&::after': {
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
              animationDuration: '1.2s',
            }
          }}
        />
      )}
      
      {hasError ? (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '2rem',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: 'inherit',
          }}
        >
          ❌
        </Box>
      ) : (
        <img
          src={signedUrl}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'inherit',
            transition: 'opacity 0.3s ease'
          }}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      )}
    </Box>
  );
};

export default SimpleMediaImage;