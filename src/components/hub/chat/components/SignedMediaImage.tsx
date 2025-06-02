import React, { useState, useEffect, useRef } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useSignedUrls } from '../../../../context/SignedUrlContext';

interface SignedMediaImageProps {
  storageKey: string;
  alt?: string;
  sx?: any;
  className?: string;
  onClick?: () => void;
  onLoadingChange?: (isLoading: boolean) => void;
  loadingMode?: 'initial' | 'pagination' | 'around' | null;
}

const SignedMediaImage: React.FC<SignedMediaImageProps> = ({ 
  storageKey, 
  alt = 'Image', 
  sx, 
  className, 
  onClick,
  onLoadingChange,
  loadingMode = null
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get signed URL from context
  const { signedUrls, getSignedUrl, fetchSignedUrls } = useSignedUrls();
  const signedUrl = getSignedUrl(storageKey);

  // Intersection Observer для lazy loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.unobserve(container);
          }
        });
      },
      {
        rootMargin: '500px', // Начинаем загрузку за 200px до появления в viewport
        threshold: 0.1
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Request signed URL if not available
  useEffect(() => {
    if (shouldLoad && storageKey && !signedUrl) {
      console.log('🔄 Requesting signed URL for:', storageKey);
      fetchSignedUrls([storageKey]);
    }
  }, [shouldLoad, storageKey, signedUrl, fetchSignedUrls]);

  // Debug logging
  useEffect(() => {
    console.log('📷 SignedMediaImage props:', { storageKey, signedUrl, alt, imageError, isLoading, shouldLoad });
  }, [storageKey, signedUrl, alt, imageError, isLoading, shouldLoad]);

  // Reset state when URL changes
  useEffect(() => {
    if (signedUrl && shouldLoad) {
      setImageError(false);
      setIsLoading(true);
      onLoadingChange?.(true);
    }
  }, [signedUrl, shouldLoad, onLoadingChange]);

  // Notify parent when loading state changes
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  // Show loading placeholder if no signed URL yet or shouldn't load yet
  if (!signedUrl || !shouldLoad) {
    return (
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          ...sx
        }}
      >
        <Skeleton 
          variant="rectangular" 
          animation="wave"
          sx={{ 
            width: '100%', 
            height: '100%',
            bgcolor: 'rgba(255,255,255,0.1)',
            '&::after': {
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            }
          }} 
        />
      </Box>
    );
  }

  if (imageError) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255,0,0,0.1)',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.875rem',
          border: '1px dashed rgba(255,0,0,0.3)',
          ...sx
        }}
      >
        Ошибка загрузки
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        ...sx
      }}
    >
      {isLoading && (
        <Skeleton 
          variant="rectangular" 
          animation="wave"
          sx={{ 
            position: 'absolute',
            width: '100%', 
            height: '100%',
            zIndex: 1,
            bgcolor: 'rgba(255,255,255,0.1)',
            '&::after': {
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            }
          }} 
        />
      )}
      <Box
        component="img"
        className={className}
        src={signedUrl}
        alt={alt}
        onClick={onClick}
        onLoad={() => {
          console.log('✅ Image loaded successfully:', signedUrl);
          setIsLoading(false);
        }}
        onError={(e) => {
          console.error('❌ Image load error:', { signedUrl, error: e });
          setImageError(true);
          setIsLoading(false);
        }}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'relative',
          zIndex: 2,
          display: isLoading ? 'none' : 'block',
          willChange: 'auto',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
        }}
      />
    </Box>
  );
};

export default SignedMediaImage;