import React from 'react';
import { Navigate } from 'react-router-dom';
import AuthPage from '@/pages/AuthPage';
import MainPage from '@/pages/MainPage';
import HubPage from '@/pages/HubPage';
import HubSettings from '@/pages/HubSettings';
import NotFoundPage from '@/pages/NotFoundPage';
import RequireHubAccess from '@/components/RequireHubAccess';
import { RequireAuth, AuthOnly } from './ProtectedRoute';
import RequireHubPermission from './RequireHubPermission';

export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  protected?: boolean;
  authOnly?: boolean;
  children?: RouteConfig[];
}

export const getRoutes = (hubPageRef: React.MutableRefObject<{ updateHubData: () => Promise<void> }>): RouteConfig[] => [
  {
    path: '/auth/*',
    element: <AuthOnly><AuthPage /></AuthOnly>,
  },
  {
    path: '/',
    element: <RequireAuth><MainPage /></RequireAuth>,
  },
  {
    path: '/hub',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/hub/:hubId',
    element: <RequireHubAccess><HubPage /></RequireHubAccess>,
  },
  {
    path: '/hub/:hubId/channel/:channelId',
    element: <RequireHubAccess><HubPage /></RequireHubAccess>,
  },
  {
    path: '/hub/:hubId/settings',
    element: (
      <RequireAuth>
        <RequireHubPermission permission="MANAGE_HUB">
          <HubSettings hubPageRef={hubPageRef} />
        </RequireHubPermission>
      </RequireAuth>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];