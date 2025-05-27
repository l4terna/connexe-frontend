import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            p: 3,
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'center'
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            Что-то пошло не так
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.5)' }}>
            Произошла ошибка при отображении сообщений
          </Typography>
          <Button 
            onClick={() => this.setState({ hasError: false, error: undefined })}
            variant="outlined"
            sx={{ 
              color: 'rgba(255,255,255,0.7)',
              borderColor: 'rgba(255,255,255,0.3)',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.5)',
                backgroundColor: 'rgba(255,255,255,0.05)'
              }
            }}
          >
            Попробовать снова
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;