import React, { useState } from 'react';
import { Box, Avatar, IconButton, Typography, Tooltip, Skeleton, TextField, FormControl, InputLabel, Select, MenuItem, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import HomeIcon from '@mui/icons-material/Home';
import { useNavigate } from 'react-router-dom';
import { Hub, useGetHubsQuery, useCreateHubMutation } from '../api/hubs';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import AppModal from './AppModal';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';

interface SidebarProps {
  user: { id: number; login: string; avatar: string | null };
  hubs?: Hub[];
  onAdd: () => void;
  onSelect?: (hub: Hub) => void;
  selectedHubId?: string | number | null;
}

const SidebarSkeleton = () => {
  return (
    <Box
      sx={{
        width: 90,
        background: 'linear-gradient(135deg, #1E1E2F 60%, #1E1E2F 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 3,
        boxShadow: '2px 0 12px 0 rgba(30,30,47,0.4)',
        position: 'relative',
        borderRight: '2px solid',
        borderImage: 'linear-gradient(180deg, #3a2a5d 0%, #1976D2 100%) 1',
        zIndex: 2,
      }}
    >
      <Skeleton
        variant="circular"
        width={56}
        height={56}
        sx={{
          mb: 3,
          bgcolor: 'rgba(255,255,255,0.1)',
        }}
      />
      <Box sx={{ width: 40, borderBottom: '1px solid #33334d', mb: 1 }} />
      <Skeleton
        variant="circular"
        width={40}
        height={40}
        sx={{
          mb: 1,
          bgcolor: 'rgba(255,255,255,0.1)',
        }}
      />
      {[1, 2, 3].map((index) => (
        <Skeleton
          key={index}
          variant="circular"
          width={40}
          height={40}
          sx={{
            mb: 1,
            bgcolor: 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
      <Box sx={{ flex: 1 }} />
      <Skeleton
        variant="circular"
        width={40}
        height={40}
        sx={{
          mb: 1,
          bgcolor: 'rgba(255,255,255,0.1)',
        }}
      />
    </Box>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ user, hubs, onAdd, onSelect, selectedHubId }) => {
  const navigate = useNavigate();
  const { data: hubsData = [], isLoading, refetch } = useGetHubsQuery({
    page: 0,
    size: 50,
    sort: 'createdAt,desc'
  }, {
    refetchOnMountOrArgChange: true
  });

  const [createHub] = useCreateHubMutation();
  const [createHubOpen, setCreateHubOpen] = useState(false);
  const [createHubLoading, setCreateHubLoading] = useState(false);

  const hubValidationSchema = Yup.object().shape({
    name: Yup.string()
      .required('Обязательное поле')
      .max(30, 'Максимум 30 символов')
      .test('max-length', 'Максимум 30 символов', value => !value || value.length <= 30),
    type: Yup.string()
      .required('Обязательное поле')
      .oneOf(['0', '1'], 'Неверный тип хаба')
  });

  const handleCreateHub = async (values: { name: string; type: string }) => {
    setCreateHubLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', values.name.trim());
      formData.append('type', values.type);
      
      const result = await createHub(formData).unwrap();
      
      await refetch();
      setCreateHubOpen(false);
      
      // Если хаб успешно создан, перенаправляем на его страницу
      if (result.id) {
        navigate(`/hub/${result.id}`);
      }
    } catch (error) {
      window.notify && window.notify('Ошибка при создании хаба', 'error');
    } finally {
      setCreateHubLoading(false);
    }
  };

  if (isLoading) {
    return <SidebarSkeleton />;
  }

  return (
    <>
      <Box
        sx={{
          width: 90,
          background: 'linear-gradient(135deg, #1E1E2F 60%, #1E1E2F 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 3,
          boxShadow: '2px 0 12px 0 rgba(30,30,47,0.4)',
          position: 'relative',
          borderRight: '2px solid',
          borderImage: 'linear-gradient(180deg, #3a2a5d 0%, #1976D2 100%) 1',
          zIndex: 2,
          height: '100vh',
          overflow: 'hidden',
          '& .simplebar-scrollbar::before': {
            backgroundColor: 'rgba(194,24,91,0.4)',
            width: '4px',
            left: '0',
            right: 'auto',
            opacity: 1,
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'rgba(194,24,91,0.6)',
            },
          },
          '& .simplebar-track.simplebar-vertical': {
            width: '4px',
            right: '0',
            top: '0',
            bottom: '0',
            background: 'transparent',
          },
          '& .simplebar-track.simplebar-horizontal': {
            display: 'none',
          },
          '& .simplebar-scrollbar.simplebar-visible:before': {
            opacity: 1,
          },
          '& .simplebar-scrollbar:before': {
            transition: 'opacity 0.2s ease, background-color 0.2s ease',
          },
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <Avatar
            src={user.avatar || ''}
            alt={user.login || 'U'}
            sx={{
              width: 56,
              height: 56,
              mb: 3,
              border: '2px solid #C2185B',
              background: 'linear-gradient(135deg, #23233a 60%, #1E1E2F 100%)',
              fontWeight: 700,
              fontSize: 28,
              color: '#fff',
            }}
          >
            {user.login ? user.login[0].toUpperCase() : 'U'}
          </Avatar>
          <Box sx={{ width: 40, borderBottom: '1px solid #33334d', mb: 1 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
            <Tooltip title="Главная">
              <IconButton
                onClick={() => navigate('/')}
                sx={{
                  color: '#fff',
                  background: 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)',
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  mb: 1,
                  transition: 'transform 0.2s ease-in-out',
                  boxShadow: '0 2px 8px rgba(25,118,210,0.3)',
                  '&:hover': {
                    transform: 'scale(1.05)',
                  },
                }}
              >
                <HomeIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Создать хаб">
              <IconButton
                onClick={() => setCreateHubOpen(true)}
                sx={{
                  color: '#fff',
                  background: 'linear-gradient(135deg, #C2185B 0%, #8e1450 100%)',
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  transition: 'transform 0.2s ease-in-out',
                  boxShadow: '0 2px 8px rgba(194,24,91,0.3)',
                  '&:hover': {
                    transform: 'scale(1.05)',
                  },
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <SimpleBar
          style={{
            width: '100%',
            flex: 1,
            minHeight: 0,
          }}
          scrollbarMinSize={40}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {hubsData.map((hub) => (
              <Tooltip title={hub.name} key={hub.id} placement="right">
                <IconButton
                  onClick={() => onSelect ? onSelect(hub) : navigate(`/hub/${hub.id}`)}
                  sx={{
                    color: selectedHubId === hub.id ? '#fff' : '#C2185B',
                    background: selectedHubId === hub.id ? 'linear-gradient(135deg, #C2185B 0%, #1976D2 100%)' : 'rgba(194,24,91,0.1)',
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    mb: 1,
                    transition: 'transform 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: 16 }}>
                    {hub.name[0].toUpperCase()}
                  </Typography>
                </IconButton>
              </Tooltip>
            ))}
          </Box>
        </SimpleBar>

        <Box sx={{ flexShrink: 0 }}>
          <Tooltip title="Настройки">
            <IconButton 
              sx={{ 
                color: '#C2185B', 
                mb: 1,
                transition: 'transform 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <AppModal
        open={createHubOpen}
        onClose={() => setCreateHubOpen(false)}
        maxWidth="xl"
        title="Создать хаб"
      >
        <Formik
          initialValues={{
            name: '',
            type: '1'
          }}
          validationSchema={hubValidationSchema}
          onSubmit={async (values, { resetForm }) => {
            setCreateHubLoading(true);
            try {
              const formData = new FormData();
              formData.append('name', values.name.trim());
              formData.append('type', values.type);
              
              const result = await createHub(formData).unwrap();
              
              await refetch();
              resetForm();
              setCreateHubOpen(false);
              
              // Если хаб успешно создан, перенаправляем на его страницу
              if (result.id) {
                navigate(`/hub/${result.id}`);
              }
            } catch (error) {
              window.notify && window.notify('Ошибка при создании хаба', 'error');
            } finally {
              setCreateHubLoading(false);
            }
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, resetForm }) => (
            <Form>
              <TextField
                name="name"
                label="Название хаба"
                autoFocus
                margin="dense"
                fullWidth
                value={values.name}
                onChange={(e) => {
                  if (e.target.value.length <= 30) {
                    handleChange(e);
                  }
                }}
                onBlur={(e) => {
                  const trimmedValue = e.target.value.trim();
                  if (trimmedValue !== e.target.value) {
                    e.target.value = trimmedValue;
                    handleChange(e);
                  }
                  handleBlur(e);
                }}
                error={touched.name && Boolean(errors.name)}
                helperText={
                  <Typography 
                    component="span" 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      width: '100%'
                    }}
                  >
                    <span style={{ color: '#ff4444' }}>{touched.name && errors.name}</span>
                    <span style={{ color: values.name.length > 30 ? '#ff4444' : 'rgba(255,255,255,0.5)' }}>
                      {values.name.length}/30
                    </span>
                  </Typography>
                }
                sx={{ 
                  mb: 3,
                  '& .MuiInputBase-input': {
                    color: '#fff',
                    '&::placeholder': {
                      color: '#B0B0B0',
                      opacity: 1
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#B0B0B0'
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.2)'
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.4)'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#fff'
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
                  onBlur={handleBlur}
                  error={touched.type && Boolean(errors.type)}
                  sx={{ 
                    color: '#fff', 
                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.4)'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#fff'
                    }
                  }}
                >
                  <MenuItem value="0">Приватный</MenuItem>
                  <MenuItem value="1">Публичный</MenuItem>
                </Select>
                {touched.type && errors.type && (
                  <Typography sx={{ color: '#ff4444', fontSize: '0.75rem', mt: 1, ml: 2 }}>
                    {errors.type}
                  </Typography>
                )}
              </FormControl>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button 
                  onClick={() => {
                    resetForm();
                    setCreateHubOpen(false);
                  }} 
                  sx={{ color: '#B0B0B0' }}
                >
                  Отмена
                </Button>
                <Button 
                  type="submit"
                  variant="contained" 
                  color="primary"
                  disabled={createHubLoading}
                >
                  Создать
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </AppModal>
    </>
  );
};

export default Sidebar; 