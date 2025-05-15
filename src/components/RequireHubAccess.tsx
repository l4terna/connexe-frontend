import React from 'react';
import { useParams } from 'react-router-dom';
import { useGetHubMembershipQuery } from '../api/hubs';
import NotFoundPage from '../pages/NotFoundPage';

interface RequireHubAccessProps {
  children: React.ReactNode;
}

const RequireHubAccess: React.FC<RequireHubAccessProps> = ({ children }) => {
  const { hubId } = useParams<{ hubId: string }>();
  const { data: membershipData, isLoading } = useGetHubMembershipQuery(Number(hubId), {
    skip: !hubId,
  });

  if (isLoading) {
    return null; // или можно вернуть компонент загрузки
  }

  if (!membershipData) {
    return <NotFoundPage />;
  }

  return <>{children}</>;
};

export default RequireHubAccess; 