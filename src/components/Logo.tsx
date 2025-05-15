import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';

const whirl = keyframes`
  0% {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(180deg) scale(1.2);
  }
  100% {
    transform: rotate(360deg) scale(1);
  }
`;

const LogoContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(4),
}));

const LogoCircle = styled(Box)(({ theme }) => ({
  width: 60,
  height: 60,
  borderRadius: '50%',
  background: '#2D2D2D',
  border: '2px solid #424242',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: `${whirl} 3s infinite ease-in-out`,
  marginRight: theme.spacing(2),
  '&:hover': {
    border: '2px solid #616161',
  },
}));

const LogoText = styled(Typography)(({ theme }) => ({
  fontSize: '2rem',
  fontWeight: 'bold',
  color: '#FFFFFF',
  textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
}));

const Logo: React.FC = () => {
  return (
    <LogoContainer>
      <LogoCircle>
        <Box
          sx={{
            width: 30,
            height: 30,
            border: '2px solid #616161',
            borderRadius: '50%',
          }}
        />
      </LogoCircle>
      <LogoText>MyApp</LogoText>
    </LogoContainer>
  );
};

export default Logo; 