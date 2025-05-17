import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Category } from '../../../api/channels';
import { styled } from '@mui/material/styles';
import { hasPermission, PermissionKey } from '../../../utils/rolePermissions';

const DraggableContainer = styled('div')<{ isDragging: boolean; transform?: string; transition?: string }>(({ isDragging }) => ({
  position: 'relative',
  transition: 'transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease',
  opacity: isDragging ? 0.8 : 1,
  cursor: isDragging ? 'grabbing' : 'pointer',
  transform: isDragging ? 'scale(1.02)' : 'none',
  '&:hover': {
    opacity: isDragging ? 0.8 : 0.95,
    cursor: 'pointer',
  },
}));

const CategoryContainer = styled(Box)(({ theme }) => ({
  padding: '16px',
  marginBottom: '0',
  background: 'rgba(30,30,47,0.3)',
  borderRadius: '8px',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  width: '100%',
  '&:hover': {
    borderColor: 'rgba(255,105,180,0.2)',
    background: 'rgba(30,30,47,0.4)',
  },
  transition: 'all 0.2s ease-in-out',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
}));

const CategoryHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: '8px',
  padding: '8px 0',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  position: 'relative',
  '& .category-actions': {
    opacity: 0,
    transition: 'opacity 0.2s ease',
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    marginLeft: 0,
  },
  '&:hover .category-actions': {
    opacity: 1,
    pointerEvents: 'auto',
  },
  '& .drag-handle': {
    opacity: 0,
    transition: 'opacity 0.2s ease',
    cursor: 'grab',
    '&:active': {
      cursor: 'grabbing'
    }
  },
  '&:hover .drag-handle': {
    opacity: 1
  }
}));

const CategoryTitle = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flex: 1,
  cursor: 'pointer',
  minWidth: 0
}));

interface SortableCategoryProps {
  category: Category;
  children: React.ReactNode;
  onAddChannel: (categoryId: number | string) => void;
  onSettings: (cat: Category) => void;
  userPermissions: string[];
  isOwner: boolean;
}

const SortableCategory: React.FC<SortableCategoryProps> = ({ category, children, onAddChannel, onSettings, userPermissions, isOwner }) => {
  const canManageCategories = isOwner || hasPermission(userPermissions, 'MANAGE_CATEGORIES' as PermissionKey);
  const canManageChannels = isOwner || hasPermission(userPermissions, 'MANAGE_CHANNELS' as PermissionKey);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: typeof category.id === 'string' ? parseInt(category.id) : category.id,
    disabled: !canManageCategories 
  });

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canManageCategories) {
      onSettings(category);
    }
  };

  const handleAddChannelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (canManageChannels) {
      onAddChannel(category.id);
    }
  };

  return (
    <DraggableContainer
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 0.2s ease',
        display: 'flex',
        alignItems: 'center',
      }}
      isDragging={isDragging}
      {...(canManageCategories ? { ...attributes, ...listeners } : {})}
    >
      <CategoryContainer sx={{
        background: isDragging ? 'rgba(30,30,47,0.95)' : 'rgba(30,30,47,0.3)',
        boxShadow: isDragging 
          ? '0 8px 24px rgba(0,0,0,0.2), 0 0 12px rgba(255,105,180,0.1)' 
          : '0 2px 8px rgba(0,0,0,0.1)',
        mb: category.channels && category.channels.length > 0 ? 2 : 0.5,
        '&:hover': {
          background: 'rgba(30,30,47,0.5)',
          borderColor: isDragging ? 'rgba(255,105,180,0.4)' : 'rgba(255,105,180,0.2)',
        },
        transition: 'all 0.2s ease-in-out',
        flex: 1,
        minWidth: 0
      }}>
        <CategoryHeader>
          <CategoryTitle>
            <Tooltip title={category.name} enterDelay={600} arrow>
              <Typography
                variant="subtitle2"
                sx={{
                  color: isDragging ? 'rgba(255,105,180,0.9)' : 'rgba(255,255,255,0.7)',
                  letterSpacing: 1,
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 'calc(100% - 60px)',
                  flex: 1,
                  minWidth: 0
                }}
              >
                {category.name}
              </Typography>
            </Tooltip>
            <Box className="category-actions">
              {canManageCategories && (
                <IconButton
                  size="small"
                  sx={{ color: '#B0B0B0', '&:hover': { color: '#FF69B4' }, p: '4px' }}
                  onClick={handleSettingsClick}
                >
                  <SettingsIcon fontSize="small" sx={{ fontSize: 20 }} />
                </IconButton>
              )}
              {canManageChannels && (
                <IconButton
                  size="small"
                  sx={{ ml: 0.5, color: isDragging ? 'rgba(255,105,180,0.9)' : '#1976D2', '&:hover': { background: isDragging ? 'rgba(255,105,180,0.1)' : 'rgba(25,118,210,0.1)' }, transition: 'all 0.2s ease', p: '4px' }}
                  onClick={handleAddChannelClick}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </CategoryTitle>
        </CategoryHeader>
        {children}
      </CategoryContainer>
    </DraggableContainer>
  );
};

export default SortableCategory; 