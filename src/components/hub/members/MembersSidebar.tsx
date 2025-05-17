import React from 'react';
import { Box, Typography, Paper, Skeleton } from '@mui/material';
import { HubMember } from '../../../api/users';
import { useGetHubMembersQuery } from '../../../api/hubs';
import UserAvatar from '../../UserAvatar';
import { useAppSelector } from '../../../hooks/redux';

interface MembersSidebarProps {
  hubId: number;
  presenceUpdates?: HubMember[];
}

const MembersSidebar: React.FC<MembersSidebarProps> = ({ hubId, presenceUpdates = [] }) => {
  const { data: members = [], isLoading } = useGetHubMembersQuery({ hubId });
  
  // Get current user from Redux store
  const currentUser = useAppSelector(state => state.user.currentUser);
  
  
  // Merge API data with presence updates
  const mergedMembers = React.useMemo(() => {
    const membersMap = new Map<number, HubMember>();
    
    // Add API members
    members.forEach(member => {
      if (member.user_id && member.user) {
        membersMap.set(member.user_id, member);
      } else if (member.user?.id) {
        // Fallback to user.id if user_id is not present
        membersMap.set(member.user.id, {
          ...member,
          user_id: member.user.id
        });
      }
    });
    
    // Update with presence changes - ensure it's an array
    const updates = Array.isArray(presenceUpdates) ? presenceUpdates : [];
    updates.forEach(update => {
      const userId = update.user_id || update.user?.id;
      if (!userId) {
        return;
      }
      
      const existing = membersMap.get(userId);
      if (existing) {
        membersMap.set(userId, {
          ...existing,
          ...update,
          online: update.online ?? existing.online
        });
      } else {
        membersMap.set(userId, {
          ...update,
          user_id: userId
        });
      }
    });
    
    // Add current user if not present
    if (currentUser && !membersMap.has(currentUser.id)) {
      membersMap.set(currentUser.id, {
        id: Date.now(), // Temporary ID
        user_id: currentUser.id,
        hub_id: hubId,
        joined_at: new Date().toISOString(),
        is_owner: false,
        user: {
          id: currentUser.id,
          login: currentUser.login,
          avatar: currentUser.avatar,
          online: true // Current user is always online
        },
        roles: []
      });
    }
    
    const membersArray = Array.from(membersMap.values());
    
    // Sort by: current user first, then online status, then by login
    return membersArray.sort((a, b) => {
      const aIsCurrentUser = currentUser && a.user_id === currentUser.id;
      const bIsCurrentUser = currentUser && b.user_id === currentUser.id;
      
      // Current user always first
      if (aIsCurrentUser && !bIsCurrentUser) return -1;
      if (!aIsCurrentUser && bIsCurrentUser) return 1;
      
      const aOnline = a.online || a.user?.online || a.user?.presence === 'ONLINE';
      const bOnline = b.online || b.user?.online || b.user?.presence === 'ONLINE';
      
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      
      return (a.user?.login || '').localeCompare(b.user?.login || '');
    });
  }, [members, presenceUpdates, currentUser, hubId]);

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
        Участники ({mergedMembers.length})
      </Typography>
      {mergedMembers.map((member) => {
        if (!member.user) {
          return null;
        }
        
        const isCurrentUser = currentUser && member.user_id === currentUser.id;
        
        return (
          <Paper
            key={member.id || member.user_id || member.user.id}
            sx={{
              p: 1,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              background: isCurrentUser ? 'rgba(0,207,255,0.1)' : 'rgba(30,30,47,0.5)',
              border: `1px solid ${isCurrentUser ? 'rgba(0,207,255,0.3)' : 'rgba(255,255,255,0.05)'}`,
              '&:hover': {
                background: isCurrentUser ? 'rgba(0,207,255,0.15)' : 'rgba(30,30,47,0.7)',
                borderColor: isCurrentUser ? 'rgba(0,207,255,0.4)' : 'rgba(255,255,255,0.1)',
              },
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
          <Box sx={{ position: 'relative', mr: 1 }}>
            <UserAvatar
              src={member.user.avatar}
              alt={member.user.login}
              userId={member.user.id}
              hubId={hubId}
              sx={{
                width: 32,
                height: 32,
                background: 'linear-gradient(135deg, #C2185B 0%, #1976D2 100%)',
              }}
            />
            {member.user.presence && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 14,
                  height: 14,
                  bgcolor: member.user.presence === 'ONLINE' ? '#4CAF50' : '#6B5B95',
                  border: '3px solid #1E1E2F',
                  borderRadius: '50%',
                }}
              />
            )}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: '#fff', fontWeight: 500 }}>
              {member.user.login}
            </Typography>
            <Typography sx={{ color: '#B0B0B0', fontSize: '0.8rem' }}>
              {member.user.presence === 'ONLINE' ? 'В сети' : 'Не в сети'}
            </Typography>
          </Box>
          </Paper>
        );
      })}
    </Box>
  );
};

export default MembersSidebar; 