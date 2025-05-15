import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  IconButton,
  ListItemButton,
  Stack,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  styled,
  Tooltip,
  Skeleton,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SearchModal from '../components/SearchModal';
import { Hub, useGetHubsQuery, useGetHubMembershipQuery, HubMember } from '../api/hubs';
import Sidebar from '../components/Sidebar';
import AppModal from '../components/AppModal';
import { useGetCategoriesQuery, useCreateCategoryMutation, useUpdateCategoryPositionMutation, useDeleteCategoryMutation } from '../api/categories';
import { ChannelType, Channel as ChannelInterface, useCreateChannelMutation, useUpdateChannelMutation, useDeleteChannelMutation } from '../api/channels';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ChannelList from '../components/hub/channels/ChannelList';
import MainChatArea from '../components/hub/chat/MainChatArea';
import MembersSidebar from '../components/hub/members/MembersSidebar';
import { useHubContext } from '../context/HubContext';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { 
  hasPermission, 
  getMaxPermissionsBase62, 
  base62ToPermissions, 
  PERMISSIONS,
  hasAnyPermission,
  hasAllPermissions,
  PermissionKey
} from '@/utils/rolePermissions';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import NotFoundPage from './NotFoundPage';

// Styled components
const DraggableContainer = styled('div')<{ isDragging: boolean; transform?: string; transition?: string }>(({ isDragging }) => ({
  position: 'relative',
  transition: 'transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease',
  opacity: isDragging ? 0.8 : 1,
  cursor: isDragging ? 'grabbing' : 'grab',
  transform: isDragging ? 'scale(1.02)' : 'none',
  '&:hover': {
    opacity: isDragging ? 0.8 : 0.95,
  },
}));

const CategoryContainer = styled(Box)(({ theme }) => ({
  padding: '16px',
  marginBottom: '0',
  background: 'rgba(30,30,47,0.3)',
  borderRadius: '8px',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  width: '100%',
  '&:hover': {
    borderColor: 'rgba(255,105,180,0.2)',
    background: 'rgba(30,30,47,0.4)',
  },
  transition: 'all 0.2s ease-in-out',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
}));

const CategoryHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: '8px',
  padding: '8px 0',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  position: 'relative',
  '& .category-actions': {
    opacity: 0,
    transition: 'opacity 0.2s ease',
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    marginLeft: 0,
  },
  '&:hover .category-actions': {
    opacity: 1,
    pointerEvents: 'auto',
  },
  '& .drag-handle': {
    opacity: 0,
    transition: 'opacity 0.2s ease',
    cursor: 'grab',
    '&:active': {
      cursor: 'grabbing'
    }
  },
  '&:hover .drag-handle': {
    opacity: 1
  }
}));

const CategoryTitle = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flex: 1,
  cursor: 'grab',
  '&:active': {
    cursor: 'grabbing'
  }
}));

const TextChannelButton = styled(ListItemButton)(({ theme }) => ({
  borderRadius: 8,
  marginBottom: 8,
  background: 'rgba(30,30,47,0.95)',
  border: '1px solid rgba(255,255,255,0.05)',
  '&:hover': {
    background: 'rgba(255,255,255,0.05)',
    transform: 'translateX(5px)',
    borderColor: 'rgba(255,105,180,0.3)',
    '& .channel-icon': {
      color: '#FF69B4',
    },
    '& .settings-button': {
      opacity: 1,
      color: '#B0B0B0',
      '&:hover': {
        color: '#FF69B4',
      }
    }
  },
  transition: 'all 0.3s ease-in-out',
}));

const VoiceChannelButton = styled(ListItemButton)(({ theme }) => ({
  borderRadius: 8,
  marginBottom: 8,
  background: 'rgba(37,37,54,0.95)',
  border: '1px solid rgba(255,255,255,0.05)',
  '&:hover': {
    background: 'rgba(45,45,62,0.95)',
    transform: 'translateX(5px)',
    borderColor: 'rgba(30,144,255,0.3)',
    '& .channel-icon': {
      color: '#1E90FF',
    },
    '& .settings-button': {
      opacity: 1,
      color: '#B0B0B0',
      '&:hover': {
        color: '#1E90FF',
      }
    }
  },
  transition: 'all 0.3s ease-in-out',
}));

