import React from 'react';
import { useParams } from 'react-router-dom';
import { useGetHubMembershipQuery } from '@/api/hubs';
import NotFoundPage from '@/pages/NotFoundPage';
import PersistLoader from '@/components/PersistLoader';
import { usePersistReady } from '@/hooks/usePersistReady';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { Navigate } from 'react-router-dom';

interface RequireHubAccessProps {
  children: React.ReactNode;
}

const RequireHubAccess: React.FC<RequireHubAccessProps> = ({ children }) => {
  const { hubId } = useParams<{ hubId: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isPersistReady = usePersistReady();
  const [showLoader, setShowLoader] = React.useState(false);
  
  const { data: membershipData, isLoading } = useGetHubMembershipQuery(Number(hubId), {
    skip: !hubId || !token || !currentUser,
  });
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        setShowLoader(true);
      }
    }, 150);
    
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Wait for persistence rehydration
  if (!isPersistReady) {
    return <PersistLoader />;
  }

  // Check authentication
  if (!token || !currentUser) {
    return <Navigate to="/auth/login" replace />;
  }
  
  if (isLoading && showLoader) {
    return <PersistLoader />;
  }
  
  if (isLoading) {
    return null;
  }

  if (!membershipData) {
    return <NotFoundPage />;
  }

  return <>{children}</>;
};

export default RequireHubAccess;