import React, { JSX } from 'react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { ChannelType, Channel as ChannelInterface, Category } from '../../../api/channels';
import SortableCategory from '../categories/SortableCategory';
import SortableChannel from './SortableChannel';
import ForumIcon from '@mui/icons-material/Forum';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import SettingsIcon from '@mui/icons-material/Settings';
import TextChannelButton from './TextChannelButton';
import VoiceChannelButton from './VoiceChannelButton';
import {  Box, IconButton, styled, Typography } from '@mui/material';
import { hasPermission, PermissionKey } from '../../../utils/rolePermissions';
import { useNavigate } from 'react-router-dom';

interface ChannelListProps {
  categories: Category[];
  activeChannel: ChannelInterface | null;
  setActiveChannel: (channel: ChannelInterface) => void;
  openChannelSettings: (channel: ChannelInterface) => void;
  sensors: any;
  handleDragEnd: (event: DragEndEvent) => void;
  handleChannelDragEnd: (event: DragEndEvent, category: Category) => void;
  openCategorySettings: (cat: Category) => void;
  setActiveCategoryId: (id: number | string | null) => void;
  setCreateChannelOpen: (open: boolean) => void;
  userPermissions: string[];
  isOwner: boolean;
  hubId: string;
}

const SettingsButton = styled(IconButton)(({ theme }) => ({
  opacity: 0,
  transition: 'opacity 0.2s ease',
  pointerEvents: 'none',
  color: '#B0B0B0',
  '&:hover': {
    opacity: 1,
    pointerEvents: 'auto',
    color: '#FF69B4',
    background: 'transparent'
  }
}));

// Define channel icon selector function outside component
const getChannelIcon = (channel: ChannelInterface) => {
  if (channel.type === ChannelType.VOICE) {
    return VolumeUpIcon;
  } else {
    if (channel.name.includes('announcement')) {
      return AnnouncementIcon;
    } else if (channel.name.includes('game')) {
      return SportsEsportsIcon;
    }
    return ForumIcon;
  }
};

const ChannelList: React.FC<ChannelListProps> = ({
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
  userPermissions,
  isOwner,
  hubId
}): JSX.Element => {
  const navigate = useNavigate();

  const handleChannelClick = (channel: ChannelInterface): void => {
    setActiveChannel(channel);
    navigate(`/hub/${hubId}/channel/${channel.id}`);
  };

  const canManageChannels = isOwner || hasPermission(userPermissions, 'MANAGE_CHANNELS' as PermissionKey);

  const handleChannelSettingsClick = (e: React.MouseEvent, channel: ChannelInterface) => {
    e.stopPropagation();
    if (canManageChannels) {
      openChannelSettings(channel);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext
        items={categories.map(cat => typeof cat.id === 'string' ? parseInt(cat.id) : cat.id)}
        strategy={verticalListSortingStrategy}
      >
        {categories.map((cat) => (
          <SortableCategory 
            key={cat.id}
            category={cat}
            onAddChannel={(categoryId) => {
              setActiveCategoryId(typeof categoryId === 'string' ? parseInt(categoryId) : categoryId);
              setCreateChannelOpen(true);
            }}
            onSettings={openCategorySettings}
            userPermissions={userPermissions}
            isOwner={isOwner}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={event => handleChannelDragEnd(event, cat)}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext
                items={cat.channels.map(ch => ch.id)}
                strategy={verticalListSortingStrategy}
              >
                <Box sx={{ mb: 2 }}>
                  {cat.channels
                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                    .map((channel) => {
                      const ChannelComponent = channel.type === ChannelType.VOICE ? VoiceChannelButton : TextChannelButton;
                      const ChannelIcon = getChannelIcon(channel);

                      return (
                        <SortableChannel 
                          key={channel.id} 
                          channel={channel}
                          userPermissions={userPermissions}
                          isOwner={isOwner}
                        >
                          <ChannelComponent
                            alignItems="center"
                            onClick={() => handleChannelClick(channel)}
                            selected={activeChannel?.id === channel.id}
                            sx={{ 
                              cursor: 'pointer',
                              '&:hover .settings-button': {
                                opacity: 1,
                                pointerEvents: 'auto',
                              }
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', minWidth: 40 }}>
                              <ChannelIcon 
                                className="channel-icon" 
                                style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.2rem' }}
                              />
                            </span>
                            <Typography
                              sx={{
                                color: activeChannel?.id === channel.id ? '#fff' : 'rgba(255,255,255,0.7)',
                                fontWeight: activeChannel?.id === channel.id ? 600 : 400,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {channel.name}
                            </Typography>
                            {canManageChannels && (
                              <SettingsButton
                                className="settings-button"
                                size="small"
                                onClick={(e) => handleChannelSettingsClick(e, channel)}
                              >
                                <SettingsIcon fontSize="small" />
                              </SettingsButton>
                            )}
                          </ChannelComponent>
                        </SortableChannel>
                      );
                    })}
                </Box>
              </SortableContext>
            </DndContext>
          </SortableCategory>
        ))}
      </SortableContext>
    </DndContext>
  );
};

export default ChannelList;