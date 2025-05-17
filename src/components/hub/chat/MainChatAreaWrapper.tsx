import React from 'react';
import { Box } from '@mui/material';
import { Channel } from '@/api/channels';
import MainChatArea from './MainChatArea';
import { useAppSelector } from '@/hooks/redux';

interface MainChatAreaWrapperProps {
  activeChannel: Channel | null;
  userPermissions: string[];
  isOwner: boolean;
}

const MainChatAreaWrapper: React.FC<MainChatAreaWrapperProps> = ({
  activeChannel,
  userPermissions,
  isOwner,
}) => {
  const currentUser = useAppSelector(state => state.user.currentUser);
  const hubId = activeChannel?.hub_id || 0;

  if (!activeChannel || !currentUser) {
    return null;
  }

  return (
    <Box sx={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden'
    }}>
      <MainChatArea
        activeChannel={activeChannel}
        user={currentUser}
        hubId={hubId}
        userPermissions={userPermissions}
        isOwner={isOwner}
      />
    </Box>
  );
};

export default MainChatAreaWrapper;