import React from 'react';
import { Box, Typography } from '@mui/material';
import UserAvatar from '../../UserAvatar';
import { UserProfile } from '../../../api/users';

interface UserProfileHeaderProps {
  profile: UserProfile;
  hubId: number;
}

const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({ profile, hubId }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      <UserAvatar 
        src={profile.user.avatar || undefined}
        alt={profile.user.login}
        userId={profile.user.id} 
        hubId={hubId} 
        sx={{ width: 40, height: 40 }}
        onClick={e => e.stopPropagation()}
      />
      <Box sx={{ ml: 2 }}>
        <Typography 
          sx={{ 
            color: '#fff',
            fontWeight: 700,
            fontSize: '1rem',
            letterSpacing: 0.2
          }}
        >
          {profile.user.login}
        </Typography>
        <Typography 
          sx={{ 
            color: 'rgba(255,255,255,0.7)',
            fontSize: '0.75rem',
            fontWeight: 400
          }}
        >
          {formatDate(profile.hub_member.joined_at)}
        </Typography>
      </Box>
    </Box>
  );
};

export default UserProfileHeader; 