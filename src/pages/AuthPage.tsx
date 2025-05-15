import React, { useState, useEffect } from 'react';
import { Box, Paper, Tabs, Tab } from '@mui/material';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import Logo from '../components/Logo';
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
        background: '#121212',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 480,
          borderRadius: 2,
          background: 'transparent',
          border: '1px solid #2D2D2D',
        }}
      >
        <Logo />
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