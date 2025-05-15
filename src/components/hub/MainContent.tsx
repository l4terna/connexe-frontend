import React from 'react';
import { Box } from '@mui/material';
import MainChatArea from './chat/MainChatArea';
import MembersSidebar from './members/MembersSidebar';
import { Channel } from '../../api/channels';

interface Member {
  id: number;
  name: string;
  avatar?: string;
  isOnline?: boolean;
}

interface MainContentProps {
  activeChannel: Channel | null;
  members?: Member[];
}

const MainContent: React.FC<MainContentProps> = ({
  activeChannel,
  members = [],
}) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      flex: 1,
      background: 'rgba(30,30,47,0.95)',
      backdropFilter: 'blur(10px)',
    }}>
      <MainChatArea activeChannel={activeChannel} />
      <MembersSidebar members={members} />
    </Box>
  );
};

export default MainContent; 