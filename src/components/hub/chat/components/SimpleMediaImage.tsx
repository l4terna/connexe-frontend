import React, { useState, useEffect, useRef } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useGetMediaUrlQuery } from '../../../../api/media';

interface SimpleMediaImageProps {
  storageKey: string;
  alt?: string;
  sx?: any;
  className?: string;
  onClick?: () => void;
  loadingMode?: 'initial' | 'pagination' | 'around' | null;
}

const SimpleMediaImage: React.FC<SimpleMediaImageProps> = ({ 
  storageKey, 
  alt = 'Image', 
  sx, 
  className, 
  onClick,
  loadingMode = null
}) => {
  const [imageError, setImageError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Setup Intersection Observer for lazy loading
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      {
        // Start loading when image is 200px away from viewport
        rootMargin: '200px',
        threshold: 0.01
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, []);

  // Determine if we should load the image
  const shouldLoad = storageKey && isVisible && loadingMode !== 'initial';
  
  // Используем RTK Query для кэширования
  const { data: imageSrc, isLoading, error } = useGetMediaUrlQuery(storageKey, {
    skip: !shouldLoad,
  });
  
  console.log('🖼️ SimpleMediaImage render:', { 
    storageKey, 
    alt, 
    imageSrc, 
    isLoading, 
    error, 
    imageError,
    isVisible,
    loadingMode,
    shouldLoad 
  });

  // Reset image error when storageKey changes
  useEffect(() => {
    setImageError(false);
  }, [storageKey]);

  // Show placeholder if not visible or loading mode is initial
  if (!shouldLoad) {
    return (
      <Box
        ref={elementRef}
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '0.875rem',
          border: '1px dashed rgba(255,255,255,0.1)',
          ...sx
        }}
      >
        {loadingMode === 'initial' ? 'Загружается...' : '📷'}
      </Box>
    );
  }

  if (isLoading) {
    console.log('🔄 Showing loading skeleton for:', storageKey);
    return (
      <Box
        ref={elementRef}
        sx={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
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

  if (error || imageError) {
    console.log('❌ Showing error state for:', storageKey);
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

  if (!imageSrc) {
    console.log('⚠️ No imageSrc available for:', storageKey);
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255,255,0,0.1)',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.875rem',
          border: '1px dashed rgba(255,255,0,0.3)',
          ...sx
        }}
      >
        Нет изображения
      </Box>
    );
  }

  console.log('🖼️ Rendering image:', { storageKey, imageSrc });
  return (
    <Box
      ref={elementRef}
      component="img"
      className={className}
      src={imageSrc}
      alt={alt}
      onClick={onClick}
      onError={(e) => {
        console.error('❌ Image render error:', { storageKey, imageSrc, error: e });
        setImageError(true);
      }}
      onLoad={() => {
        console.log('✅ Image rendered successfully:', { storageKey, imageSrc });
      }}
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        ...sx
      }}
    />
  );
};

export default SimpleMediaImage;