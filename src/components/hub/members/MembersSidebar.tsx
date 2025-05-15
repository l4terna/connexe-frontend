import React from 'react';
import { Box, Typography, Paper, Skeleton } from '@mui/material';
import { HubMember } from '../../../api/hubs';
import { useGetHubMembersQuery } from '../../../api/hubs';
import UserAvatar from '../../UserAvatar';

interface MembersSidebarProps {
  hubId: number;
}

const MembersSidebar: React.FC<MembersSidebarProps> = ({ hubId }) => {
  const { data: members = [], isLoading } = useGetHubMembersQuery({ hubId });

  if (isLoading) {
    return (
      <Box sx={{ 
        width: 240, 
        p: 2,
        background: 'rgba(30,30,47,0.95)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
      }}>
        {[...Array(5)].map((_, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.1)', mr: 2 }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 0.5 }} />
              <Skeleton variant="text" width="40%" height={16} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: 240, 
      p: 2,
      background: 'rgba(30,30,47,0.95)',
      borderLeft: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(10px)',
    }}>
      <Typography
        variant="subtitle2"
        sx={{
          color: '#B0B0B0',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 1,
          mb: 2,
        }}
      >
        Участники ({members.length})
      </Typography>
      {members.map((member) => (
        <Paper
          key={member.id}
          sx={{
            p: 1,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(30,30,47,0.5)',
            border: '1px solid rgba(255,255,255,0.05)',
            '&:hover': {
              background: 'rgba(30,30,47,0.7)',
              borderColor: 'rgba(255,255,255,0.1)',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <UserAvatar
            src={member.user.avatar}
            alt={member.user.login}
            userId={member.user.id}
            hubId={hubId}
            sx={{
              width: 32,
              height: 32,
              mr: 1,
              background: 'linear-gradient(135deg, #C2185B 0%, #1976D2 100%)',
            }}
          />
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 500 }}>
              {member.user.login}
            </Typography>
            <Typography sx={{ color: '#B0B0B0', fontSize: '0.8rem' }}>
              {member.user.presence === 'ONLINE' ? 'В сети' : 'Не в сети'}
            </Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default MembersSidebar; 