import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction,
  Tooltip,
  Paper,
  FormControlLabel,
  Checkbox,
  Stack,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import RemoveIcon from '@mui/icons-material/Remove';
import { Role, useGetRolesQuery, useCreateRoleMutation, useDeleteRoleMutation, useUpdateRoleMutation } from '../../../api/roles';
import AppModal from '../../../components/AppModal';
import { PERMISSIONS, permissionsToBase62, base62ToPermissions } from '../../../utils/rolePermissions';
import { useDispatch } from 'react-redux';
import { useNotification } from '../../../context/NotificationContext';

// Определяем категории разрешений в соответствии с Permission enum
const PERMISSION_CATEGORIES = {
  GENERAL: {
    label: 'Общие',
    permissions: [
      { bit: 0, label: 'Просмотр каналов' }, // VIEW_CHANNELS
      { bit: 1, label: 'Управление каналами' }, // MANAGE_CHANNELS
      { bit: 2, label: 'Управление ролями' }, // MANAGE_ROLES
      { bit: 15, label: 'Управление категориями' }, // MANAGE_CATEGORIES
    ]
  },
  MEMBER: {
    label: 'Участники',
    permissions: [
      { bit: 3, label: 'Управление приглашениями' }, // MANAGE_INVITES
    ]
  },
  TEXT: {
    label: 'Текстовые каналы',
    permissions: [
      { bit: 4, label: 'Отправка сообщений' }, // SEND_MESSAGES
      { bit: 5, label: 'Управление сообщениями' }, // MANAGE_MESSAGES
      { bit: 6, label: 'Прикрепление файлов' }, // ATTACH_FILES
      { bit: 7, label: 'Добавление реакций' }, // ADD_REACTIONS
    ]
  },
  VOICE: {
    label: 'Голосовые каналы',
    permissions: [
      { bit: 8, label: 'Подключение к голосовому каналу' }, // VOICE_CONNECT
      { bit: 9, label: 'Разговор' }, // SPEAK
      { bit: 10, label: 'Отключение микрофона участников' }, // MUTE_MEMBERS
      { bit: 11, label: 'Отключение звука участников' }, // DEAFEN_MEMBERS
    ]
  },
  ADMIN: {
    label: 'Администрирование',
    permissions: [
      { bit: 12, label: 'Исключение участников' }, // KICK_MEMBERS
      { bit: 13, label: 'Бан участников' }, // BAN_MEMBERS
      { bit: 14, label: 'Управление хабом' }, // MANAGE_HUB
    ]
  }
};

// Предустановленные цвета для ролей
const ROLE_COLORS = [
  '#F50057', // Ярко-розовый
  '#D500F9', // Ярко-фиолетовый
  '#2979FF', // Ярко-синий
  '#00E5FF', // Ярко-бирюзовый
  '#00E676', // Ярко-зеленый
  '#FFEA00', // Ярко-желтый
  '#FF9100', // Ярко-апельсиновый
  '#FF3D00', // Ярко-оранжево-красный
];

interface RolesManagerProps {
  hubId: string;
  isActive: boolean;
}

const commonStyles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3,
    pb: 3,
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  title: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 600,
    fontSize: '1.25rem'
  },
  createButton: {
    background: '#FF69B4',
    '&:hover': {
      background: '#C71585',
    }
  },
  listItem: {
    background: 'rgba(30,30,47,0.3)',
    borderRadius: 1,
    mb: 1,
    '&:hover': {
      background: 'rgba(30,30,47,0.5)',
    }
  },
  editButton: {
    color: 'rgba(255,255,255,0.7)',
    '&:hover': {
      color: '#1E90FF',
      background: 'rgba(30,144,255,0.1)'
    }
  },
  deleteButton: {
    color: 'rgba(255,255,255,0.7)',
    '&:hover': {
      color: '#FF69B4',
      background: 'rgba(255,105,180,0.1)'
    }
  }
};

const roleSchema = Yup.object().shape({
  name: Yup.string()
    .required('Название роли обязательно')
    .min(1, 'Название должно содержать минимум 1 символ')
    .max(50, 'Название не должно превышать 50 символов'),
  color: Yup.string()
    .required('Цвет роли обязателен'),
  permissions: Yup.array()
    .of(Yup.number())
});

