import React, { useMemo } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import PrivateChatArea from '../components/private/PrivateChatArea';
import { useAppSelector } from '../hooks/redux';
import { Channel, ChannelType, useGetPrivateChannelsQuery } from '../api/channels';

const PrivateChatPage: React.FC = () => {
  const { channelId: channelIdParam } = useParams<{ channelId?: string }>();
  const location = useLocation();
  const user = useAppSelector((state) => state.user.currentUser);
  const channelId = channelIdParam ? parseInt(channelIdParam) : null;

  if (!user || !channelId) {
    return <Navigate to="/" replace />;
  }

  // Get other user from location state (passed from Sidebar)
  let otherUser = location.state?.otherUser;

  // If no user in state, try to find from cached channels
  const { data: privateChannels } = useGetPrivateChannelsQuery(undefined, {
    skip: !!otherUser // Skip if we already have the user
  });

  // Find the channel and extract other user if not in state
  if (!otherUser && privateChannels) {
    const channel = privateChannels.find(ch => ch.id === channelId);
    if (channel?.type === 2 && channel.members && channel.members.length > 0) {
      otherUser = channel.members.find(member => member.id !== user.id) || channel.members[0];
    }
  }

  // Create a Channel object for PrivateChatArea
  const privateChannel: Channel = useMemo(() => {
    return {
      id: channelId,
      name: otherUser?.login || 'Private Chat',
      type: ChannelType.PRIVATE,
      categoryId: 0, // Private channels don't belong to categories
    };
  }, [channelId, otherUser]);

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <PrivateChatArea
        activeChannel={privateChannel}
        user={user}
        otherUser={otherUser}
      />
    </Box>
  );
};

export default PrivateChatPage;