const MessageBubble = styled(Box)(({ theme }) => ({
  background: 'rgba(30,30,47,0.95)',
  borderRadius: '12px 12px 12px 0',
  padding: '12px 16px',
  maxWidth: '70%',
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: '-8px',
    bottom: 0,
    width: '16px',
    height: '16px',
    background: 'rgba(30,30,47,0.95)',
    clipPath: 'polygon(0 0, 100% 100%, 0 100%)',
  },
}));

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

type Category = { 
  id: string | number; 
  name: string; 
  channels: ChannelInterface[];
};

interface SortableCategoryProps {
  category: Category;
  children: React.ReactNode;
  onAddChannel: (categoryId: number | string) => void;
  onSettings: (cat: Category) => void;
  userPermissions: string[];
}

// Remove the entire SortableCategory component definition

// --- SortableChannel ---
// const SortableChannel: React.FC<{ channel: ChannelInterface; children: React.ReactNode }> = ({ channel, children }) => {
//   const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: channel.id });
//   return (
//     <div
//       ref={setNodeRef}
//       style={{
//         transform: CSS.Transform.toString(transform),
//         transition,
//         opacity: isDragging ? 0.7 : 1,
//         cursor: 'grab',
//       }}
//       {...attributes}
//       {...listeners}
//     >
//       {children}
//     </div>
//   );
// };

interface HubPageProps {
  forwardedRef?: React.RefObject<{ updateHubData: () => Promise<void> }>;
}

