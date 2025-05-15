import React, { useState } from 'react';
import { Box, Typography, Avatar, IconButton, Dialog, DialogContent, Button, Paper, Tooltip, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchModal from '../components/SearchModal';
import CloseIcon from '@mui/icons-material/Close';
import { Hub, useCreateHubMutation, useGetHubsQuery } from '../api/hubs';
import Sidebar from '../components/Sidebar';
import AppModal from '../components/AppModal';
import { Formik, Form } from 'formik';
import Input from '../components/common/Input';
import * as Yup from 'yup';

const getUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return {
      id: user.id || 0,
      login: user.login || '',
      avatar: typeof user.avatar === 'string' ? user.avatar : null
    };
  } catch {
    return {
      id: 0,
      login: '',
      avatar: null
    };
  }
};

const user = getUser();

const sidebarGradient = 'linear-gradient(135deg, #1E1E2F 60%, #1E1E2F 100%)';
const accentGradient = 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)';
const mainBg = '#181824';

const createHubSchema = Yup.object().shape({
  name: Yup.string()
    .max(30, 'Не более 30 символов')
    .required('Обязательное поле'),
  type: Yup.string().required('Обязательное поле'),
});

const MainPage: React.FC = () => {
  const navigate = useNavigate();
  const [createHubOpen, setCreateHubOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: hubs = [], refetch: refetchHubs } = useGetHubsQuery({});
  const [createHub] = useCreateHubMutation();

  return (
    <>
      <Box sx={{ display: 'flex', height: '100vh', background: mainBg }}>
        {/* Sidebar */}
        <Sidebar
          user={user}
          hubs={hubs}
          onAdd={() => setCreateHubOpen(true)}
          selectedHubId={null}
        />
        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: mainBg,
          }}
        >
          {/* Top Bar */}
          <Box
            sx={{
              height: 64,
              px: 4,
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(30,30,47,0.95)',
              borderBottom: '1px solid #23233a',
              boxShadow: '0 2px 8px 0 rgba(30,30,47,0.15)',
            }}
          >
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                background: accentGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: 1,
              }}
            >
              Welcome, {user.login || 'User'}!
            </Typography>
            <Box sx={{ flex: 1 }} />
            {/* Вернуть поиск и настройки */}
            <Tooltip title="Поиск пользователей или хабов">
              <IconButton sx={{ color: '#1E90FF', mr: 1 }} onClick={() => setSearchOpen(true)}>
                <SearchIcon />
              </IconButton>
            </Tooltip>
            <IconButton sx={{ color: '#FF69B4' }}>
              <SettingsIcon />
            </IconButton>
          </Box>
          {/* Content Area */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'radial-gradient(ellipse at 60% 40%, rgba(255,105,180,0.08) 0%, rgba(30,144,255,0.08) 100%)',
            }}
          >
            <Box
              sx={{
                p: 5,
                borderRadius: 4,
                background: 'rgba(30,30,47,0.85)',
                boxShadow: '0 4px 32px 0 rgba(255,105,180,0.08)',
                minWidth: 340,
                textAlign: 'center',
              }}
            >
              <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>
                🎉 Добро пожаловать!
              </Typography>
              <Typography variant="body1" sx={{ color: '#B0B0B0' }}>
                Это ваша уникальная главная страница.<br />
                Здесь будет чат, лента или любой другой контент.<br />
                Дизайн вдохновлён Discord, но с вашим фирменным стилем!
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Create Hub Modal */}
      <AppModal
        open={createHubOpen}
        onClose={() => setCreateHubOpen(false)}
        maxWidth="sm"
        title="Создать хаб"
      >
        <Formik
          initialValues={{ name: '', type: '1' }}
          validationSchema={createHubSchema}
          onSubmit={async (values, { setSubmitting, resetForm }) => {
            try {
              const formData = new FormData();
              formData.append('name', values.name);
              formData.append('type', values.type);
              await createHub(formData).unwrap();
              refetchHubs();
              setCreateHubOpen(false);
              resetForm();
            } catch (error) {
              // Можно добавить обработку ошибок
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form>
              <TextField
                fullWidth
                name="name"
                label="Название хаба"
                value={values.name}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.name && Boolean(errors.name)}
                helperText={
                  touched.name && errors.name
                    ? errors.name
                    : `${values.name.length}/30`
                }
                inputProps={{ maxLength: 30 }}
                sx={{
                  mb: 2,
                  '& .MuiInputBase-input': {
                    color: '#fff',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255,255,255,0.7)'
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.2)'
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.4)'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#FF69B4'
                  },
                  '& .MuiFormHelperText-root': {
                    color: 'rgba(255,255,255,0.5)'
                  }
                }}
              />
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="hub-type-label" sx={{ color: '#B0B0B0' }}>Тип хаба</InputLabel>
                <Select
                  name="type"
                  labelId="hub-type-label"
                  value={values.type}
                  label="Тип хаба"
                  onChange={handleChange}
                  sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
                >
                  <MenuItem value={"0"}>Приватный</MenuItem>
                  <MenuItem value={"1"}>Публичный</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={() => setCreateHubOpen(false)} sx={{ color: '#B0B0B0' }}>Отмена</Button>
                <Button type="submit" variant="contained" color="primary" disabled={isSubmitting}>
                  Создать
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </AppModal>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};

export default MainPage; 