const RolesManager: React.FC<RolesManagerProps> = ({ hubId, isActive }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [roleColor, setRoleColor] = useState('#FF69B4');
  const [roleNameError, setRoleNameError] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const rolesContainerRef = useRef<HTMLDivElement>(null);
  const roleNameRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);
  const lastRequestTime = useRef(0);
  const dispatch = useDispatch();
  const { notify } = useNotification();

  const { data: rolesData, refetch: refetchRoles } = useGetRolesQuery({ 
    hubId: Number(hubId),
    page,
    size: 20
  }, {
    skip: !isActive || !initialLoadDone.current && page > 0
  });
  const [createRole] = useCreateRoleMutation();
  const [updateRole] = useUpdateRoleMutation();
  const [deleteRole] = useDeleteRoleMutation();

  useEffect(() => {
    
    if (rolesData?.content) {
      if (page === 0) {
        setRoles(rolesData.content);
        initialLoadDone.current = true;
        setInitialLoading(false);
      } else {
        setRoles(prev => [...prev, ...rolesData.content]);
      }
      setHasMore(!rolesData.last);
      setIsLoading(false);
    }
  }, [rolesData]);

  const handleLoadMore = useCallback(() => {
    const now = Date.now();
    if (!isLoading && hasMore && now - lastRequestTime.current > 1000) {
      setIsLoading(true);
      lastRequestTime.current = now;
      setPage(prev => prev + 1);
    }
  }, [isLoading, hasMore]);

  const handleScroll = useCallback(() => {
    if (!rolesContainerRef.current || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = rolesContainerRef.current;
    const scrollPosition = scrollTop + clientHeight;
    const scrollThreshold = scrollHeight * 0.5;

    if (scrollPosition >= scrollThreshold) {
      handleLoadMore();
    }
  }, [isLoading, hasMore, handleLoadMore]);

  useEffect(() => {
    const container = rolesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  const handleEditRole = (role: Role) => {
    setEditRole(role);
    setIsCreateRoleModalOpen(true);
  };

  const handleCreateRole = async () => {
    const roleName = roleNameRef.current?.value?.trim() || '';
    if (!roleName) {
      setRoleNameError('Обязательное поле');
      return;
    }
    try {
      const permissions = permissionsToBase62(selectedPermissions);
      if (editRole) {
        const isSameName = roleName === editRole.name;
        const isSameColor = roleColor === editRole.color;
        const isSamePerms = permissions === editRole.permissions;

        if (isSameName && isSameColor && isSamePerms) {
          setIsCreateRoleModalOpen(false);
          setEditRole(null);
          setRoleColor(ROLE_COLORS[0]);
          setRoleNameError('');
          setSelectedPermissions([]);
          return;
        }

        await updateRole({
          hubId: Number(hubId),
          roleId: editRole.id,
          data: {
            name: roleName,
            color: roleColor,
            permissions
          }
        }).unwrap();
        
        // Обновляем роль в локальном состоянии
        setRoles(prevRoles => 
          prevRoles.map(role => 
            role.id === editRole.id 
              ? { ...role, name: roleName, color: roleColor, permissions }
              : role
          )
        );
        notify('Роль успешно обновлена', 'success');
      } else {
        const response = await createRole({
          hubId: Number(hubId),
          data: {
            name: roleName,
            color: roleColor,
            permissions
          }
        }).unwrap();
        
        // Добавляем новую роль в начало списка
        setRoles(prevRoles => [response, ...prevRoles]);
        notify('Роль успешно создана', 'success');
      }
      
      setIsCreateRoleModalOpen(false);
      setEditRole(null);
      setRoleColor(ROLE_COLORS[0]);
      setSelectedPermissions([]);
    } catch (e: any) {
      if (e.data?.type === 'ALREADY_EXISTS') {
        setRoleNameError('Роль с таким названием уже существует');
      } else {
        setRoleNameError('Ошибка сохранения роли');
      }
    }
    if (roleNameRef.current) roleNameRef.current.value = '';
  };

  const handleDeleteRole = async (roleId: number) => {
    try {
      await deleteRole({
        hubId: Number(hubId),
        roleId
      }).unwrap();
      
      // Удаляем роль из текущего списка
      setRoles(prevRoles => prevRoles.filter(role => role.id !== roleId));
      notify('Роль успешно удалена', 'success');
    } catch (error) {
      console.error('Error deleting role:', error);
      notify('Ошибка при удалении роли', 'error');
    }
    setDeleteConfirmOpen(false);
    setRoleToDelete(null);
  };

  // Функция для получения всех разрешений категории
  const getCategoryPermissions = (category: keyof typeof PERMISSION_CATEGORIES) => {
    return PERMISSION_CATEGORIES[category].permissions.map(perm => perm.bit);
  };

  // Функция для проверки, выбраны ли все разрешения категории
  const isCategoryFullySelected = (category: keyof typeof PERMISSION_CATEGORIES, selectedPermissions: number[]) => {
    const categoryPermissions = getCategoryPermissions(category);
    return categoryPermissions.every(perm => selectedPermissions.includes(perm));
  };

  // Функция для проверки, выбраны ли некоторые разрешения категории
  const isCategoryPartiallySelected = (category: keyof typeof PERMISSION_CATEGORIES, selectedPermissions: number[]) => {
    const categoryPermissions = getCategoryPermissions(category);
    return categoryPermissions.some(perm => selectedPermissions.includes(perm));
  };

  return (
    <Box>
      <Box sx={commonStyles.header}>
        <Typography sx={commonStyles.title}>
          Управление ролями
        </Typography>
  
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => {
            setEditRole(null);
            setRoleColor(ROLE_COLORS[0]);
            setSelectedPermissions([]);
            setIsCreateRoleModalOpen(true);
          }}
          sx={commonStyles.createButton}
        >
          Создать
        </Button>
      </Box>

      <Paper 
        ref={rolesContainerRef}
        sx={{ 
          background: 'rgba(30,30,47,0.95)',
          maxHeight: '60vh',
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(255,255,255,0.2)',
            },
          },
          boxShadow: 'none',
          border: 'none'
        }}
      >
        {!initialLoading && !isLoading && roles.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'rgba(255,255,255,0.5)'
          }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', py: 4 }}>
              Нет ролей
            </Typography>
          </Box>
        ) : (
          <List>
            {roles.map((role) => (
              <ListItem
                key={role.id}
                sx={commonStyles.listItem}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: role.color,
                          mr: 1
                        }}
                      />
                      <Typography sx={{ color: 'rgba(255,255,255,0.9)' }}>{role.name}</Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Редактировать">
                      <IconButton
                        edge="end"
                        onClick={() => handleEditRole(role)}
                        sx={commonStyles.editButton}
                      >
                        <EditOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Удалить">
                      <IconButton
                        edge="end"
                        onClick={() => {
                          setRoleToDelete(role.id);
                          setDeleteConfirmOpen(true);
                        }}
                        sx={commonStyles.deleteButton}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <AppModal
        open={isCreateRoleModalOpen}
        onClose={() => {
          setIsCreateRoleModalOpen(false);
          setEditRole(null);
          setRoleColor(ROLE_COLORS[0]);
          setRoleNameError('');
          setSelectedPermissions([]);
        }}
        title={editRole ? 'Редактирование роли' : 'Создание роли'}
        maxWidth='xl'
      >
        <Formik
          enableReinitialize
          initialValues={{
            name: editRole?.name || '',
            color: editRole?.color || ROLE_COLORS[0],
            permissions: editRole ? base62ToPermissions(editRole.permissions) : []
          }}
          validationSchema={roleSchema}
          onSubmit={async (values, { setSubmitting, setFieldError }) => {
            try {
              const permissions = permissionsToBase62(values.permissions);
              if (editRole) {
                const isSameName = values.name === editRole.name;
                const isSameColor = values.color === editRole.color;
                const isSamePerms = permissions === editRole.permissions;

                if (isSameName && isSameColor && isSamePerms) {
                  setIsCreateRoleModalOpen(false);
                  setEditRole(null);
                  setRoleColor(ROLE_COLORS[0]);
                  setSelectedPermissions([]);
                  return;
                }

                await updateRole({
                  hubId: Number(hubId),
                  roleId: editRole.id,
                  data: {
                    name: values.name,
                    color: values.color,
                    permissions
                  }
                }).unwrap();
                
                // Обновляем роль в локальном состоянии
                setRoles(prevRoles => 
                  prevRoles.map(role => 
                    role.id === editRole.id 
                      ? { ...role, name: values.name, color: values.color, permissions }
                      : role
                  )
                );
                notify('Роль успешно обновлена', 'success');
              } else {
                const response = await createRole({
                  hubId: Number(hubId),
                  data: {
                    name: values.name,
                    color: values.color,
                    permissions
                  }
                }).unwrap();
                
                // Добавляем новую роль в начало списка
                setRoles(prevRoles => [response, ...prevRoles]);
                notify('Роль успешно создана', 'success');
              }
              
              setIsCreateRoleModalOpen(false);
              setEditRole(null);
              setRoleColor(ROLE_COLORS[0]);
              setSelectedPermissions([]);
            } catch (e: any) {
              if (e.data?.type === 'ALREADY_EXISTS') {
                setFieldError('name', 'Роль с таким названием уже существует');
              } else {
                setFieldError('name', 'Ошибка сохранения роли');
              }
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting, setFieldValue }) => (
            <Form>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Field
                  as={TextField}
                  name="name"
                  label="Название роли"
                  variant="outlined"
                  error={touched.name && Boolean(errors.name)}
                  helperText={touched.name && errors.name}
                  sx={{
                    '& .MuiInputBase-input': {
                      color: 'rgba(255,255,255,0.7)'
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255,255,255,0.5)'
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.1)'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.2)'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: values.color
                    }
                  }}
                />

                <Box>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                    Цвет роли
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {ROLE_COLORS.map((color) => (
                      <Box
                        key={color}
                        onClick={() => setFieldValue('color', color)}
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: color,
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'scale(1.1)',
                            boxShadow: `0 0 0 2px rgba(255,255,255,0.2), 0 0 0 4px ${color}40`
                          },
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: values.color === color ? '16px' : '0',
                            height: values.color === color ? '16px' : '0',
                            borderRadius: '50%',
                            background: '#fff',
                            transition: 'all 0.2s ease-in-out',
                            boxShadow: `0 0 0 2px ${color}`
                          }
                        }}
                      />
                    ))}
                  </Box>
                </Box>

                <Box>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                    Разрешения
                  </Typography>
                  <Box sx={{ maxHeight: 300, overflowY: 'auto', pr: 1 }}>
                    {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
                      <Accordion
                        key={categoryKey}
                        sx={{
                          background: 'rgba(30,30,47,0.3)',
                          color: 'rgba(255,255,255,0.7)',
                          '&:before': {
                            display: 'none',
                          },
                          '&.Mui-expanded': {
                            margin: '8px 0',
                          },
                          '& .MuiAccordionSummary-root': {
                            minHeight: 48,
                            '&.Mui-expanded': {
                              minHeight: 48,
                            },
                          },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={
                            <ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />
                          }
                          sx={{
                            '& .MuiAccordionSummary-content': {
                              margin: '8px 0',
                            },
                          }}
                        >
                          <FormControlLabel
                            control={
                              <Box sx={{ position: 'relative' }}>
                                <Checkbox
                                  checked={isCategoryFullySelected(categoryKey as keyof typeof PERMISSION_CATEGORIES, values.permissions)}
                                  indeterminate={isCategoryPartiallySelected(categoryKey as keyof typeof PERMISSION_CATEGORIES, values.permissions) && 
                                    !isCategoryFullySelected(categoryKey as keyof typeof PERMISSION_CATEGORIES, values.permissions)}
                                  onChange={(e) => {
                                    const categoryPermissions = getCategoryPermissions(categoryKey as keyof typeof PERMISSION_CATEGORIES);
                                    const newPermissions = e.target.checked
                                      ? [...new Set([...values.permissions, ...categoryPermissions])]
                                      : values.permissions.filter(perm => !categoryPermissions.includes(perm));
                                    setFieldValue('permissions', newPermissions);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  sx={{
                                    color: 'rgba(255,255,255,0.3)',
                                    '&.Mui-checked': {
                                      color: values.color,
                                      '& .MuiSvgIcon-root': {
                                        animation: 'pulse 0.5s ease-in-out',
                                        backgroundColor: values.color,
                                      }
                                    },
                                    '&.MuiCheckbox-indeterminate': {
                                      color: values.color,
                                      opacity: 0.7,
                                      '& .MuiSvgIcon-root': {
                                        backgroundColor: values.color,
                                      }
                                    },
                                    '& .MuiSvgIcon-root': {
                                      borderRadius: '4px',
                                      padding: '2px',
                                    },
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'rgba(255,255,255,0.1)'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'rgba(255,255,255,0.2)'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      borderColor: values.color
                                    },
                                    '& .MuiCheckbox-root': {
                                      border: '1px solid rgba(255,255,255,0.1)',
                                      borderRadius: '4px',
                                      '&:hover': {
                                        borderColor: 'rgba(255,255,255,0.2)'
                                      }
                                    },
                                    '@keyframes pulse': {
                                      '0%': {
                                        transform: 'scale(1)',
                                      },
                                      '50%': {
                                        transform: 'scale(1.2)',
                                      },
                                      '100%': {
                                        transform: 'scale(1)',
                                      },
                                    },
                                  }}
                                />
                                {isCategoryFullySelected(categoryKey as keyof typeof PERMISSION_CATEGORIES, values.permissions) && (
                                  <CheckIcon
                                    sx={{
                                      position: 'absolute',
                                      top: '50%',
                                      left: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      color: '#000',
                                      fontSize: '1rem',
                                      pointerEvents: 'none',
                                    }}
                                  />
                                )}
                                {isCategoryPartiallySelected(categoryKey as keyof typeof PERMISSION_CATEGORIES, values.permissions) && 
                                 !isCategoryFullySelected(categoryKey as keyof typeof PERMISSION_CATEGORIES, values.permissions) && (
                                  <RemoveIcon
                                    sx={{
                                      position: 'absolute',
                                      top: '50%',
                                      left: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      color: '#000',
                                      fontSize: '1rem',
                                      pointerEvents: 'none',
                                    }}
                                  />
                                )}
                              </Box>
                            }
                            label={
                              <Box 
                                sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 1,
                                  pointerEvents: 'none'
                                }}
                              >
                                <Typography sx={{ 
                                  color: 'rgba(255,255,255,0.9)',
                                  fontWeight: 600,
                                  fontSize: '1rem'
                                }}>
                                  {category.label}
                                </Typography>
                                {isCategoryFullySelected(categoryKey as keyof typeof PERMISSION_CATEGORIES, values.permissions) && (
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      backgroundColor: values.color,
                                      boxShadow: `0 0 8px ${values.color}`,
                                      animation: 'glow 2s ease-in-out infinite',
                                    }}
                                  />
                                )}
                              </Box>
                            }
                            sx={{
                              margin: 0,
                              '&:hover': {
                                color: 'rgba(255,255,255,0.9)'
                              },
                              '& .MuiFormControlLabel-label': {
                                pointerEvents: 'none'
                              }
                            }}
                          />
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0 }}>
                          <Box sx={{ pl: 4 }}>
                            {category.permissions.map((perm) => (
                      <FormControlLabel
                        key={perm.bit}
                        control={
                          <Checkbox
                            checked={values.permissions.includes(perm.bit)}
                            onChange={(e) => {
                              const newPermissions = e.target.checked
                                ? [...values.permissions, perm.bit]
                                : values.permissions.filter(bit => bit !== perm.bit);
                              setFieldValue('permissions', newPermissions);
                            }}
                            sx={{
                              color: 'rgba(255,255,255,0.3)',
                              '&.Mui-checked': {
                                color: values.color
                              }
                            }}
                          />
                        }
                        label={perm.label}
                        sx={{
                          color: 'rgba(255,255,255,0.7)',
                          '&:hover': {
                            color: 'rgba(255,255,255,0.9)'
                          }
                        }}
                      />
                            ))}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Box>
                  {touched.permissions && errors.permissions && (
                    <Typography color="error" sx={{ mt: 1, fontSize: '0.75rem' }}>
                      {errors.permissions}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setIsCreateRoleModalOpen(false);
                      setEditRole(null);
                      setRoleColor(ROLE_COLORS[0]);
                      setSelectedPermissions([]);
                    }}
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      borderColor: 'rgba(255,255,255,0.2)',
                      '&:hover': {
                        borderColor: 'rgba(255,255,255,0.4)',
                        background: 'rgba(255,255,255,0.05)'
                      }
                    }}
                  >
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmitting}
                    sx={{
                      background: '#FF69B4',
                      '&:hover': {
                        background: '#C71585'
                      }
                    }}
                  >
                    {editRole ? 'Сохранить' : 'Создать'}
                  </Button>
                </Box>
              </Box>
            </Form>
          )}
        </Formik>
      </AppModal>

      <AppModal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setRoleToDelete(null);
        }}
        maxWidth="xl"
        title="Удалить роль?"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', py: 1 }}>
          <DeleteOutlineIcon sx={{ fontSize: 48, color: '#ff4444', mb: 1 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, textAlign: 'center' }}>
            Вы уверены, что хотите удалить эту роль? Это действие необратимо.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setRoleToDelete(null);
              }}
              sx={{ 
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.2)',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.4)'
                }
              }}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                if (roleToDelete) {
                  handleDeleteRole(roleToDelete);
                }
              }}
              sx={{
                background: '#ff4444',
                '&:hover': {
                  background: 'rgba(255,68,68,0.8)'
                }
              }}
            >
              Удалить
            </Button>
          </Box>
        </Box>
      </AppModal>
    </Box>
  );
};

export default RolesManager; 