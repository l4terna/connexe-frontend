import React from 'react';
import { useParams } from 'react-router-dom';
import { useGetHubMembershipQuery } from '@/api/hubs';
import NotFoundPage from '@/pages/NotFoundPage';
import { hasAnyPermission, PermissionKey } from '@/utils/rolePermissions';

interface RequireHubPermissionProps {
  permission: PermissionKey;
  children: React.ReactNode;
}

const RequireHubPermission: React.FC<RequireHubPermissionProps> = ({ permission, children }) => {
  const { hubId } = useParams<{ hubId: string }>();
  const { data: membershipData, isLoading } = useGetHubMembershipQuery(Number(hubId), {
    skip: !hubId,
  });

  if (isLoading) {
    return null; // или можно вернуть компонент загрузки
  }

  if (!membershipData?.roles) {
    return <NotFoundPage />;
  }

  const rolePermissions = membershipData.roles.map(role => role.permissions);
  const hasRequiredPermission = membershipData.is_owner || 
    hasAnyPermission(rolePermissions, ['MANAGE_ROLES', 'MANAGE_INVITES', 'MANAGE_HUB']);

  if (!hasRequiredPermission) {
    return <NotFoundPage />;
  }

  return <>{children}</>;
};

export default RequireHubPermission;