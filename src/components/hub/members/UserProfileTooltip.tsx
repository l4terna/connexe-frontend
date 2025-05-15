import React, { useEffect, useRef, useState } from 'react';
import { Paper, Skeleton } from '@mui/material';
import { useGetUserProfileQuery } from '../../../api/users';
import UserProfileHeader from './UserProfileHeader';
import UserRolesList from '../roles/UserRolesList';

interface UserProfileTooltipProps {
  userId: number;
  hubId: number;
  anchorPoint: { x: number; y: number };
  onClose: () => void;
  className?: string;
  onAddClick: (e: React.MouseEvent) => void;
  addButtonRef: React.RefObject<HTMLButtonElement | null>;
  isRolesPanelOpen: boolean;
  onShowAllRoles: (e: React.MouseEvent) => void;
  allRolesButtonRef: React.RefObject<HTMLButtonElement | null>;
  isAllRolesPanelOpen: boolean;
}

const UserProfileTooltip: React.FC<UserProfileTooltipProps> = ({
  userId,
  hubId,
  anchorPoint,
  onClose,
  className,
  onAddClick,
  addButtonRef,
  isRolesPanelOpen,
  onShowAllRoles,
  allRolesButtonRef,
  isAllRolesPanelOpen
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { data: profile, isLoading, isError } = useGetUserProfileQuery({ userId, hubId });

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickInsideTooltip = tooltipRef.current?.contains(target);
      const isClickOnAddButton = addButtonRef?.current?.contains(target);
      const isClickOnAllRolesButton = allRolesButtonRef?.current?.contains(target);

      // Если клик внутри тултипа или на кнопках - ничего не делаем
      if (isClickInsideTooltip || isClickOnAddButton || isClickOnAllRolesButton) {
        return;
      }

      // Если открыт RolesPanel или AllRolesPanel и клик внутри тултипа - ничего не делаем
      if ((isRolesPanelOpen || isAllRolesPanelOpen) && isClickInsideTooltip) {
        return;
      }

      // В остальных случаях закрываем тултип с анимацией
      setIsVisible(false);
      setTimeout(onClose, 300); // Ждем завершения анимации
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, addButtonRef, allRolesButtonRef, isRolesPanelOpen, isAllRolesPanelOpen]);

  const commonStyles = {
    p: 2,
    position: 'fixed' as const,
    left: isVisible ? '0' : '-300px',
    top: '50%',
    transform: 'translateY(-50%)',
    transition: 'all 0.3s ease-in-out',
    zIndex: 9999,
    maxWidth: '250px',
    width: '100%',
    borderRadius: '0 8px 8px 0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    backgroundColor: 'rgba(30,30,47,1)',
    borderLeft: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRight: '1px solid rgba(255,255,255,0.1)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    opacity: isVisible ? 1 : 0
  };

  if (isLoading) {
    return (
      <Paper 
        ref={tooltipRef}
        className={className}
        sx={commonStyles}
      >
        <Skeleton variant="rectangular" width="100%" height={60} />
        <Skeleton variant="rectangular" width="100%" height={20} sx={{ mt: 2 }} />
      </Paper>
    );
  }

  if (isError || !profile) {
    return null;
  }

  return (
    <Paper 
      ref={tooltipRef} 
      className={className} 
      sx={commonStyles}
    >
      <UserProfileHeader profile={profile} hubId={hubId} />
      <UserRolesList 
        roles={profile.hub_member.roles || []}
        hubId={hubId}
        memberId={profile.hub_member.id}
        onShowAllRoles={onShowAllRoles}
        allRolesButtonRef={allRolesButtonRef}
        onAddClick={onAddClick}
        addButtonRef={addButtonRef}
        username={profile.user.login}
      />
    </Paper>
  );
};

export default UserProfileTooltip; 