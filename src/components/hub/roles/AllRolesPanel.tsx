import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Paper, IconButton, Popper, Fade, CircularProgress, TextField } from '@mui/material';
import { Role } from '../../../api/roles';
import { useRemoveRoleMutation } from '../../../api/roles';
import CloseIcon from '@mui/icons-material/Close';
import { useNotification } from '../../../context/NotificationContext';

interface AllRolesPanelProps {
  roles: Role[];
  hubId: number;
  memberId: number;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  open: boolean;
  username: string;
}

const AllRolesPanel: React.FC<AllRolesPanelProps> = ({
  roles,
  hubId,
  memberId,
  onClose,
  anchorEl,
  open,
  username
}) => {
  const { notify } = useNotification();
  const [page, setPage] = useState(0);
  const [size] = useState(30);
  const panelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const [allRoles, setAllRoles] = useState<Role[]>(roles);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [removeRole] = useRemoveRoleMutation({
    fixedCacheKey: 'removeRole'
  });

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    setPage(prev => prev + 1);
  }, [isLoadingMore, hasMore]);

  useEffect(() => {
    const handleScroll = () => {
      if (!panelRef.current || isLoadingMore || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = panelRef.current;
      const scrollPosition = scrollTop + clientHeight;
      const scrollPercentage = (scrollPosition / scrollHeight) * 100;

      if (scrollPercentage >= 60) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
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
  }, [isLoadingMore, hasMore, loadMore]);

  useEffect(() => {
    if (roles) {
      setAllRoles(prev => {
        if (page === 0) return roles;
        const newRoles = roles.filter(
          newRole => !prev.some(existingRole => existingRole.id === newRole.id)
        );
        return [...prev, ...newRoles];
      });
      setHasMore(roles.length >= size);
      setIsLoadingMore(false);
    }
  }, [roles, page, size]);

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
      setAllRoles(roles);
      setHasMore(true);
      setIsLoadingMore(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    }
  }, [open, roles]);

  const handleDeleteRole = async (e: React.MouseEvent, roleId: number) => {
    e.preventDefault();
    e.stopPropagation();

    const roleToRemove = roles.find(r => r.id === roleId);
    if (!roleToRemove) return;

    try {
      await removeRole({
        hubId,
        memberId,
        roleId
      }).unwrap();
      notify(`Роль "${roleToRemove.name}" удалена у пользователя "${username}"`, 'success');
    } catch (error) {
      // Ошибка обрабатывается автоматически через RTK Query
    }
  };

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

  // Filter roles based on search query
  const filteredRoles = allRoles.filter(role => {
    const searchPattern = searchQuery.toLowerCase();
    const roleName = role.name.toLowerCase();
    return roleName.includes(searchPattern);
  });

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
              maxHeight: '300px',
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
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.75rem',
                mb: 1
              }}
            >
              Все роли пользователя
            </Typography>
            <TextField
              size="small"
              placeholder="Поиск ролей..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.trim())}
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.1)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'rgba(255,255,255,0.3)',
                  },
                },
                '& .MuiInputBase-input': {
                  color: '#fff',
                  fontSize: '0.875rem',
                  '&::placeholder': {
                    color: 'rgba(255,255,255,0.5)',
                    opacity: 1,
                  },
                },
              }}
            />
            {filteredRoles.length > 0 ? (
              <>
                {filteredRoles.map((role: Role) => (
                  <Box
                    key={role.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      padding: '2px 8px',
                      height: '24px',
                      position: 'relative',
                      marginBottom: '2px',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        '& .delete-icon': {
                          opacity: 1,
                          transform: 'translate(0, 0)'
                        }
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
                        fontWeight: 500,
                        paddingRight: '4px'
                      }}
                    >
                      {role.name}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteRole(e, role.id)}
                      className="delete-icon"
                      sx={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        padding: '2px',
                        color: 'rgba(255,255,255,0.7)',
                        opacity: 0,
                        transform: 'translate(4px, -4px)',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(30,30,47,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        width: '16px',
                        height: '16px',
                        '&:hover': {
                          color: '#fff',
                          backgroundColor: 'rgba(255,105,180,0.2)',
                          borderColor: 'rgba(255,105,180,0.3)'
                        }
                      }}
                    >
                      <CloseIcon sx={{ fontSize: '0.75rem' }} />
                    </IconButton>
                  </Box>
                ))}
                {renderLoadingIndicator()}
              </>
            ) : (
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', textAlign: 'center' }}>
                {searchQuery ? 'Роли не найдены' : 'Нет ролей'}
              </Typography>
            )}
          </Paper>
        </Fade>
      )}
    </Popper>
  );
};

export default AllRolesPanel; 