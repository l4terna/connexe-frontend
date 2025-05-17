import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import PersistLoader from '@/components/PersistLoader';
import { usePersistReady } from '@/hooks/usePersistReady';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const RequireAuth: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const token = useSelector((state: RootState) => state.auth.token);
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isPersistReady = usePersistReady();
  
  // Wait for rehydration to complete
  if (!isPersistReady) {
    return <PersistLoader />;
  }
  
  // Check both token and user data
  if (!token || !currentUser) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

export const AuthOnly: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = useSelector((state: RootState) => state.auth.token);
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isPersistReady = usePersistReady();
  
  // Wait for rehydration to complete
  if (!isPersistReady) {
    return <PersistLoader />;
  }
  
  // Check both token and user data
  if (token && currentUser) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};