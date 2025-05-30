import React, { useState, useEffect } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useGetMediaUrlQuery } from '../../../../api/media';

interface SimpleMediaImageProps {
  storageKey: string;
  alt?: string;
  sx?: any;
  className?: string;
  onClick?: () => void;
}

const SimpleMediaImage: React.FC<SimpleMediaImageProps> = ({ 
  storageKey, 
  alt = 'Image', 
  sx, 
  className, 
  onClick 
}) => {
  const [imageError, setImageError] = useState(false);
  
  // Используем RTK Query для кэширования
  const { data: imageSrc, isLoading, error } = useGetMediaUrlQuery(storageKey, {
    skip: !storageKey,
  });
  
  console.log('🖼️ SimpleMediaImage render:', { 
    storageKey, 
    alt, 
    imageSrc, 
    isLoading, 
    error, 
    imageError 
  });

  // Reset image error when storageKey changes
  useEffect(() => {
    setImageError(false);
  }, [storageKey]);

  if (isLoading) {
    console.log('🔄 Showing loading skeleton for:', storageKey);
    return (
      <Skeleton 
        variant="rectangular" 
        sx={{ 
          width: '100%', 
          height: '100%',
          bgcolor: 'rgba(255,255,255,0.1)',
          ...sx 
        }} 
      />
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
      component="img"
      className={className}
      src={imageSrc}
      alt={alt}
      onClick={onClick}
      onError={(e) => {
        console.error('❌ Image render error:', { storageKey, imageSrc, error: e });
        setError(true);
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