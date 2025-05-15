import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AuthPage from './pages/AuthPage';
import { NotificationProvider } from './context/NotificationContext';
import MainPage from './pages/MainPage';
import HubPage from './pages/HubPage';
import HubSettings from './pages/HubSettings';
import NotFoundPage from './pages/NotFoundPage';
import { HubProvider } from './context/HubContext';
import { useGetHubMembershipQuery } from './api/hubs';
import { hasPermission, hasAnyPermission, PermissionKey } from './utils/rolePermissions';
import RequireHubAccess from './components/RequireHubAccess';
import { WebSocketProvider } from './websocket/WebSocketContext';

const theme = createTheme({
  palette: {
    primary: {
      main: '#FF69B4',
    },
    secondary: {
      main: '#1E90FF',
    },
  },
  components: {
    MuiTooltip: {
      defaultProps: {
        enterDelay: 600,
        arrow: true,
        disableInteractive: true,
        enterNextDelay: 600,
      },
      styleOverrides: {
        tooltip: {
          fontSize: '0.875rem',
          backgroundColor: 'rgba(30, 30, 47, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        },
        arrow: {
          color: 'rgba(30, 30, 47, 0.95)',
        },
      },
    },
  },
});

function isAuthenticated() {
  return Boolean(localStorage.getItem('jwt'));
}

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

const AuthOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const RequireHubPermission: React.FC<{ permission: PermissionKey; children: React.ReactNode }> = ({ permission, children }) => {
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

const App: React.FC = () => {
  const hubPageRef = React.useRef<{ updateHubData: () => Promise<void> }>({ updateHubData: async () => {} });
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <WebSocketProvider>
          <HubProvider>
            <Router>
              <Routes>
                <Route path="/auth/*" element={<AuthOnly><AuthPage /></AuthOnly>} />
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <MainPage />
                    </RequireAuth>
                  }
                />
                <Route path="/hub" element={<Navigate to="/" replace />} />
                <Route path="/hub/:hubId" element={
                  <RequireHubAccess>
                    <HubPage />
                  </RequireHubAccess>
                } />
                <Route path="/hub/:hubId/channel/:channelId" element={
                  <RequireHubAccess>
                    <HubPage />
                  </RequireHubAccess>
                } />
                <Route 
                  path="/hub/:hubId/settings" 
                  element={
                    <RequireAuth>
                      <RequireHubPermission permission="MANAGE_HUB">
                        <HubSettings hubPageRef={hubPageRef} />
                      </RequireHubPermission>
                    </RequireAuth>
                  } 
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Router>
          </HubProvider>
        </WebSocketProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App; 