const HubPage: React.FC = () => {
  const navigate = useNavigate();
  const { hubId, channelId } = useParams<{ hubId: string; channelId?: string }>();
  const { setUpdateHubData } = useHubContext();
  
  const [searchOpen, setSearchOpen] = useState(false);
  const [createHubOpen, setCreateHubOpen] = useState(false);
  
  const { data: hubsData = [], isLoading: isHubsLoading } = useGetHubsQuery({});
  const { data: membershipData, isLoading: isMembershipLoading, error: membershipError } = useGetHubMembershipQuery(Number(hubId), {
    skip: !hubId,
  });

  const [currentHub, setCurrentHub] = React.useState<Hub | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType>(ChannelType.TEXT);
  const [activeCategoryId, setActiveCategoryId] = useState<number | string | null>(null);
  const [createCategoryLoading, setCreateCategoryLoading] = useState(false);
  const [createChannelLoading, setCreateChannelLoading] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [hubName, setHubName] = useState('');
  const [hubType, setHubType] = useState('1');
  const [categorySettingsOpen, setCategorySettingsOpen] = useState(false);
  const [categorySettingsId, setCategorySettingsId] = useState<number | string | null>(null);
  const [categorySettingsLoading, setCategorySettingsLoading] = useState(false);
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false);
  const [channelSettingsId, setChannelSettingsId] = useState<number | string | null>(null);
  const [channelSettingsLoading, setChannelSettingsLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState<ChannelInterface | null>(null);
  const [user, setUser] = useState<{ id: number; login: string; avatar: string | null }>(getUser());
  const [hubSettingsError, setHubSettingsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previousHubId, setPreviousHubId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  
  // Refs
  const isUpdatingRef = useRef(false);
  const updateQueueRef = useRef<Array<() => Promise<void>>>([]);
  const categorySettingsNameRef = useRef<HTMLInputElement>(null);
  const channelSettingsNameRef = useRef<HTMLInputElement>(null);

  // Sensors hook
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // RTK Query hooks
  const { data: categoriesData, isLoading: isCategoriesLoading } = useGetCategoriesQuery(Number(hubId));
  const { refetch: refetchHubs } = useGetHubsQuery({});
  const [createCategory] = useCreateCategoryMutation();
  const [updateCategoryPosition] = useUpdateCategoryPositionMutation();
  const [deleteCategory] = useDeleteCategoryMutation();
  const [createChannel] = useCreateChannelMutation();
  const [updateChannel] = useUpdateChannelMutation();
  const [deleteChannel] = useDeleteChannelMutation();

  // Simplified update hub data function
  const updateHubData = React.useCallback(async () => {
    try {
      await refetchHubs();
    } catch (error) {
      console.error('Error updating hub data:', error);
      if (window.notify) {
        window.notify('Failed to refresh hub data. Please try again.', 'error');
      }
    }
  }, [refetchHubs]);

  // Update currentHub when hubsData changes
  useEffect(() => {
    if (hubsData.length > 0 && hubId) {
      const hub = hubsData.find((h: Hub) => h.id === Number(hubId));
      setCurrentHub(hub || null);
    }
  }, [hubsData, hubId]);

  // Handle hub change
  useEffect(() => {
    if (hubId !== previousHubId) {
      setActiveChannel(null);
      setPreviousHubId(hubId || null);
      if (hubId) {
        refetchHubs();
      }
    }
  }, [hubId, previousHubId, refetchHubs]);

  React.useEffect(() => {
    setUpdateHubData(updateHubData);
  }, [setUpdateHubData, updateHubData]);

  useEffect(() => {
    const loadCategories = async () => {
      if (!currentHub?.id) return;
      
      if (categoriesData) {
        // Преобразуем каналы в правильный формат с enum
        const formattedChannels = categoriesData.channels.map((ch: any) => ({
          ...ch,
          type: ch.type === 0 ? ChannelType.VOICE : ChannelType.TEXT,
          categoryId: ch.category_id
        }));

        // Собираем категории с вложенными каналами
        const categoriesWithChannels = categoriesData.categories.map((cat: any) => ({
          ...cat,
          channels: formattedChannels.filter((ch: any) => ch.category_id === cat.id)
        }));

        setCategories(categoriesWithChannels);
      }
    };
    loadCategories();
  }, [currentHub, categoriesData]);

  // Update membership data when it changes
  useEffect(() => {
    if (membershipData) {
      // No need to set membership data again since we already have it
      // and we're using it directly in the component
    }
  }, [membershipData]);

  // Update permissions when membership data changes
  useEffect(() => {
    if (membershipData?.roles) {
      const rolePermissions = membershipData.roles.map(role => role.permissions);
      setUserPermissions(rolePermissions);

      // Get maximum permissions
      const maxPermissionsBase62 = getMaxPermissionsBase62(rolePermissions);

      // Decode maximum permissions to bits
      const maxPermissionBits = base62ToPermissions(maxPermissionsBase62);

      // Get specific permission names
      const specificPermissions = maxPermissionBits.map(bit => {
        const permission = PERMISSIONS.find(p => p.bit === bit);
        return permission ? permission.key : `Unknown permission (bit ${bit})`;
      });

      // Example of checking specific permissions
      const canManageHub = hasPermission(rolePermissions, 'MANAGE_HUB');
      const canManageContent = hasAnyPermission(rolePermissions, ['MANAGE_CHANNELS', 'MANAGE_CATEGORIES']);
      const canModerate = hasAllPermissions(rolePermissions, ['KICK_MEMBERS', 'BAN_MEMBERS']);
    }
  }, [membershipData]);

  // Add effect to handle channel selection from URL
  useEffect(() => {
    if (channelId && categories.length > 0) {
      const channel = categories
        .flatMap(cat => cat.channels)
        .find(ch => ch.id === Number(channelId));
      
      if (channel) {
        setActiveChannel(channel);
      }
    }
  }, [channelId, categories]);

  const handleCreateCategory = async (name: string) => {
    if (!name.trim() || !currentHub?.id) return;
    setCreateCategoryLoading(true);
    try {
      const res = await createCategory({
        hubId: Number(currentHub.id),
        name: name.trim()
      }).unwrap();
      setCategories([
        ...categories,
        { id: res.id, name: res.name, channels: [] },
      ]);
      setNewCategoryName('');
      setCreateCategoryOpen(false);
    } catch (e) {
      window.notify && window.notify('Ошибка при создании категории', 'error');
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !activeCategoryId || !currentHub?.id) return;
    setCreateChannelLoading(true);
    try {
      const res = await createChannel({
        hubId: Number(currentHub.id),
        categoryId: Number(activeCategoryId),
        data: {
          name: newChannelName.trim(),
          type: selectedChannelType,
          categoryId: Number(activeCategoryId)
        }
      }).unwrap();

      // Update categories with new channel
      setCategories((prevCategories: Category[]) =>
        prevCategories.map((cat: Category) =>
          cat.id === activeCategoryId
            ? {
                ...cat,
                channels: [...cat.channels, res],
              }
            : cat
        )
      );

      setNewChannelName('');
      setCreateChannelOpen(false);
    } catch (e) {
      window.notify && window.notify('Ошибка при создании канала', 'error');
    } finally {
      setCreateChannelLoading(false);
    }
  };

  const handleCreateHub = () => {
    const name = hubName.trim();
    if (!name) {
      setHubSettingsError('Обязательное поле');
      return;
    }
    // Implementation of handleCreateHub function
  };

  const processUpdateQueue = async () => {
    if (updateQueueRef.current.length === 0) {
      isUpdatingRef.current = false;
      return;
    }

    const nextUpdate = updateQueueRef.current[0];
    try {
      await nextUpdate();
    } catch (error) {
      console.error('Error updating category position:', error);
    } finally {
      updateQueueRef.current.shift();
      processUpdateQueue();
    }
  };

  const queueCategoryUpdate = (updateFn: () => Promise<void>) => {
    updateQueueRef.current.push(updateFn);
    
    if (!isUpdatingRef.current) {
      isUpdatingRef.current = true;
      processUpdateQueue();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setCategories((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      if (oldIndex === newIndex) {
        return items;
      }

      const newCategories = arrayMove(items, oldIndex, newIndex);
      
      if (currentHub?.id) {
        const newPosition = newIndex + 1;
        
        const updateFn = async () => {
          try {
            await updateCategoryPosition({
              hubId: Number(currentHub.id),
              categoryId: Number(active.id),
              data: {
                position: newPosition
              }
            }).unwrap();
          } catch (error) {
            window.notify && window.notify('Ошибка при обновлении позиции категории', 'error');
            setCategories(items);
            throw error;
          }
        };

        queueCategoryUpdate(updateFn);
      }

      return newCategories;
    });
  };

  // --- handleChannelDragEnd ---
  const handleChannelDragEnd = async (
    event: DragEndEvent,
    category: Category
  ) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = category.channels.findIndex((ch: ChannelInterface) => ch.id === active.id);
    const newIndex = category.channels.findIndex((ch: ChannelInterface) => ch.id === over.id);
    if (oldIndex === newIndex) return;

    // Create a copy of categories for optimistic update
    const newCategories = categories.map((cat: Category) => {
      if (cat.id !== category.id) return cat;
      const newChannels = arrayMove(cat.channels, oldIndex, newIndex);
      // Update positions for all channels in the category
      return {
        ...cat,
        channels: newChannels.map((channel, index) => ({
          ...channel,
          position: index + 1
        }))
      };
    });

    // Optimistically update UI
    setCategories(newCategories);

    try {
      // Update positions for all channels in the category
      const updatedChannels = newCategories.find(cat => cat.id === category.id)?.channels || [];
      await Promise.all(
        updatedChannels.map(channel =>
          updateChannel({
            channelId: channel.id,
            data: {
              category_id: category.id as number,
              position: channel.position
            }
          }).unwrap()
        )
      );
    } catch (error) {
      // Revert to previous state on error
      setCategories(categories);
      window.notify && window.notify('Ошибка при обновлении позиции канала', 'error');
    }
  };

  // --- Category Settings Handler ---
  const openCategorySettings = (cat: Category) => {
    setCategorySettingsId(cat.id);
    setCategorySettingsOpen(true);
  };

  const handleCategorySettingsSave = async () => {
    if (!categorySettingsId || !currentHub?.id) return;
    const name = categorySettingsNameRef.current?.value.trim() || '';
    if (!name) return;
    const original = categories.find(cat => cat.id === categorySettingsId);
    if (original && original.name.trim() === name) {
      setCategorySettingsOpen(false);
      return;
    }
    setCategorySettingsLoading(true);
    try {
      await updateCategoryPosition({
        hubId: Number(currentHub.id),
        categoryId: Number(categorySettingsId),
        data: {
          name
        }
      }).unwrap();
      setCategories(categories => categories.map(cat =>
        cat.id === categorySettingsId ? { ...cat, name } : cat
      ));
      setCategorySettingsOpen(false);
    } catch (e) {
      window.notify && window.notify('Ошибка при обновлении категории', 'error');
    } finally {
      setCategorySettingsLoading(false);
    }
  };

  // Удаление категории
  const handleDeleteCategory = async () => {
    if (!categorySettingsId || !currentHub?.id) return;
    try {
      await deleteCategory({
        hubId: Number(currentHub.id),
        categoryId: Number(categorySettingsId)
      }).unwrap();
      setCategories(categories => categories.filter(cat => cat.id !== categorySettingsId));
      setCategorySettingsOpen(false);
    } catch (e) {
      window.notify && window.notify('Ошибка при удалении категории', 'error');
    }
  };

  // Добавляем обработчик открытия настроек канала
  const openChannelSettings = (channel: ChannelInterface) => {
    setChannelSettingsId(channel.id);
    setChannelSettingsOpen(true);
  };

  // Добавляем обработчик сохранения настроек канала
  const handleChannelSettingsSave = async () => {
    if (!channelSettingsId || !currentHub?.id) return;
    const name = channelSettingsNameRef.current?.value.trim() || '';
    if (!name) return;
    const original = categories.find(cat => 
      cat.channels.find(ch => ch.id === channelSettingsId)
    )?.channels.find(ch => ch.id === channelSettingsId);
    if (original && original.name.trim() === name) {
      setChannelSettingsOpen(false);
      return;
    }
    setChannelSettingsLoading(true);
    try {
      await updateChannel({
        channelId: Number(channelSettingsId),
        data: {
          name
        }
      }).unwrap();
      setCategories(categories => categories.map(cat => ({
        ...cat,
        channels: cat.channels.map(ch => 
          ch.id === channelSettingsId ? { ...ch, name } : ch
        )
      })));
      setChannelSettingsOpen(false);
    } catch (e) {
      window.notify && window.notify('Ошибка при обновлении канала', 'error');
    } finally {
      setChannelSettingsLoading(false);
    }
  };

  // Добавляем обработчик удаления канала
  const handleDeleteChannel = async () => {
    if (!channelSettingsId || !currentHub?.id) return;
    try {
      await deleteChannel({
        channelId: Number(channelSettingsId)
      }).unwrap();
      setCategories(categories => categories.map(cat => ({
        ...cat,
        channels: cat.channels.filter(ch => ch.id !== channelSettingsId)
      })));
      setChannelSettingsOpen(false);
    } catch (e) {
      window.notify && window.notify('Ошибка при удалении канала', 'error');
    }
  };

  const handleAddChannel = (categoryId: number | string) => {
    if (hasPermission(userPermissions, 'MANAGE_CHANNELS', membershipData?.is_owner)) {
      setActiveCategoryId(categoryId);
      setCreateChannelOpen(true);
    }
  };

  const renderSkeleton = () => (
    <Box sx={{ 
      width: 240,
      background: 'rgba(30,30,47,0.95)',
      borderRight: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      backdropFilter: 'blur(10px)',
      p: 2,
    }}>
      <Box sx={{ mb: 2 }}>
        <Skeleton variant="text" width="60%" height={24} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
      </Box>
      {[...Array(3)].map((_, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Skeleton variant="text" width="80%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 1 }} />
          <Box sx={{ pl: 2 }}>
            {[...Array(2)].map((_, chIndex) => (
              <Skeleton 
                key={chIndex} 
                variant="rectangular" 
                width="100%" 
                height={32} 
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderRadius: 1,
                  mb: 1 
                }} 
              />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );

  const renderMembersSkeleton = () => (
    <Box sx={{ 
      width: 240,
      background: 'rgba(30,30,47,0.95)',
      borderLeft: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      backdropFilter: 'blur(10px)',
      p: 2,
    }}>
      {[...Array(5)].map((_, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.1)', mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 0.5 }} />
            <Skeleton variant="text" width="40%" height={16} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
          </Box>
        </Box>
      ))}
    </Box>
  );

  const channelValidationSchema = Yup.object().shape({
    name: Yup.string()
      .required('Обязательное поле')
      .max(30, 'Максимум 30 символов')
      .test('max-length', 'Максимум 30 символов', value => !value || value.length <= 30),
    type: Yup.number()
      .required('Обязательное поле')
      .oneOf([ChannelType.VOICE, ChannelType.TEXT], 'Неверный тип канала')
  });

  const categoryValidationSchema = Yup.object().shape({
    name: Yup.string()
      .required('Обязательное поле')
      .max(30, 'Максимум 30 символов')
      .test('max-length', 'Максимум 30 символов', value => !value || value.length <= 30)
  });

  if (!currentHub) {
    return (
      <Box sx={{ 
        display: 'flex',
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
        <Sidebar
          user={user}
          hubs={hubsData}
          onAdd={() => setCreateHubOpen(true)}
          selectedHubId={Number(hubId)}
        />
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            Загрузка хаба...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex',
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
      {/* Sidebar */}
      <Sidebar
        user={user}
        hubs={hubsData}
        onAdd={() => setCreateHubOpen(true)}
        selectedHubId={Number(hubId)}
      />
      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        {/* Top Bar */}
        <Box
          sx={{
            height: 64,
            px: 4,
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(30,30,47,0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 2px 8px 0 rgba(30,30,47,0.15)',
            backdropFilter: 'blur(10px)',
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
            {isLoading || isHubsLoading ? (
              <Skeleton variant="text" width={200} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
            ) : (
              hubsData.find(h => h.id === Number(hubId))?.name || 'Hub'
            )}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1}>
            <Tooltip title="Search">
              <IconButton sx={{ color: '#1E90FF' }} onClick={() => setSearchOpen(true)}>
                <SearchIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Notifications">
              <IconButton sx={{ color: '#FF69B4' }}>
                <NotificationsIcon />
              </IconButton>
            </Tooltip>
            {(membershipData?.is_owner || 
              hasAnyPermission(userPermissions, ['MANAGE_ROLES', 'MANAGE_INVITES', 'MANAGE_HUB'])) && (
              <Tooltip title="Settings">
                <IconButton 
                  sx={{ color: '#FF69B4' }}
                  onClick={() => navigate(`/hub/${hubId}/settings`)}
                >
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>

        {/* Main Content */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Channels Sidebar */}
          {isLoading || isCategoriesLoading ? (
            renderSkeleton()
          ) : (
            <Box
              sx={{
                width: 240,
                background: 'rgba(30,30,47,0.95)',
                borderRight: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                backdropFilter: 'blur(10px)',
                height: '100%',
                '& .simplebar-scrollbar': {
                  '&:before': {
                    backgroundColor: 'rgba(194,24,91,0.4)',
                    width: '4px',
                    left: '0',
                    right: 'auto',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                  },
                  '&.simplebar-visible:before': {
                    opacity: 1,
                  }
                },
                '&:hover .simplebar-scrollbar': {
                  '&:before': {
                    opacity: 1,
                  }
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
                }
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box sx={{ p: '16px 0' }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    mb: 2,
                    px: 2,
                  }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        color: 'rgba(255,255,255,0.7)',
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        fontWeight: 700,
                      }}
                    >
                      Категории
                    </Typography>
                    {(membershipData?.is_owner || hasPermission(userPermissions, 'MANAGE_CATEGORIES')) && (
                      <IconButton
                        size="small"
                        sx={{ 
                          color: '#1976D2',
                          '&:hover': {
                            background: 'rgba(25,118,210,0.1)',
                          }
                        }}
                        onClick={() => {
                          if (membershipData?.is_owner || hasPermission(userPermissions, 'MANAGE_CATEGORIES')) {
                            setCreateCategoryOpen(true);
                          }
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                  <SimpleBar
                    style={{ 
                      height: 'calc(100vh - 180px)',
                      width: '100%',
                      flex: 1,
                      minHeight: 0,
                    }}
                    className="custom-scrollbar"
                    scrollbarMinSize={40}
                    autoHide={true}
                  >
                    <ChannelList
                      categories={categories}
                      activeChannel={activeChannel}
                      setActiveChannel={setActiveChannel}
                      openChannelSettings={openChannelSettings}
                      sensors={sensors}
                      handleDragEnd={handleDragEnd}
                      handleChannelDragEnd={handleChannelDragEnd}
                      openCategorySettings={openCategorySettings}
                      setActiveCategoryId={setActiveCategoryId}
                      setCreateChannelOpen={(open: boolean) => {
                        if (open) {
                          handleAddChannel(activeCategoryId || '');
                        } else {
                          setCreateChannelOpen(false);
                        }
                      }}
                      userPermissions={userPermissions}
                      isOwner={membershipData?.is_owner || false}
                      hubId={hubId || ''}
                    />
                  </SimpleBar>
                </Box>
              </Box>
            </Box>
          )}

          {/* Main Chat Area */}
          {activeChannel ? (
            <MainChatArea
              activeChannel={activeChannel}
              user={user}
              hubId={Number(hubId)}
              userPermissions={userPermissions}
              isOwner={membershipData?.is_owner || false}
            />
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              <Typography variant="h5">
                Select a channel to start chatting
              </Typography>
            </Box>
          )}

          {/* Members Sidebar */}
          {isLoading ? (
            renderMembersSkeleton()
          ) : (
            hubsData.find(h => h.id === Number(hubId)) && <MembersSidebar hubId={Number(hubId)} />
          )}
        </Box>
      </Box>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Модалка создания категории */}
      <AppModal open={createCategoryOpen} onClose={() => setCreateCategoryOpen(false)} maxWidth="xs" title="Создать категорию">
        <Formik
          initialValues={{
            name: ''
          }}
          validationSchema={categoryValidationSchema}
          onSubmit={async (values, { resetForm }) => {
            await handleCreateCategory(values.name.trim());
            resetForm();
            setCreateCategoryOpen(false);
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, resetForm }) => (
            <Form>
              <TextField
                name="name"
                label="Название категории"
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
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button 
                  onClick={() => {
                    resetForm();
                    setCreateCategoryOpen(false);
                  }} 
                  sx={{ color: '#B0B0B0' }}
                >
                  Отмена
                </Button>
                <Button 
                  type="submit"
                  variant="contained" 
                  color="primary" 
                  disabled={createCategoryLoading}
                >
                  Создать
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </AppModal>

      {/* Модалка создания канала */}
      <AppModal open={createChannelOpen} onClose={() => setCreateChannelOpen(false)} maxWidth="xs" title="Создать канал">
        <Formik
          initialValues={{
            name: '',
            type: ChannelType.TEXT
          }}
          validationSchema={channelValidationSchema}
          onSubmit={async (values, { resetForm }) => {
            if (!activeCategoryId || !currentHub?.id) return;
            setCreateChannelLoading(true);
            try {
              const res = await createChannel({
                hubId: Number(currentHub.id),
                categoryId: Number(activeCategoryId),
                data: {
                  name: values.name.trim(),
                  type: values.type,
                  categoryId: Number(activeCategoryId)
                }
              }).unwrap();

              // Update categories with new channel
              setCategories((prevCategories: Category[]) =>
                prevCategories.map((cat: Category) =>
                  cat.id === activeCategoryId
                    ? {
                        ...cat,
                        channels: [...cat.channels, res],
                      }
                    : cat
                )
              );

              resetForm();
              setCreateChannelOpen(false);
            } catch (e) {
              window.notify && window.notify('Ошибка при создании канала', 'error');
            } finally {
              setCreateChannelLoading(false);
            }
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, resetForm }) => (
            <Form>
              <TextField
                name="name"
                label="Название канала"
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
                <InputLabel id="channel-type-label" sx={{ color: '#B0B0B0' }}>Тип канала</InputLabel>
                <Select
                  name="type"
                  labelId="channel-type-label"
                  value={values.type}
                  label="Тип канала"
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
                  <MenuItem value={ChannelType.VOICE}>Голосовой</MenuItem>
                  <MenuItem value={ChannelType.TEXT}>Текстовый</MenuItem>
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
                    setCreateChannelOpen(false);
                  }} 
                  sx={{ color: '#B0B0B0' }}
                >
                  Отмена
                </Button>
                <Button 
                  type="submit"
                  variant="contained" 
                  color="primary"
                  disabled={createChannelLoading}
                >
                  Создать
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </AppModal>

      {/* Create Hub Modal */}
      <AppModal
        open={createHubOpen}
        onClose={() => setCreateHubOpen(false)}
        maxWidth="sm"
        title="Создать хаб"
      >
        <TextField
          fullWidth
          label="Название хаба"
          value={hubName}
          onChange={(e) => setHubName(e.target.value)}
          sx={{
            mb: 3,
            input: { color: '#fff' },
            label: { color: '#B0B0B0' },
            '& .MuiInputBase-input::placeholder': { color: '#B0B0B0', opacity: 1 },
          }}
          InputLabelProps={{ style: { color: '#B0B0B0' } }}
        />
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="hub-type-label" sx={{ color: '#B0B0B0' }}>Тип хаба</InputLabel>
          <Select
            labelId="hub-type-label"
            value={hubType}
            label="Тип хаба"
            onChange={e => setHubType(e.target.value as string)}
            sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
          >
            <MenuItem value={"0"}>Приватный</MenuItem>
            <MenuItem value={"1"}>Публичный</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button onClick={() => setCreateHubOpen(false)} sx={{ color: '#B0B0B0' }}>Отмена</Button>
          <Button onClick={handleCreateHub} variant="contained" color="primary">Создать</Button>
        </Box>
      </AppModal>

      {/* AppModal для настроек категории */}
      <AppModal open={categorySettingsOpen} onClose={() => setCategorySettingsOpen(false)} maxWidth="xs" title="Настройки категории">
        <Formik
          initialValues={{
            name: categories.find(cat => cat.id === categorySettingsId)?.name || ''
          }}
          enableReinitialize
          validationSchema={categoryValidationSchema}
          onSubmit={async (values) => {
            if (!categorySettingsId || !currentHub?.id) return;
            const name = values.name.trim();
            if (!name) return;
            const original = categories.find(cat => cat.id === categorySettingsId);
            if (original && original.name.trim() === name) {
              setCategorySettingsOpen(false);
              return;
            }
            setCategorySettingsLoading(true);
            try {
              await updateCategoryPosition({
                hubId: Number(currentHub.id),
                categoryId: Number(categorySettingsId),
                data: {
                  name
                }
              }).unwrap();
              setCategories(categories => categories.map(cat =>
                cat.id === categorySettingsId ? { ...cat, name } : cat
              ));
              setCategorySettingsOpen(false);
            } catch (e) {
              window.notify && window.notify('Ошибка при обновлении категории', 'error');
            } finally {
              setCategorySettingsLoading(false);
            }
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur }) => (
            <Form>
              <TextField
                name="name"
                label="Название категории"
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
              <Button
                variant="outlined"
                color="error"
                fullWidth
                sx={{ mb: 2, mt: 1, fontWeight: 700 }}
                onClick={handleDeleteCategory}
              >
                Удалить категорию
              </Button>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={() => setCategorySettingsOpen(false)} sx={{ color: '#B0B0B0' }}>Отмена</Button>
                <Button 
                  type="submit"
                  variant="contained" 
                  color="primary" 
                  disabled={categorySettingsLoading}
                >
                  Сохранить
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </AppModal>

      {/* AppModal для настроек канала */}
      <AppModal open={channelSettingsOpen} onClose={() => setChannelSettingsOpen(false)} maxWidth="xs" title="Настройки канала">
        <Formik
          initialValues={{
            name: categories.flatMap(cat => cat.channels).find(ch => ch.id === channelSettingsId)?.name || ''
          }}
          enableReinitialize
          validationSchema={Yup.object().shape({
            name: Yup.string()
              .required('Обязательное поле')
              .max(30, 'Максимум 30 символов')
              .test('max-length', 'Максимум 30 символов', value => !value || value.length <= 30)
          })}
          onSubmit={async (values) => {
            if (!channelSettingsId || !currentHub?.id) return;
            const name = values.name.trim();
            if (!name) return;
            const original = categories.find(cat => 
              cat.channels.find(ch => ch.id === channelSettingsId)
            )?.channels.find(ch => ch.id === channelSettingsId);
            if (original && original.name.trim() === name) {
              setChannelSettingsOpen(false);
              return;
            }
            setChannelSettingsLoading(true);
            try {
              await updateChannel({
                channelId: Number(channelSettingsId),
                data: {
                  name
                }
              }).unwrap();
              setCategories(categories => categories.map(cat => ({
                ...cat,
                channels: cat.channels.map(ch => 
                  ch.id === channelSettingsId ? { ...ch, name } : ch
                )
              })));
              setChannelSettingsOpen(false);
            } catch (e) {
              window.notify && window.notify('Ошибка при обновлении канала', 'error');
            } finally {
              setChannelSettingsLoading(false);
            }
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur }) => (
            <Form>
              <TextField
                name="name"
                label="Название канала"
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
              <Button
                variant="outlined"
                color="error"
                fullWidth
                sx={{ mb: 2, mt: 1, fontWeight: 700 }}
                onClick={handleDeleteChannel}
              >
                Удалить канал
              </Button>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={() => setChannelSettingsOpen(false)} sx={{ color: '#B0B0B0' }}>Отмена</Button>
                <Button 
                  type="submit"
                  variant="contained" 
                  color="primary" 
                  disabled={channelSettingsLoading}
                >
                  Сохранить
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </AppModal>
    </Box>
  );
};

export default HubPage;