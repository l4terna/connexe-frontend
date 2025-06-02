import React from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { NotificationProvider } from '@/context/NotificationContext';
import { HubProvider } from '@/context/HubContext';
import { WebSocketProvider } from '@/websocket/WebSocketContext';
import { AppThemeProvider } from '@/context/ThemeContext';
import { SignedUrlProvider } from '@/context/SignedUrlContext';
import AppRouter from '@/router/AppRouter';

const App: React.FC = () => {
  const hubPageRef = React.useRef<{ updateHubData: () => Promise<void> }>({ updateHubData: async () => {} });
  
  return (
    <AppThemeProvider>
      <CssBaseline />
      <NotificationProvider>
        <WebSocketProvider>
          <SignedUrlProvider>
            <HubProvider>
              <AppRouter hubPageRef={hubPageRef} />
            </HubProvider>
          </SignedUrlProvider>
        </WebSocketProvider>
      </NotificationProvider>
    </AppThemeProvider>
  );
};

export default App;