import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import { Snackbar, Alert } from '@mui/material';

interface NotificationContextType {
  notify: (message: string, severity?: 'error' | 'warning' | 'info' | 'success') => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notify: () => {},
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
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={severity} variant="filled" onClose={() => setOpen(false)}>
          {message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}; 