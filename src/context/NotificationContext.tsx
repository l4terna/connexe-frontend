import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import { Snackbar, Alert } from '@mui/material';

interface NotificationOptions {
  severity?: 'error' | 'warning' | 'info' | 'success';
  message: string;
}

interface NotificationContextType {
  notify: (message: string, severity?: 'error' | 'warning' | 'info' | 'success') => void;
  showNotification: (options: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notify: () => {},
  showNotification: () => {},
});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'error' | 'warning' | 'info' | 'success'>('error');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const notify = (msg: string, sev: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    // Очищаем предыдущий таймер
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Закрываем предыдущее уведомление
    setOpen(false);

    // Устанавливаем новое уведомление после небольшой задержки
    setTimeout(() => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);

      // Устанавливаем новый таймер
      timerRef.current = setTimeout(() => {
        setOpen(false);
      }, 4000);
    }, 100);
  };

  const showNotification = (options: NotificationOptions) => {
    notify(options.message, options.severity || 'success');
  };

  // Глобальный доступ для window.notify
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__notify = notify;
  }

  // Очищаем таймер при размонтировании
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, showNotification }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          severity={severity} 
          variant="filled" 
          onClose={() => setOpen(false)}
          sx={{
            color: '#fff',
            '& .MuiAlert-message': {
              color: '#fff'
            },
            '& .MuiAlert-action': {
              color: '#fff'
            },
            '& .MuiAlert-icon': {
              color: '#fff'
            },
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}; 