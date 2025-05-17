import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Typography,
} from '@mui/material';
import { EmailOutlined, LockOutline, Visibility, VisibilityOff } from '@mui/icons-material';
import { useLoginMutation } from '@/api/auth';
import { useNavigate } from 'react-router-dom';

const LoginForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [login, { isLoading }] = useLoginMutation();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      const result = await login({
        email: formData.email,
        password: formData.password,
      }).unwrap();
      
      // Ensure Redux state is updated before navigation
      if (result) {
        // Small delay to ensure Redux state is fully updated
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
      }
    } catch (err: any) {
      setError(err.data?.message || 'Ошибка входа');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <TextField
        fullWidth
        placeholder="Email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        margin="normal"
        required
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <EmailOutlined sx={{ color: '#1E90FF' }} />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiInputBase-root': {
            color: '#fff',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 1,
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.08)',
            },
          },
          '& .MuiInputBase-input': {
            '&::placeholder': {
              color: 'rgba(255,255,255,0.5)',
              opacity: 1,
            },
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.1)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.3)',
          },
          '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#FF69B4',
          },
        }}
      />
      
      <TextField
        fullWidth
        placeholder="Password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        value={formData.password}
        onChange={handleChange}
        margin="normal"
        required
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LockOutline sx={{ color: '#FF69B4' }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                sx={{
                  color: 'rgba(255,255,255,0.5)',
                  '&:hover': {
                    color: '#FF69B4',
                  },
                }}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiInputBase-root': {
            color: '#fff',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 1,
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.08)',
            },
          },
          '& .MuiInputBase-input': {
            '&::placeholder': {
              color: 'rgba(255,255,255,0.5)',
              opacity: 1,
            },
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.1)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.3)',
          },
          '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1E90FF',
          },
        }}
      />
      
      {error && (
        <Typography 
          color="error" 
          sx={{ 
            mt: 2,
            fontSize: '14px',
            textAlign: 'center'
          }}
        >
          {error}
        </Typography>
      )}
      
      <Button
        fullWidth
        type="submit"
        variant="contained"
        disabled={isLoading}
        sx={{
          mt: 3,
          mb: 2,
          py: 1.5,
          background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
          color: '#fff',
          fontWeight: 600,
          borderRadius: 1,
          textTransform: 'none',
          fontSize: '16px',
          boxShadow: '0 4px 15px 0 rgba(255,105,180,0.3)',
          transition: 'all 0.3s ease',
          '&:hover': {
            background: 'linear-gradient(90deg, #FF1493 0%, #00BFFF 100%)',
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 20px 0 rgba(255,105,180,0.4)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
          '&.Mui-disabled': {
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.3)'
          }
        }}
      >
        {isLoading ? 'Вход...' : 'Войти'}
      </Button>
    </Box>
  );
};

export default LoginForm;