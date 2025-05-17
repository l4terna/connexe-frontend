import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NavigationListener } from '@/components/NavigationListener';
import { TransitionLayout } from '@/components/TransitionLayout';
import PersistLoader from '@/components/PersistLoader';
import SharedLayout from '@/components/SharedLayout';
import { RequireAuth, AuthOnly } from './ProtectedRoute';
import RequireHubAccess from '@/components/RequireHubAccess';
import RequireHubPermission from './RequireHubPermission';

// Lazy load heavy components
const MainPage = lazy(() => import('@/pages/MainPage'));
const HubPage = lazy(() => import('@/pages/HubPage'));
const HubSettings = lazy(() => import('@/pages/HubSettings'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const AllHubsPage = lazy(() => import('@/pages/AllHubsPage'));
const AllChatsPage = lazy(() => import('@/pages/AllChatsPage'));

interface AppRouterProps {
  hubPageRef: React.MutableRefObject<{ updateHubData: () => Promise<void> }>;
}

const AppRouter: React.FC<AppRouterProps> = ({ hubPageRef }) => {
  return (
    <Router>
      <NavigationListener>
        <TransitionLayout>
          <Routes>
            <Route path="/auth/*" element={
              <AuthOnly>
                <Suspense fallback={<PersistLoader />}>
                  <AuthPage />
                </Suspense>
              </AuthOnly>
            } />
            
            <Route element={<RequireAuth><SharedLayout /></RequireAuth>}>
              <Route path="/" element={
                <Suspense fallback={null}>
                  <MainPage />
                </Suspense>
              } />
              
              <Route path="/hubs" element={
                <Suspense fallback={null}>
                  <AllHubsPage />
                </Suspense>
              } />
              
              <Route path="/chats" element={
                <Suspense fallback={null}>
                  <AllChatsPage />
                </Suspense>
              } />
              
              <Route path="/hub/:hubId" element={
                <RequireHubAccess>
                  <Suspense fallback={null}>
                    <HubPage />
                  </Suspense>
                </RequireHubAccess>
              } />
              
              <Route path="/hub/:hubId/channel/:channelId" element={
                <RequireHubAccess>
                  <Suspense fallback={null}>
                    <HubPage />
                  </Suspense>
                </RequireHubAccess>
              } />
              
              <Route path="/hub/:hubId/settings" element={
                <RequireHubPermission permission="MANAGE_HUB">
                  <Suspense fallback={null}>
                    <HubSettings hubPageRef={hubPageRef} />
                  </Suspense>
                </RequireHubPermission>
              } />
            </Route>
            
            <Route path="*" element={
              <Suspense fallback={<PersistLoader />}>
                <NotFoundPage />
              </Suspense>
            } />
          </Routes>
        </TransitionLayout>
      </NavigationListener>
    </Router>
  );
};

export default AppRouter;