// SearchResultItem.tsx
import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import DOMPurify from 'dompurify';
import type { Message } from '@/api/channels';

interface SearchResultItemProps {
  message: Message;
  searchQuery: string;
  onResultClick: (msg: Message) => void;
}

export const SearchResultItem = React.memo(({ 
  message, 
  searchQuery, 
  onResultClick 
}: SearchResultItemProps) => {
  // Мемоизируем обработку контента
  const { highlightedContent, formattedTime } = useMemo(() => {
    // Форматирование времени
    const date = new Date(message.created_at);
    const time = date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });

    // Обработка контента
    let content = message.content;
    
    if (content.length > 150) {
      content = content.substring(0, 150) + '...';
    }
    
    content = content.replace(/\r\n/g, ' ').replace(/\n/g, ' ');
    
    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      content = content.replace(regex, '<mark>$1</mark>');
    }
    
    return {
      highlightedContent: DOMPurify.sanitize(content),
      formattedTime: time
    };
  }, [message.content, message.created_at, searchQuery]);

  const handleClick = React.useCallback(() => {
    onResultClick(message);
  }, [message, onResultClick]);

  return (
    <Box
      onClick={handleClick}
      onMouseDown={(e) => e.preventDefault()}
      sx={{
        p: 2,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        '&:hover': {
          background: 'rgba(255,255,255,0.1)',
        },
        '&:last-child': {
          borderBottom: 'none',
        },
        // Оптимизация рендеринга
        contain: 'layout style paint',
        contentVisibility: 'auto',
        containIntrinsicSize: '0 80px'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography sx={{ 
          color: '#00CFFF', 
          fontSize: '0.8rem', 
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '150px'
        }}>
          {message.author.login}
        </Typography>
        <Typography sx={{ 
          color: 'rgba(255,255,255,0.4)', 
          fontSize: '0.7rem',
          ml: 'auto'
        }}>
          {formattedTime}
        </Typography>
      </Box>
      <Typography
        sx={{ 
          color: 'rgba(255,255,255,0.8)', 
          fontSize: '0.85rem',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          '& mark': {
            background: 'rgba(255, 105, 180, 0.3)',
            color: '#FF69B4',
            padding: '1px 2px',
            borderRadius: '2px',
            fontWeight: 600
          }
        }}
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
      />
    </Box>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.searchQuery === nextProps.searchQuery
  );
});