import React, { useState, useEffect } from 'react';
import { Box, Paper, Tabs, Tab } from '@mui/material';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import { useLocation, useNavigate } from 'react-router-dom';

const AuthPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (location.pathname === '/auth/register') setActiveTab(1);
    else setActiveTab(0);
  }, [location.pathname]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    navigate(newValue === 0 ? '/auth/login' : '/auth/register');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        minWidth: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(255,105,180,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 480,
          borderRadius: 2,
          background: 'rgba(20, 20, 30, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 105, 180, 0.1)',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          centered
          sx={{
            mb: 3,
            '& .MuiTabs-indicator': {
              background: '#424242',
            },
            '& .MuiTab-root': {
              color: '#B0B0B0',
              '&.Mui-selected': {
                color: '#FFFFFF',
              },
            },
          }}
        >
          <Tab label="Login" />
          <Tab label="Register" />
        </Tabs>
        {activeTab === 0 ? <LoginForm /> : <RegisterForm />}
      </Paper>
    </Box>
  );
};

export default AuthPage; 