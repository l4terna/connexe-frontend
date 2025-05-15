import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChannelList from './channels/ChannelList';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { Category, ChannelInterface } from '../../api/channels';

interface ChannelManagementProps {
  categories: Category[];
  activeChannel: ChannelInterface | null;
  setActiveChannel: (channel: ChannelInterface | null) => void;
  openChannelSettings: (channel: ChannelInterface) => void;
  sensors: any;
  handleDragEnd: (event: DragEndEvent) => void;
  handleChannelDragEnd: (event: DragEndEvent, category: Category) => void;
  openCategorySettings: (cat: Category) => void;
  setActiveCategoryId: (id: string | number | null) => void;
  setCreateChannelOpen: (open: boolean) => void;
}

const ChannelManagement: React.FC<ChannelManagementProps> = ({
  categories,
  activeChannel,
  setActiveChannel,
  openChannelSettings,
  sensors,
  handleDragEnd,
  handleChannelDragEnd,
  openCategorySettings,
  setActiveCategoryId,
  setCreateChannelOpen,
}) => {
  return (
    <Box
      sx={{
        width: 240,
        background: 'rgba(30,30,47,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: '16px 0' }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 2,
            px: 2,
          }}>
            <Typography
              variant="subtitle2"
              sx={{
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontWeight: 700,
              }}
            >
              Категории
            </Typography>
            <IconButton
              size="small"
              sx={{ 
                color: '#1976D2',
                '&:hover': {
                  background: 'rgba(25,118,210,0.1)',
                }
              }}
              onClick={() => setCreateChannelOpen(true)}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <ChannelList
              categories={categories}
              activeChannel={activeChannel}
              setActiveChannel={setActiveChannel}
              openChannelSettings={openChannelSettings}
              sensors={sensors}
              handleDragEnd={handleDragEnd}
              handleChannelDragEnd={handleChannelDragEnd}
              openCategorySettings={openCategorySettings}
              setActiveCategoryId={setActiveCategoryId}
              setCreateChannelOpen={setCreateChannelOpen}
            />
          </DndContext>
        </Box>
      </Box>
    </Box>
  );
};

export default ChannelManagement; 