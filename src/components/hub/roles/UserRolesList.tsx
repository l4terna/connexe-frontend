import React, { useState, useEffect } from 'react';
import { Box, IconButton, Fade, Collapse} from '@mui/material';
import { Role } from '../../../api/roles';
import { useRemoveRoleMutation } from '../../../api/roles';
import CloseIcon from '@mui/icons-material/Close';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import AddIcon from '@mui/icons-material/Add';
import { useNotification } from '../../../context/NotificationContext';

interface UserRolesListProps {
  roles: Role[];
  hubId: number;
  memberId: number;
  onShowAllRoles: (e: React.MouseEvent<HTMLButtonElement>) => void;
  allRolesButtonRef: React.RefObject<HTMLButtonElement | null>;
  onAddClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  addButtonRef?: React.RefObject<HTMLButtonElement | null>;
  username: string;
}

const UserRolesList: React.FC<UserRolesListProps> = ({
  roles,
  hubId,
  memberId,
  onShowAllRoles,
  allRolesButtonRef,
  onAddClick,
  addButtonRef,
  username
}) => {
  const { notify } = useNotification();
  const [removeRole] = useRemoveRoleMutation({
    fixedCacheKey: 'removeRole'
  });
  const [localRoles, setLocalRoles] = useState<Role[]>(roles);
  const [removedRoles, setRemovedRoles] = useState<Map<number, Role>>(new Map());
  const [exitingRoles, setExitingRoles] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLocalRoles(roles);
  }, [roles]);

  const handleDeleteRole = async (e: React.MouseEvent, roleId: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Сохраняем удаляемую роль для возможного отката
    const roleToRemove = localRoles.find(r => r.id === roleId);
    if (!roleToRemove) return;

    // Добавляем роль в список выходящих для анимации
    setExitingRoles(prev => new Set(prev).add(roleId));

    // Ждем завершения анимации перед удалением
    setTimeout(() => {
      setLocalRoles(prev => prev.filter(r => r.id !== roleId));
      setRemovedRoles(prev => new Map(prev).set(roleId, roleToRemove));
      setExitingRoles(prev => {
        const newSet = new Set(prev);
        newSet.delete(roleId);
        return newSet;
      });
    }, 200);

    try {
      await removeRole({
        hubId,
        memberId,
        roleId
      }).unwrap();
      
      setRemovedRoles(prev => {
        const newMap = new Map(prev);
        newMap.delete(roleId);
        return newMap;
      });
      notify(`Роль "${roleToRemove.name}" удалена у пользователя "${username}"`, 'success');
    } catch (error) {
      setLocalRoles(prev => [...prev, roleToRemove]);
      setRemovedRoles(prev => {
        const newMap = new Map(prev);
        newMap.delete(roleId);
        return newMap;
      });
    }
  };

  // Показываем только первые 3 роли, остальные скрываем
  const visibleRoles = localRoles.slice(0, 3);
  const hiddenRoles = localRoles.slice(3);

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 0.5,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        pt: 1
      }}>
        {visibleRoles.map((role: Role) => (
          <Collapse
            key={role.id}
            in={!exitingRoles.has(role.id)}
            timeout={200}
            sx={{
              '& .MuiCollapse-wrapper': {
                display: 'inline-block'
              }
            }}
          >
            <Fade in={!exitingRoles.has(role.id)} timeout={200}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '2px 8px',
                  height: '24px',
                  position: 'relative',
                  marginBottom: '4px',
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
            </Fade>
          </Collapse>
        ))}
      </Box>
      <Box sx={{ 
        display: 'flex', 
        gap: 0.5,
        mt: 1,
        pt: 1,
        borderTop: '1px solid rgba(255,255,255,0.1)'
      }}>
        {onAddClick && addButtonRef && (
          <IconButton
            ref={addButtonRef}
            size="small"
            onClick={onAddClick}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '2px 8px',
              height: '24px',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: '#fff'
              }
            }}
          >
            <AddIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        )}
        {hiddenRoles.length > 0 && (
          <IconButton
            ref={allRolesButtonRef}
            size="small"
            onClick={onShowAllRoles}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '2px 8px',
              height: '24px',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: '#fff'
              }
            }}
          >
            <MoreHorizIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
};

export default UserRolesList; 