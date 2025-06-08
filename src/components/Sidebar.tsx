import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  Avatar,
  Badge,
  Divider,
  Skeleton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import TagIcon from '@mui/icons-material/Tag';
import ChatIcon from '@mui/icons-material/Chat';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';
import { useLogoutMutation } from '../api/auth';
import { useGetHubsQuery, useCreateHubMutation } from '../api/hubs';
import { useGetPrivateChannelsQuery, useCreatePrivateChannelMutation, PrivateChannel } from '../api/channels';
import { useAppSelector } from '../hooks/redux';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import AppModal from './AppModal';
import HubSearchModal from './modals/HubSearchModal';
import UserSearchModal from './modals/UserSearchModal';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import { gradients } from '../theme/theme';
import PrivateChannelItem from './PrivateChannelItem';
import UserAvatar from './UserAvatar';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.user.currentUser);
  const [logoutMutation] = useLogoutMutation();
  const [createHub] = useCreateHubMutation();
  const [createPrivateChannel] = useCreatePrivateChannelMutation();
  const [activeSection, setActiveSection] = useState('hubs');
  const [createHubOpen, setCreateHubOpen] = useState(false);
  const [createHubLoading, setCreateHubLoading] = useState(false);
  const [hubSearchOpen, setHubSearchOpen] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  
  // Получаем ID хаба из URL
  const currentHubId = React.useMemo(() => {
    const match = location.pathname.match(/^\/hub\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }, [location.pathname]);

  // Автоматически переключаем активный раздел в зависимости от роута
  React.useEffect(() => {
    if (location.pathname.startsWith('/hub/')) {
      setActiveSection('hubs');
    } else if (location.pathname.startsWith('/p-channel/')) {
      setActiveSection('chats');
    } else if (location.pathname === '/') {
      // На главной странице не меняем активный раздел
    }
  }, [location.pathname]);


  const { data: hubsData = [], isLoading: hubsLoading, refetch } = useGetHubsQuery({
    page: 0,
    size: 50,
    sort: 'createdAt,desc'
  });

  const hubValidationSchema = Yup.object().shape({
    name: Yup.string()
      .required('Обязательное поле')
      .max(30, 'Максимум 30 символов')
      .test('max-length', 'Максимум 30 символов', value => !value || value.length <= 30),
    type: Yup.string()
      .required('Обязательное поле')
      .oneOf(['0', '1'], 'Неверный тип хаба')
  });

  const handleLogout = async () => {
    try {
      await logoutMutation().unwrap();
      navigate('/auth/login');
    } catch (error) {
      navigate('/auth/login');
    }
  };

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

  // Get private channels only when chats section is active
  const { data: privateChannelsData, isLoading: chatsLoading } = useGetPrivateChannelsQuery(undefined, {
    skip: activeSection !== 'chats', // Only fetch when chats section is active
  });
  
  // Ensure privateChannels is always an array
  const privateChannels: PrivateChannel[] = React.useMemo(() => {
    if (Array.isArray(privateChannelsData)) {
      return privateChannelsData;
    }
    // If data is undefined (query skipped) or not an array, return empty array
    if (privateChannelsData !== undefined) {
      console.warn('privateChannels is not an array:', privateChannelsData);
    }
    return [];
  }, [privateChannelsData]);

  const NavItem = ({ children, to, active, onClick, title, sx = {} }: any) => (
    <Tooltip title={title} placement="right">
      <IconButton
        component={to ? Link : 'button'}
        to={to}
        onClick={onClick}
        sx={{
          width: 50,
          height: 50,
          borderRadius: 3,
          color: active ? '#fff' : 'rgba(255,255,255,0.7)',
          background: active 
            ? 'linear-gradient(135deg, rgba(194,24,91,0.9) 0%, rgba(25,118,210,0.9) 100%)'
            : 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: active ? '0 8px 32px rgba(194,24,91,0.3)' : '0 4px 16px rgba(0,0,0,0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            background: active 
              ? 'linear-gradient(135deg, rgba(194,24,91,1) 0%, rgba(25,118,210,1) 100%)'
              : 'rgba(255,255,255,0.08)',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          },
          ...sx
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );

  return (
    <>
    <Box
      sx={{
        width: 90,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        background: 'linear-gradient(135deg, rgba(13,13,26,0.95) 0%, rgba(26,26,46,0.95) 100%)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 0%, rgba(194,24,91,0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
        },
        '& .simplebar-scrollbar::before': {
          backgroundColor: 'rgba(255,105,180,0.4)',
          width: '4px',
          left: '0',
          right: 'auto',
          opacity: 1,
          borderRadius: '4px',
          '&:hover': {
            backgroundColor: 'rgba(255,105,180,0.6)',
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
      {/* Main Navigation */}
      <Box sx={{ pb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <NavItem active={location.pathname === '/'} to="/" title="Главная">
          <HomeIcon />
        </NavItem>
      </Box>

      <Divider 
        sx={{ 
          borderColor: '#FF69B4',
          '&::before': {
            borderColor: '#FF69B4 !important',
          },
          boxShadow: '0 1px 3px rgba(255,105,180,0.3)',
        }} 
      />

      {/* Quick Access Navigation */}
      <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <NavItem 
          active={activeSection === 'hubs'} 
          onClick={() => setActiveSection('hubs')}
          title="Мои хабы"
          sx={activeSection === 'hubs' ? {
            background: 'linear-gradient(135deg, rgba(194,24,91,0.2) 0%, rgba(25,118,210,0.2) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,105,180,0.3)',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: -1,
              borderRadius: 3,
              padding: 1,
              background: 'linear-gradient(135deg, #FF69B4, #1976D2)',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'exclude',
              opacity: 0.5,
            }
          } : {}}
        >
          <TagIcon />
        </NavItem>
        <NavItem 
          active={activeSection === 'chats'} 
          onClick={() => setActiveSection('chats')}
          title="Личные чаты"
          sx={activeSection === 'chats' ? {
            background: 'linear-gradient(135deg, rgba(194,24,91,0.2) 0%, rgba(25,118,210,0.2) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,105,180,0.3)',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: -1,
              borderRadius: 3,
              padding: 1,
              background: 'linear-gradient(135deg, #FF69B4, #1976D2)',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'exclude',
              opacity: 0.5,
            }
          } : {}}
        >
            <ChatIcon />
          
        </NavItem>
      </Box>

      <Divider 
        sx={{ 
          borderColor: '#FF69B4',
          '&::before': {
            borderColor: '#FF69B4 !important',
          },
          boxShadow: '0 1px 3px rgba(255,105,180,0.3)',
        }} 
      />

      {/* Dynamic Content Section */}
      <Box sx={{ flex: 1, overflow: 'hidden', py: 2 }}>
        {activeSection === 'hubs' && (
          <SimpleBar
            style={{
              height: '100%',
              overflowX: 'hidden',
            }}
            scrollbarMinSize={40}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              {hubsLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <Skeleton
                    key={i}
                    variant="circular"
                    width={50}
                    height={50}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.1)',
                    }}
                    animation="wave"
                  />
                ))
              ) : (
                <>
                  {/* Search hubs button - now opens search modal */}
                  <NavItem 
                    onClick={() => setHubSearchOpen(true)} 
                    title="Найти или создать хаб"
                    sx={{
                      border: '2px dashed rgba(255,105,180,0.5)',
                      '&:hover': {
                        borderColor: '#FF69B4',
                        background: 'rgba(255,105,180,0.1)',
                        transform: 'scale(1.05)',
                        boxShadow: '0 4px 12px rgba(255,105,180,0.3)',
                      }
                    }}
                  >
                    <AddIcon sx={{ fontSize: 24, color: '#FF69B4' }} />
                  </NavItem>
                  
                  {/* Hubs list */}
                  {hubsData.map((hub) => (
                    <NavItem 
                      key={hub.id}
                      active={currentHubId === hub.id}
                      to={`/hub/${hub.id}`}
                      title={hub.name}
                    >
                      <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
                        {hub.name[0].toUpperCase()}
                      </Typography>
                    </NavItem>
                  ))}
                  
                </>
              )}
            </Box>
          </SimpleBar>
        )}

        {activeSection === 'chats' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            {/* Create new chat button */}
            <NavItem 
              onClick={() => setUserSearchOpen(true)} 
              title="Найти пользователя"
              sx={{
                border: '2px dashed rgba(255,105,180,0.5)',
                '&:hover': {
                  borderColor: '#FF69B4',
                  background: 'rgba(255,105,180,0.1)',
                  transform: 'scale(1.05)',
                  boxShadow: '0 4px 12px rgba(255,105,180,0.3)',
                }
              }}
            >
              <AddIcon sx={{ fontSize: 24, color: '#FF69B4' }} />
            </NavItem>
            
            {/* Chats list */}
            {chatsLoading ? (
              [1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  variant="circular"
                  width={50}
                  height={50}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                  }}
                  animation="wave"
                />
              ))
            ) : (
              privateChannels.map((channel) => {
                // For private channels (type = 2), show user avatar
                if (channel.type === 2 && channel.members && channel.members.length > 0) {
                  // Get the other user (not the current user)
                  const otherUser = channel.members.find(member => member.id !== user?.id) || channel.members[0];
                  
                  return (
                    <NavItem
                      key={channel.id}
                      active={location.pathname === `/p-channel/${channel.id}`}
                      onClick={() => navigate(`/p-channel/${channel.id}`, { state: { otherUser } })}
                      title={otherUser.login}
                      sx={{
                        background: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        cursor: 'pointer',
                        '&:hover': {
                          background: 'transparent',
                          transform: 'scale(1.1)',
                          boxShadow: 'none',
                        }
                      }}
                    >
                      <Box sx={{ position: 'relative' }}>
                        <UserAvatar
                          userId={otherUser.id}
                          src={otherUser.avatar || undefined}
                          alt={otherUser.login}
                          sx={{ 
                            width: 50, 
                            height: 50,
                            cursor: 'pointer',
                            borderRadius: '50%',
                            border: location.pathname === `/p-channel/${channel.id}` 
                              ? '2px solid #FF69B4' 
                              : '2px solid transparent',
                            transition: 'border-color 0.3s ease',
                            '&:hover': {
                              cursor: 'pointer',
                            }
                          }}
                          disableClick
                        />
                        {/* Online status indicator */}
                        {otherUser.presence === 'ONLINE' && (
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: 14,
                              height: 14,
                              backgroundColor: '#44b700',
                              borderRadius: '50%',
                              border: '2px solid #1a1a2e',
                            }}
                          />
                        )}
                      </Box>
                    </NavItem>
                  );
                }
                
                // Fallback for other channel types
                return (
                  <PrivateChannelItem 
                    key={channel.id}
                    channelId={channel.id}
                    channelName={channel.name}
                  />
                );
              })
            )}
          </Box>
        )}
      </Box>

      {/* Bottom Navigation */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2, gap: 2 }}>        
        <Divider 
          sx={{ 
            borderColor: '#FF69B4',
            '&::before': {
              borderColor: '#FF69B4 !important',
            },
            boxShadow: '0 1px 3px rgba(255,105,180,0.3)',
          }} 
        />
        
        {/* User Avatar */}
        <Avatar
          src={user?.avatar || ''}
          alt={user?.login || 'U'}
          sx={{
            width: 56,
            height: 56,
            pt: '7px',
            borderRadius: 3,
            border: '2px solid #C2185B',
            background: 'linear-gradient(135deg, rgba(35,35,58,0.9) 60%, rgba(30,30,47,0.9) 100%)',
            backdropFilter: 'blur(10px)',
            fontWeight: 700,
            fontSize: 28,
            color: '#fff',
            boxShadow: '0 4px 16px rgba(194,24,91,0.3)',
          }}
        >
          {user?.login ? user.login[0].toUpperCase() : 'U'}
        </Avatar>
        
        <NavItem title="Выйти" onClick={handleLogout}>
          <LogoutIcon />
        </NavItem>
      </Box>
    </Box>

    {/* Модальное окно создания хаба */}
    <AppModal
      open={createHubOpen}
      onClose={() => setCreateHubOpen(false)}
      title="Создать хаб"
    >
      <Formik
        initialValues={{ name: '', type: '1' }}
        validationSchema={hubValidationSchema}
        onSubmit={handleCreateHub}
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
              <Button 
                type="submit" 
                variant="contained" 
                disabled={isSubmitting || createHubLoading}
                sx={{
                  background: gradients.neon,
                  color: '#fff',
                  '&:hover': {
                    background: gradients.hover,
                    boxShadow: '0 4px 15px rgba(255,105,180,0.4)',
                  },
                  '&:disabled': {
                    background: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.3)',
                  }
                }}
              >
                Создать
              </Button>
            </Box>
          </Form>
        )}
      </Formik>
    </AppModal>
    
    <HubSearchModal 
      open={hubSearchOpen}
      onClose={() => setHubSearchOpen(false)}
      onCreateHub={() => {
        setHubSearchOpen(false);
        setCreateHubOpen(true);
      }}
    />

    <UserSearchModal 
      open={userSearchOpen}
      onClose={() => setUserSearchOpen(false)}
      onStartChat={async (selectedUser) => {
        try {
          // Создаем приватный канал с выбранным пользователем
          const result = await createPrivateChannel({ 
            members: [selectedUser.id] 
          }).unwrap();
          
          // Переходим к созданному/существующему каналу
          navigate(`/p-channel/${result.id}`, { state: { otherUser: selectedUser } });
          setUserSearchOpen(false);
        } catch (error) {
          console.error('Failed to create private channel:', error);
          // Если канал уже существует, API может вернуть его
          // Попробуем найти существующий канал в списке
          const existingChannel = privateChannels.find(channel => 
            channel.type === 2 && 
            channel.members?.some(member => member.id === selectedUser.id)
          );
          
          if (existingChannel) {
            const otherUser = existingChannel.members?.find(member => member.id === selectedUser.id);
            navigate(`/p-channel/${existingChannel.id}`, { state: { otherUser: otherUser || selectedUser } });
            setUserSearchOpen(false);
          }
        }
      }}
    />
    </>
  );
};  

export default Sidebar;