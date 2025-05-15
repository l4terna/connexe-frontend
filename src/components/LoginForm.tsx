import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useLoginMutation } from '../api/auth';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import Input from './common/Input';
import { useNavigate } from 'react-router-dom';

const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Некорректный email')
    .max(255, 'Email не может быть длиннее 255 символов')
    .required('Email обязателен'),
  password: Yup.string()
    .min(6, 'Пароль должен быть не менее 6 символов')
    .max(255, 'Пароль не может быть длиннее 255 символов')
    .required('Пароль обязателен'),
});

const LoginForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [login, { isLoading }] = useLoginMutation();
  const navigate = useNavigate();

  const handleSubmit = async (values: { email: string; password: string }, { setSubmitting }: any) => {
    setError(null);
    try {
      await login(values).unwrap();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.data?.message || 'Ошибка авторизации');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{ email: '', password: '' }}
      validationSchema={loginSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting }) => (
        <Form>
          <Field
            component={Input}
            name="email"
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            sx={{ mb: 2 }}
          />

          <Field
            component={Input}
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            margin="normal"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    sx={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 3 }}
          />

          {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={isLoading || isSubmitting}
            sx={{
              color: '#fff',
              py: 1.5,
              background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
              '&:hover': {
                background: 'linear-gradient(90deg, #FF1493 0%, #00BFFF 100%)',
              },
              '&.Mui-disabled': {
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.3)'
              }
            }}
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </Button>
        </Form>
      )}
    </Formik>
  );
};

export default LoginForm; 