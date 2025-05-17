import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Switch, 
  FormControlLabel,
  IconButton,
  Stack,
  Tooltip,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Checkbox,
  FormGroup,
  Snackbar,
  Alert
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/router/paths';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Sidebar from '../components/Sidebar';
import AppModal from '../components/AppModal';
import Notification from '../components/Notification';
import { useGetHubsQuery, useCreateInviteMutation, useDeleteInviteMutation, useUpdateHubMutation, Hub, useDeleteHubMutation, useGetHubMembershipQuery } from '../api/hubs';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ru } from 'date-fns/locale';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InvitesTab from '../components/hub/settings/InvitesTab';
import RolesManager from '../components/hub/settings/RolesTabManager';
import { Formik, Form, Field } from 'formik';
import Input from '../components/common/Input';
import { useNotification } from '../context/NotificationContext';
import { useHubContext } from '../context/HubContext';
import * as Yup from 'yup';
import { hasPermission, isHubOwner } from '../utils/rolePermissions';
import { useAppSelector } from '../hooks/redux';

// Common styles
const commonStyles = {
  background: 'rgba(30,30,47,0.95)',
  borderColor: 'rgba(255,255,255,0.1)',
  textColor: 'rgba(255,255,255,0.7)',
  accentColor: '#FF69B4',
  primaryColor: '#1E90FF',
  errorColor: '#ff4444',
  inputStyles: {
    color: '#fff',
    '& .MuiInputBase-input': {
      color: '#fff',
      '&::placeholder': {
        color: 'rgba(255,255,255,0.7)',
        opacity: 1
      }
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
      borderColor: '#fff'
    }
  },
  buttonStyles: {
    color: '#fff',
    borderColor: 'rgba(255,255,255,0.2)',
    '&:hover': {
      borderColor: 'rgba(255,255,255,0.4)'
    }
  },
  modalStyles: {
    background: 'rgba(30,30,47,0.98)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
  },
  tabStyles: {
    color: 'rgba(255,255,255,0.7)',
    '&.Mui-selected': {
      color: '#FF69B4',
      fontWeight: 600
    },
    '&:hover': {
      color: '#FF69B4',
      opacity: 0.8
    }
  },
  paperStyles: {
    background: 'rgba(30,30,47,0.95)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
  }
};


interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`hub-settings-tabpanel-${index}`}
      aria-labelledby={`hub-settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const tabHashes = ['main', 'invites', 'roles'];

interface HubSettingsProps {
  hubPageRef: React.RefObject<{ updateHubData: () => Promise<void> }>;
}

interface CreateInviteDTO {
  maxUses?: number;
  expiresAt?: string;
}

interface CreateInviteFormValues {
  maxUses: string;
  expiresAt: string;
  isUnlimited: boolean;
}

const deleteHubSchema = Yup.object().shape({
  confirmName: Yup.string()
    .required('Обязательное поле')
    .test('matches-hub-name', 'Название не совпадает', function(value) {
      return value === this.parent.hubName;
    })
});

const HubSettings: React.FC<HubSettingsProps> = ({ hubPageRef }) => {
  const { hubId } = useParams<{ hubId: string }>();
  const navigate = useNavigate();
  const currentUser = useAppSelector(state => state.user.currentUser);
  const [tab, setTab] = useState(0);
  const [currentTabHash, setCurrentTabHash] = useState('main');
  const [isCreateInviteModalOpen, setIsCreateInviteModalOpen] = useState(false);
  const [isMaxUsesEnabled, setIsMaxUsesEnabled] = useState(false);
  const [isExpiresAtEnabled, setIsExpiresAtEnabled] = useState(false);
  const [maxUses, setMaxUses] = useState<string>('1');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [maxUsesError, setMaxUsesError] = useState('');
  const [expiresAtError, setExpiresAtError] = useState('');
  const [copyNotification, setCopyNotification] = useState(false);
  const [editNotification, setEditNotification] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [inviteToDelete, setInviteToDelete] = useState<number | null>(null);
  const [hubName, setHubName] = useState('');
  const [hubType, setHubType] = useState('1');
  const [initialName, setInitialName] = useState('');
  const [initialType, setInitialType] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [updateHub] = useUpdateHubMutation();
  const { notify } = useNotification();
  const { updateHubData } = useHubContext();
  const [deleteHubModalOpen, setDeleteHubModalOpen] = useState(false);
  const [deleteHub] = useDeleteHubMutation();
  const { data: membershipData, isLoading: isMembershipLoading } = useGetHubMembershipQuery(Number(hubId), {
    skip: !hubId,
  });

  const { data: hubs = [], refetch: refetchHubs } = useGetHubsQuery({});
  const hub = hubs.find(h => h.id === Number(hubId));
  const [createInvite] = useCreateInviteMutation();
  const [deleteInvite] = useDeleteInviteMutation();

  // Определяем доступные табы на основе разрешений
  const availableTabs = React.useMemo(() => {
    if (isMembershipLoading || !membershipData) {
      return [];
    }

    const tabs = [];
    const rolePermissions = membershipData.roles.map(role => role.permissions);
    
    // Если пользователь владелец, показываем все табы
    if (membershipData.is_owner) {
      return [
        { label: 'Основные', value: 0, hash: 'main' },
        { label: 'Приглашения', value: 1, hash: 'invites' },
        { label: 'Роли', value: 2, hash: 'roles' }
      ];
    }
    
    // Иначе проверяем разрешения
    if (hasPermission(rolePermissions, 'MANAGE_HUB', false)) {
      tabs.push({ label: 'Основные', value: 0, hash: 'main' });
    }
    if (hasPermission(rolePermissions, 'MANAGE_INVITES', false)) {
      tabs.push({ label: 'Приглашения', value: 1, hash: 'invites' });
    }
    if (hasPermission(rolePermissions, 'MANAGE_ROLES', false)) {
      tabs.push({ label: 'Роли', value: 2, hash: 'roles' });
    }
    
    return tabs;
  }, [membershipData, isMembershipLoading]);

  // Устанавливаем первый доступный таб при загрузке
  useEffect(() => {
    if (!isMembershipLoading && availableTabs.length > 0) {
      const hash = window.location.hash.slice(1);
      const tabIndex = availableTabs.findIndex(tab => tab.hash === hash);
      if (tabIndex >= 0) {
        setTab(tabIndex);
        setCurrentTabHash(hash);
      } else {
        setTab(0);
        setCurrentTabHash(availableTabs[0].hash);
      }
    }
  }, [availableTabs, isMembershipLoading]);

  useEffect(() => {
    if (hub) {
      setHubName(hub.name);
      setHubType(hub.type === 'PRIVATE' ? '0' : '1');
      setInitialName(hub.name);
      setInitialType(hub.type === 'PRIVATE' ? '0' : '1');
    }
  }, [hub]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
    const selectedTab = availableTabs[newValue];
    if (selectedTab) {
      setCurrentTabHash(selectedTab.hash);
      window.location.hash = selectedTab.hash;
    }
  };

  useEffect(() => {
    const currentTab = availableTabs.find(t => t.value === tab);
  }, [tab, availableTabs]);

  const getMinDate = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  };

  const getDefaultExpiresAt = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  };

  const validate = () => {
    let valid = true;
    setMaxUsesError('');
    setExpiresAtError('');
    if (!isUnlimited && (maxUses === '' || isNaN(Number(maxUses)))) {
      setMaxUsesError('Обязательное поле');
      valid = false;
    } else if (!isUnlimited && Number(maxUses) < 1) {
      setMaxUsesError('Минимум 1');
      valid = false;
    }
    if (expiresAt) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(expiresAt);
      if (selectedDate <= today) {
        setExpiresAtError('Дата должна быть больше сегодняшней');
        valid = false;
      }
    }
    return valid;
  };

  const handleMaxUsesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value === '' || (Number(value) >= 1)) {
      setMaxUses(value);
    }
  };

  const initialValues: CreateInviteFormValues = {
    maxUses: '1',
    expiresAt: getDefaultExpiresAt(),
    isUnlimited: false
  };

  const handleCreateInvite = async (values: CreateInviteFormValues) => {
    if (!validate()) return;
    try {
      const inviteData: CreateInviteDTO = {
        maxUses: values.isUnlimited ? -1 : (values.maxUses === '' ? undefined : Number(values.maxUses)),
        expiresAt: values.expiresAt ? `${values.expiresAt}T00:00:00Z` : undefined
      };
      await createInvite({
        hubId: Number(hubId),
        data: inviteData
      }).unwrap();
      setIsCreateInviteModalOpen(false);
    } catch (error) {
      console.error('Error creating invite:', error);
    }
  };

  const isCreateDisabled =
    (!isUnlimited && (maxUses === '' || isNaN(Number(maxUses)) || Number(maxUses) < 1)) ||
    (expiresAt && expiresAt < getMinDate()) ||
    Boolean(expiresAtError);

  useEffect(() => {
    if (isCreateInviteModalOpen) {
      setExpiresAt(getDefaultExpiresAt());
    }
  }, [isCreateInviteModalOpen]);

  const handleDeleteInvite = async (inviteId: number) => {
    try {
      await deleteInvite({
        hubId: Number(hubId),
        inviteId
      }).unwrap();
      setDeleteConfirmOpen(false);
      setInviteToDelete(null);
    } catch (error) {
      console.error('Error deleting invite:', error);
    }
  };

  const hasChanges = React.useMemo(() => {
    if (!hub) return false;
    return hubName !== initialName || hubType !== initialType;
  }, [hub, hubName, initialName, hubType, initialType]);

  const handleSaveHubSettings = async () => {
    if (!hubId || !hasChanges) return;
    
    try {
      const formData = new FormData();
      const trimmedName = hubName.trim();
      formData.append('name', trimmedName);
      formData.append('type', hubType);
      
      await updateHub({
        hubId: Number(hubId),
        data: formData
      }).unwrap();
      
      setInitialName(trimmedName);
       setInitialType(hubType);
      setHubName(trimmedName);
      notify('Настройки хаба успешно обновлены', 'success');
      
      // Обновляем данные в HubPage
      try {
        if (hubPageRef.current?.updateHubData) {
          await hubPageRef.current.updateHubData();
        } else {
          // Если ref не доступен, просто обновляем локальные данные
          const { data: updatedHubs = [] } = await refetchHubs();
          const updatedHub = updatedHubs.find((h: Hub) => h.id === Number(hubId));
          if (updatedHub) {
            setHubName(updatedHub.name);
            setHubType(updatedHub.type === 'PRIVATE' ? '0' : '1');
            setInitialName(updatedHub.name);
            setInitialType(updatedHub.type === 'PRIVATE' ? '0' : '1');
          }
        }
      } catch (error) {
        console.error('Error updating hub data:', error);
      }
    } catch (error) {
      console.error('Error updating hub:', error);
      notify('Ошибка при обновлении настроек хаба', 'error');
    }
  };

  const handleDeleteHub = async (values: { confirmName: string }) => {
    try {
      await deleteHub(Number(hubId)).unwrap();
      setDeleteHubModalOpen(false);
      notify('Хаб успешно удален', 'success');
      // Navigate to main page using React Router
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error deleting hub:', error);
      notify('Ошибка при удалении хаба', 'error');
    }
  };

  if (!hub) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Загрузка...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh', 
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
          zIndex: 0,
        }
      }}>
          <Box
            sx={{
              height: 64,
              px: 4,
              display: 'flex',
              alignItems: 'center',
              background: commonStyles.background,
              borderBottom: `1px solid ${commonStyles.borderColor}`,
              boxShadow: '0 2px 8px 0 rgba(30,30,47,0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <IconButton
              onClick={() => navigate(`/hub/${hubId}`)}
              sx={{
                color: commonStyles.accentColor,
                mr: 2,
                '&:hover': {
                  background: 'rgba(255,105,180,0.1)'
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 900,
                fontSize: '2rem',
                background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: 2,
                lineHeight: 1.1,
                textShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              Настройки хаба
            </Typography>
            <Box sx={{ flex: 1 }} />
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Paper sx={{ ...commonStyles.paperStyles, mb: 3 }}>
              <Tabs
                value={tab}
                onChange={handleTabChange}
                sx={{
                  borderBottom: `1px solid ${commonStyles.borderColor}`,
                  '& .MuiTab-root': commonStyles.tabStyles,
                  '& .MuiTabs-indicator': {
                    backgroundColor: commonStyles.accentColor,
                    height: 3
                  }
                }}
              >
                {availableTabs.map((tab) => (
                  <Tab key={tab.value} label={tab.label} />
                ))}
              </Tabs>

              <Box sx={{ p: 3 }}>
                {currentTabHash === 'main' && (
                  <Box sx={{ maxWidth: 600, mx: 'auto' }}>
                    <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
                      Основные настройки
                    </Typography>
                    <TextField
                      fullWidth
                      label="Название хаба"
                      variant="outlined"
                      value={hubName}
                      onChange={(e) => setHubName(e.target.value)}
                      inputProps={{ maxLength: 30 }}
                      helperText={`${hubName.length}/30`}
                      FormHelperTextProps={{
                        sx: { color: 'rgba(255,255,255,0.5)' }
                      }}
                      sx={{ mb: 2, ...commonStyles.inputStyles }}
                    />
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel sx={{ color: commonStyles.textColor }}>Тип хаба</InputLabel>
                      <Select
                        label="Тип хаба"
                        value={hubType}
                        onChange={(e) => setHubType(e.target.value)}
                        sx={{ 
                          ...commonStyles.inputStyles,
                          '& .MuiSelect-icon': {
                            color: commonStyles.textColor
                          }
                        }}
                      >
                        <MenuItem value="0">Приватный</MenuItem>
                        <MenuItem value="1">Публичный</MenuItem>
                      </Select>
                    </FormControl>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                      {membershipData?.is_owner && (
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => setDeleteHubModalOpen(true)}
                          sx={{
                            borderColor: 'rgba(255,68,68,0.5)',
                            color: '#ff4444',
                            '&:hover': {
                              borderColor: '#ff4444',
                              background: 'rgba(255,68,68,0.1)'
                            }
                          }}
                        >
                          Удалить хаб
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        onClick={handleSaveHubSettings}
                        disabled={!hasChanges}
                        sx={{
                          background: hasChanges ? 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)' : 'rgba(255,255,255,0.05)',
                          color: '#fff',
                          '&:disabled': {
                            background: 'rgba(255,255,255,0.2)',
                            color: 'rgba(255,255,255,0.5)'
                          },
                          '&:hover': {
                            background: hasChanges ? 'linear-gradient(90deg, #FF1493 0%, #00BFFF 100%)' : 'rgba(255,255,255,0.05)'
                          },
                          transition: 'all 0.2s ease',
                          opacity: hasChanges ? 1 : 0.7,
                          cursor: hasChanges ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Сохранить
                      </Button>
                    </Box>
                  </Box>
                )}

                {currentTabHash === 'invites' && (
                  <InvitesTab 
                    hubId={String(hub.id)} 
                    isActive={true}
                  />
                )}

                {currentTabHash === 'roles' && (
                  <RolesManager 
                    hubId={hubId!} 
                    isActive={true}
                    key={`roles-manager-${currentTabHash}`}
                  />
                )}
              </Box>
            </Paper>
          </Box>

        <AppModal
          open={isCreateInviteModalOpen}
          onClose={() => {
            setIsCreateInviteModalOpen(false);
          }}
          title="Создание приглашения"
          sx={commonStyles.modalStyles}
        >
          <Formik
            initialValues={initialValues}
            onSubmit={handleCreateInvite}
          >
            {({ values, setFieldValue }) => (
              <Form>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={values.isUnlimited}
                        onChange={(e) => {
                          setFieldValue('isUnlimited', e.target.checked);
                          if (e.target.checked) {
                            setFieldValue('maxUses', '');
                            setMaxUsesError('');
                          }
                        }}
                        sx={{
                          color: commonStyles.accentColor,
                          '&.Mui-checked': {
                            color: commonStyles.accentColor
                          }
                        }}
                      />
                    }
                    label="Без ограничений"
                    sx={{ color: commonStyles.textColor }}
                  />
                  {!values.isUnlimited && (
                    <Input
                      name="maxUses"
                      label="Максимальное количество использований"
                      type="number"
                      errorMessage={maxUsesError}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFieldValue('maxUses', value);
                        if (value === '' || parseInt(value) < 1) {
                          setMaxUsesError('Введите число больше 0');
                        } else {
                          setMaxUsesError('');
                        }
                      }}
                    />
                  )}
                  <DatePicker
                    label="Срок действия"
                    value={values.expiresAt ? new Date(values.expiresAt) : null}
                    onChange={(newValue) => {
                      if (newValue) {
                        setFieldValue('expiresAt', newValue.toISOString().split('T')[0]);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const selectedDate = new Date(newValue.toISOString().split('T')[0]);
                        if (selectedDate <= today) {
                          setExpiresAtError('Дата должна быть больше сегодняшней');
                        } else {
                          setExpiresAtError('');
                        }
                      } else {
                        setFieldValue('expiresAt', '');
                        setExpiresAtError('');
                      }
                    }}
                    minDate={new Date(getMinDate())}
                    maxDate={new Date(getMaxDate())}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!expiresAtError,
                        helperText: expiresAtError,
                        sx: commonStyles.inputStyles
                      },
                      openPickerButton: {
                        sx: {
                          color: commonStyles.textColor,
                          '&:hover': {
                            color: '#fff'
                          }
                        }
                      }
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                    <Button 
                      variant="outlined" 
                      onClick={() => {
                        setIsCreateInviteModalOpen(false);
                      }}
                      sx={commonStyles.buttonStyles}
                    >
                      Отмена
                    </Button>
                    <Button 
                      type="submit"
                      variant="contained" 
                      disabled={Boolean(isCreateDisabled)}
                      sx={{
                        background: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
                        color: '#fff',
                        '&:hover': {
                          background: 'linear-gradient(90deg, #FF1493 0%, #00BFFF 100%)'
                        }
                      }}
                    >
                      Создать
                    </Button>
                  </Box>
                </Box>
              </Form>
            )}
          </Formik>
        </AppModal>

        <Notification
          message="Код приглашения успешно скопирован"
          open={copyNotification}
          onClose={() => setCopyNotification(false)}
        />

        <AppModal
          open={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setInviteToDelete(null);
          }}
          
          title="Удалить приглашение?"
          sx={commonStyles.modalStyles}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', py: 1 }}>
            <DeleteOutlineIcon sx={{ fontSize: 48, color: commonStyles.errorColor, mb: 1 }} />
            <Typography sx={{ color: commonStyles.textColor, fontSize: 18, textAlign: 'center' }}>
              Вы уверены, что хотите удалить это приглашение? Это действие необратимо.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setInviteToDelete(null);
                }}
                sx={commonStyles.buttonStyles}
              >
                Отмена
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={async () => {
                  if (inviteToDelete) {
                    await handleDeleteInvite(inviteToDelete);
                  }
                }}
                sx={{
                  background: commonStyles.errorColor,
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

        <AppModal
          open={deleteHubModalOpen}
          onClose={() => setDeleteHubModalOpen(false)}
          
          title="Удалить хаб?"
          sx={{
            ...commonStyles.modalStyles,
            '& .MuiDialogContent-root': {
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none'
            }
          }}
        >
          <Formik
            initialValues={{ confirmName: '', hubName: hub?.name || '' }}
            validationSchema={deleteHubSchema}
            onSubmit={handleDeleteHub}
          >
            {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
              <Form>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', py: 1 }}>
                  <DeleteOutlineIcon sx={{ fontSize: 48, color: commonStyles.errorColor, mb: 1 }} />
                  <Typography sx={{ 
                    color: commonStyles.textColor, 
                    fontSize: 18, 
                    textAlign: 'center',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none'
                  }}>
                    Это действие необратимо и приведет к удалению всех данных хаба.
                  </Typography>
                  <Typography sx={{ 
                    color: commonStyles.textColor, 
                    fontSize: 16, 
                    textAlign: 'center',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none'
                  }}>
                    Для подтверждения введите название хаба: <strong>{hub?.name}</strong>
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    name="confirmName"
                    value={values.confirmName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Введите название хаба"
                    error={touched.confirmName && Boolean(errors.confirmName)}
                    helperText={touched.confirmName && errors.confirmName}
                    sx={{
                      ...commonStyles.inputStyles,
                      '& .MuiFormHelperText-root': {
                        color: commonStyles.errorColor
                      }
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setDeleteHubModalOpen(false)}
                      sx={commonStyles.buttonStyles}
                    >
                      Отмена
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      color="error"
                      disabled={isSubmitting || !values.confirmName || Boolean(errors.confirmName)}
                      sx={{
                        background: commonStyles.errorColor,
                        '&:hover': {
                          background: 'rgba(255,68,68,0.8)'
                        },
                        '&:disabled': {
                          background: 'rgba(255,68,68,0.3)',
                          color: 'rgba(255,255,255,0.5)'
                        }
                      }}
                    >
                      Удалить
                    </Button>
                  </Box>
                </Box>
              </Form>
            )}
          </Formik>
        </AppModal>
      </Box>
    </LocalizationProvider>
  );
};

export default HubSettings; 