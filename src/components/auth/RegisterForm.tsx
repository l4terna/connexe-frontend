import React, { useState } from 'react';
import {
  Button,
  Typography,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { EmailOutlined, LockOutline, PersonOutline, Visibility, VisibilityOff } from '@mui/icons-material';
import { useRegisterMutation } from '@/api/auth';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import Input from '@/components/common/Input';
import { useNavigate } from 'react-router-dom';

const registerSchema = Yup.object().shape({
  login: Yup.string()
    .min(3, 'Логин должен быть не менее 3 символов')
    .max(255, 'Логин не может быть длиннее 255 символов')
    .required('Логин обязателен'),
  email: Yup.string()
    .email('Некорректный email')
    .max(255, 'Email не может быть длиннее 255 символов')
    .required('Email обязателен'),
  password: Yup.string()
    .min(6, 'Пароль должен быть не менее 6 символов')
    .max(255, 'Пароль не может быть длиннее 255 символов')
    .required('Пароль обязателен'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Пароли не совпадают')
    .max(255, 'Пароль не может быть длиннее 255 символов')
    .required('Подтверждение пароля обязательно'),
});

const RegisterForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [register, { isLoading }] = useRegisterMutation();
  const navigate = useNavigate();

  const handleSubmit = async (values: { login: string; email: string; password: string }, { setSubmitting }: any) => {
    setError(null);
    try {
      const result = await register({ 
        login: values.login, 
        email: values.email, 
        password: values.password 
      }).unwrap();
      // Ensure Redux state is updated before navigation
      if (result) {
        // Small delay to ensure Redux state is fully updated
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
      }
    } catch (err: any) {
      setError(err.data?.message || 'Ошибка регистрации');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{ login: '', email: '', password: '', confirmPassword: '' }}
      validationSchema={registerSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting }) => (
        <Form>
          <Field
            component={Input}
            name="login"
            placeholder="Логин"
            fullWidth
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutline sx={{ color: '#FF69B4' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 2,
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

          <Field
            component={Input}
            name="email"
            placeholder="Email"
            type="email"
            fullWidth
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlined sx={{ color: '#1E90FF' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 2,
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

          <Field
            component={Input}
            name="password"
            placeholder="Пароль"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            margin="normal"
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
              mb: 2,
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

          <Field
            component={Input}
            name="confirmPassword"
            placeholder="Подтвердите пароль"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            margin="normal"
            sx={{
              mb: 3,
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
                mb: 2,
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
            size="large"
            disabled={isLoading || isSubmitting}
            sx={{
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
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </Button>
        </Form>
      )}
    </Formik>
  );
};

export default RegisterForm;