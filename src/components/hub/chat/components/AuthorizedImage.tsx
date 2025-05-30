import React, { useState, useEffect, useMemo } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../store';

interface AuthorizedImageProps {
  storageKey: string;
  alt?: string;
  sx?: any;
  className?: string;
  onClick?: () => void;
}

const AuthorizedImage: React.FC<AuthorizedImageProps> = ({ 
  storageKey, 
  alt = 'Image', 
  sx, 
  className, 
  onClick 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const token = useSelector((state: RootState) => state.auth.token);
  
  // Загружаем изображение с токеном
  useEffect(() => {
    if (!storageKey || !token) {
      setError(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);
        
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
        const response = await fetch(`${baseUrl}/media/${storageKey}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        if (!cancelled) {
          const objectUrl = URL.createObjectURL(blob);
          setImageSrc(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load image:', storageKey, err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [storageKey, token]);

  if (!storageKey) {
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
        Нет изображения
      </Box>
    );
  }

  if (loading) {
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

  if (error) {
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
        Ошибка загрузки
      </Box>
    );
  }

  return (
    <Box
      component="img"
      className={className}
      src={imageSrc || ''}
      alt={alt}
      onClick={onClick}
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...sx
      }}
    />
  );
};

export default AuthorizedImage;