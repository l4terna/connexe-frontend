import React, { useRef, useState } from 'react';
import UserProfileTooltip from './UserProfileTooltip';
import RolesPanel from '../roles/RolesPanel';
import AllRolesPanel from '../roles/AllRolesPanel';
import { useGetUserProfileQuery } from '@/api/users';

interface UserProfileContainerProps {
  userId: number;
  hubId: number;
  anchorPoint: { x: number; y: number };
  onClose: () => void;
  className?: string;
}

const UserProfileContainer: React.FC<UserProfileContainerProps> = ({
  userId,
  hubId,
  anchorPoint,
  onClose,
  className
}) => {
  const [isRolesPanelOpen, setIsRolesPanelOpen] = useState(false);
  const [isAllRolesPanelOpen, setIsAllRolesPanelOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const allRolesButtonRef = useRef<HTMLButtonElement>(null);
  const { data: profile } = useGetUserProfileQuery({ userId, hubId });

  const handleRolesPanelToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRolesPanelOpen(!isRolesPanelOpen);
  };

  const handleAllRolesPanelToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAllRolesPanelOpen(!isAllRolesPanelOpen);
  };

  return (
    <>
      <UserProfileTooltip
        userId={userId}
        hubId={hubId}
        anchorPoint={anchorPoint}
        onClose={onClose}
        className={className}
        onAddClick={(e) => handleRolesPanelToggle(e)}
        addButtonRef={addButtonRef}
        isRolesPanelOpen={isRolesPanelOpen}
        onShowAllRoles={handleAllRolesPanelToggle}
        allRolesButtonRef={allRolesButtonRef}
        isAllRolesPanelOpen={isAllRolesPanelOpen}
      />
      {profile && addButtonRef.current && (
        <RolesPanel
          hubId={hubId}
          onClose={() => setIsRolesPanelOpen(false)}
          anchorEl={addButtonRef.current}
          open={isRolesPanelOpen}
          memberId={profile.hub_member.id}
          profile={profile}
        />
      )}
      {profile && allRolesButtonRef.current && (
        <AllRolesPanel
          roles={profile.hub_member.roles || []}
          hubId={hubId}
          memberId={profile.hub_member.id}
          onClose={() => setIsAllRolesPanelOpen(false)}
          anchorEl={allRolesButtonRef.current}
          open={isAllRolesPanelOpen}
          username={profile.user.login}
        />
      )}
    </>
  );
};

export default UserProfileContainer; 