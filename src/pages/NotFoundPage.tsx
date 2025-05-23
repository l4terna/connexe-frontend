import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ 
      height: '100vh', 
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      position: 'relative',
    }}>
      {/* Main Content */}
      <Box sx={{ position: 'relative' }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            textAlign: 'center',
            gap: 3,
            p: 2,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(30,30,47,0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              width: '100%',
              maxWidth: 500,
              '&:hover': {
                boxShadow: '0 12px 48px rgba(255,105,180,0.2)',
                transform: 'translateY(-5px)',
                transition: 'all 0.3s ease-in-out',
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Box
                sx={{
                  backgroundColor: 'primary.main',
                  borderRadius: '50%',
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(255,105,180,0.3)',
                }}
              >
                <ErrorOutlineIcon sx={{ 
                  fontSize: 80, 
                  color: 'white',
                }} />
              </Box>
              
              <Typography 
                variant="h2" 
                component="h1" 
                sx={{ 
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #FF69B4 30%, #1E90FF 90%)',
                  backgroundClip: 'text',
                  textFillColor: 'transparent',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '8rem',
                  letterSpacing: '-0.05em',
                  lineHeight: 1,
                }}
              >
                404
              </Typography>
              
              <Typography 
                variant="h5" 
                component="h2" 
                sx={{ 
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                Страница не найдена
              </Typography>
              
              <Typography 
                variant="body1" 
                sx={{ 
                  maxWidth: 400,
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                Такой страницы не существует или у вас нет доступа к ней
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={() => navigate('/')}
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    background: 'linear-gradient(45deg, #FF69B4 30%, #1E90FF 90%)',
                    boxShadow: '0 4px 14px rgba(255,105,180,0.4)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      boxShadow: '0 6px 20px rgba(255,105,180,0.6)',
                      transform: 'translateY(-2px)',
                      background: 'linear-gradient(45deg, #FF69B4 40%, #1E90FF 100%)',
                    },
                    '&:active': {
                      transform: 'translateY(1px)',
                    },
                  }}
                >
                  Вернуться на главную
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate(-1)}
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.7)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.4)',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      transform: 'translateY(-2px)',
                    },
                    '&:active': {
                      transform: 'translateY(1px)', 
                    },
                  }}
                >
                  Назад
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default NotFoundPage; 