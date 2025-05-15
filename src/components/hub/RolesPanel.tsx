import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Paper, Skeleton, IconButton, Popper, Fade, CircularProgress } from '@mui/material';
import { useGetRolesQuery, useAssignRoleMutation, Role } from '../../api/roles';
import { UserProfile } from '../../api/users';
import { useGetUserProfileQuery } from '../../api/users';

interface RolesPanelProps {
  hubId: number;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  open: boolean;
  memberId: number;
  profile: UserProfile;
}

const RolesPanel: React.FC<RolesPanelProps> = ({ hubId, onClose, anchorEl, open, memberId, profile }) => {
  const [page, setPage] = useState(0);
  const [size] = useState(30);
  const panelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: rolesResponse, isLoading: rolesLoading, isFetching: rolesFetching, error: rolesError, refetch: refetchRoles } = useGetRolesQuery({ 
    hubId,
    page,
    size,
    excludedMemberRolesById: memberId
  }, {
    skip: !open
  });

  const [assignRole] = useAssignRoleMutation();
  const { refetch: refetchUserProfile } = useGetUserProfileQuery({ 
    userId: profile.user.id,
    hubId
  });

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || rolesResponse?.last) return;
    
    setIsLoadingMore(true);
    setPage(prev => prev + 1);
  }, [isLoadingMore, hasMore, rolesResponse?.last]);

  useEffect(() => {
    const handleScroll = () => {
      if (!panelRef.current || isLoadingMore || !hasMore || rolesResponse?.last) return;

      const { scrollTop, scrollHeight, clientHeight } = panelRef.current;
      const scrollPosition = scrollTop + clientHeight;
      const scrollPercentage = (scrollPosition / scrollHeight) * 100;

      if (scrollPercentage >= 60) {
        // Очищаем предыдущий таймер если он есть
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
        // Устанавливаем новый таймер
        debounceTimerRef.current = setTimeout(() => {
          loadMore();
        }, 300);
      }
    };

    const panel = panelRef.current;
    if (panel) {
      panel.addEventListener('scroll', handleScroll);
      return () => {
        panel.removeEventListener('scroll', handleScroll);
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }
  }, [isLoadingMore, hasMore, rolesResponse, loadMore]);

  useEffect(() => {
    if (rolesResponse) {
      setAllRoles(prev => {
        if (page === 0) return rolesResponse.content;
        // Фильтруем дубликаты по id
        const newRoles = rolesResponse.content.filter(
          newRole => !prev.some(existingRole => existingRole.id === newRole.id)
        );
        return [...prev, ...newRoles];
      });
      setHasMore(!rolesResponse.last);
      setIsLoadingMore(false);
    }
  }, [rolesResponse, page]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickInsidePanel = panelRef.current?.contains(target);
      const isClickOnAnchor = anchorEl?.contains(target);

      if (isClickInsidePanel || isClickOnAnchor) {
        return;
      }

      onClose();
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [open, anchorEl, onClose]);

  useEffect(() => {
    if (!open) {
      setPage(0);
      setHasMore(true);
      setIsLoadingMore(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    }
  }, [open]);

  // Add new useEffect to handle panel opening
  useEffect(() => {
    if (open) {
      setPage(0);
      setHasMore(true);
      setIsLoadingMore(false);
    }
  }, [open, memberId]);

  const availableRoles = allRoles;

  const handleRoleClick = async (role: Role) => {
    try {
      await assignRole({
        hubId,
        memberId: memberId,
        roleId: role.id
      }).unwrap();
      
      await refetchUserProfile();
    } catch (error) {
      // Ошибка обрабатывается автоматически через RTK Query
    }
  };

  // Добавляем индикатор загрузки в конец списка
  const renderLoadingIndicator = () => {
    if (!hasMore) return null;
    return (
      <Box 
        ref={loadingRef} 
        sx={{ 
          height: '40px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: '10px 0'
        }}
      >
        {isLoadingMore && (
          <CircularProgress size={20} thickness={4} />
        )}
      </Box>
    );
  };

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="right-start"
      transition
      sx={{ 
        zIndex: 9999,
        position: 'fixed'
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={200}>
          <Paper
            ref={panelRef}
            sx={{
              position: 'absolute',
              left: '100%',
              top: 0,
              width: '240px',
              maxHeight: '400px',
              overflowY: 'auto',
              backgroundColor: 'rgba(30,30,47,0.95)',
              border: '2px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 10000,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {rolesLoading && page === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} variant="rectangular" width="100%" height={32} />
                ))}
              </Box>
            ) : rolesError ? (
              <Typography sx={{ color: 'error.main', fontSize: '0.75rem', textAlign: 'center' }}>
                Ошибка загрузки ролей
              </Typography>
            ) : availableRoles.length > 0 ? (
              <>
                {availableRoles.map((role: Role) => (
                  <Box
                    key={role.id}
                    onClick={() => handleRoleClick(role)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      padding: '2px 8px',
                      height: '24px',
                      marginBottom: '2px',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.15)'
                      }
                    }}
                  >
                    <Box
                      sx={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: role.color,
                        marginRight: '6px',
                        flexShrink: 0
                      }}
                    />
                    <Box
                      sx={{
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 500
                      }}
                    >
                      {role.name}
                    </Box>
                  </Box>
                ))}
                {renderLoadingIndicator()}
              </>
            ) : (
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', textAlign: 'center' }}>
                Нет доступных ролей
              </Typography>
            )}
          </Paper>
        </Fade>
      )}
    </Popper>
  );
};

export default RolesPanel; 