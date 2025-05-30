import React, { useState, useEffect } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useGetMediaUrlQuery } from '../../../../api/media';

interface MediaImageProps {
  storageKey: string;
  alt?: string;
  sx?: any;
  className?: string;
  onClick?: () => void;
}

const MediaImage: React.FC<MediaImageProps> = ({ storageKey, alt = 'Image', sx, className, onClick }) => {
  console.log('MediaImage render:', { storageKey, alt, className });
  
  const { data: imageUrl, isLoading, error } = useGetMediaUrlQuery(storageKey, {
    skip: !storageKey,
  });
  const [imageError, setImageError] = useState(false);

  console.log('MediaImage state:', { 
    storageKey, 
    imageUrl, 
    isLoading, 
    error, 
    imageError,
    hasStorageKey: !!storageKey 
  });

  // Reset error state when storageKey changes
  useEffect(() => {
    console.log('Storage key changed:', { storageKey });
    setImageError(false);
  }, [storageKey]);

  // Debug logging
  useEffect(() => {
    if (imageUrl) {
      console.log('✅ Image URL loaded successfully:', { storageKey, imageUrl, urlType: typeof imageUrl });
    }
    if (error) {
      console.error('❌ Image loading error:', { storageKey, error });
    }
  }, [imageUrl, error, storageKey]);

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
    console.log('❌ Showing error state for:', { storageKey, error, imageError });
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '0.875rem',
          ...sx
        }}
      >
        Не удалось загрузить
      </Box>
    );
  }

  if (!imageUrl) {
    console.log('⚠️ No imageUrl available for:', storageKey);
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '0.875rem',
          ...sx
        }}
      >
        Нет URL
      </Box>
    );
  }

  console.log('🖼️ Rendering image with URL:', { storageKey, imageUrl });
  return (
    <Box
      component="img"
      className={className}
      src={imageUrl}
      alt={alt}
      onClick={onClick}
      onError={(e) => {
        console.error('❌ Image display error:', { storageKey, imageUrl, error: e });
        setImageError(true);
      }}
      onLoad={() => {
        console.log('✅ Image loaded and displayed successfully:', { storageKey, imageUrl });
      }}
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...sx
      }}
    />
  );
};

export default MediaImage;