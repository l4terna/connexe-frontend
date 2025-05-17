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
  useTheme,
  alpha,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ForumIcon from '@mui/icons-material/Forum';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import SearchModal from '../components/SearchModal';
import { Hub, useGetHubsQuery, useGetHubMembershipQuery, useGetHubMembersQuery } from '../api/hubs';
import { HubMember } from '../api/users';
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
import MainChatAreaWrapper from '../components/hub/chat/MainChatAreaWrapper';
import MembersSidebar from '../components/hub/members/MembersSidebar';
import { useHubContext } from '../context/HubContext';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import {
  hasPermission, 
  hasAnyPermission,
  base62ToPermissions,
  getMaxPermissionsBase62,
  PERMISSIONS,
  PermissionKey,
  Permission,
  roleColorToCode,
  grantRolePermission,
  revokeRolePermission,
  permissionsToBase62,
  getUserPermissions,
  isAdministrativePermission
} from '../utils/rolePermissions';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { DragEndEvent as DndKitDragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {
  useGetMessagesQuery,
  useSendMessageMutation,
} from '../api/messages';
import { useWebSocketService } from '../websocket/useWebSocket';
import { useAppSelector } from '../hooks/redux';
import { getThemeColor, getThemeGradient, getThemeAlpha, getRoleBackgroundColor } from '../utils/themeUtils';
import { gradients } from '../theme/theme';

interface Category {
  id: number | string;
  name: string;
  channels: ChannelInterface[];
}

// Removed hardcoded colors - will use theme directly in components

const ChannelSkeleton = () => (
  <Box sx={{ p: 2 }}>
    <Skeleton 
      variant="rectangular" 
      width="100%" 
      height={40} 
      sx={{ 
        borderRadius: 1, 
        mb: 1,
        bgcolor: 'rgba(255,255,255,0.05)',
      }} 
      animation="wave"
    />
    <Skeleton 
      variant="rectangular" 
      width="100%" 
      height={40} 
      sx={{ 
        borderRadius: 1, 
        mb: 1,
        bgcolor: 'rgba(255,255,255,0.05)',
      }} 
      animation="wave"
    />
    <Skeleton 
      variant="rectangular" 
      width="100%" 
      height={40} 
      sx={{ 
        borderRadius: 1, 
        mb: 1,
        bgcolor: 'rgba(255,255,255,0.05)',
      }} 
      animation="wave"
    />
  </Box>
);

const HubTopBarSkeleton = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        height: 64,
        px: 4,
        display: 'flex',
        alignItems: 'center',
        background: getThemeColor(theme, 'backgroundPaper'),
        borderBottom: `1px solid ${getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1)}`,
        boxShadow: `0 2px 8px 0 ${getThemeAlpha(theme, 'black', 0.15)}`,
        backdropFilter: 'blur(10px)',
      }}
    >
      <Skeleton variant="text" width={200} height={40} sx={{ bgcolor: getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1) }} />
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" spacing={1}>
        <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1) }} />
        <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1) }} />
        <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1) }} />
      </Stack>
    </Box>
  );
};

const TextChannelButton = styled(ListItemButton)(({ theme }) => ({
  borderRadius: 8,
  marginBottom: 8,
  background: getThemeColor(theme, 'channelBackground'),
  border: `1px solid ${getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.05)}`,
  '&:hover': {
    background: getThemeColor(theme, 'channelBackgroundHover'),
    transform: 'translateX(5px)',
    borderColor: alpha(theme.palette.primary.main, 0.3),
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
  background: getThemeColor(theme, 'channelBackground'),
  border: `1px solid ${getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.05)}`,
  '&:hover': {
    background: getThemeColor(theme, 'channelBackgroundHover'),
    transform: 'translateX(5px)',
    borderColor: alpha(theme.palette.secondary.main, 0.3),
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
  background: getThemeColor(theme, 'messageBubble'),
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
    background: getThemeColor(theme, 'messageBubble'),
    clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
  },
  transition: 'all 0.3s ease-in-out',
}));

const UserChip = styled(Box)(({ theme }) => ({
  background: getRoleBackgroundColor(theme, 0.1),
  borderRadius: 16,
  padding: '4px 12px',
  border: `1px solid ${getRoleBackgroundColor(theme, 0.3)}`,
  transition: 'all 0.3s ease-in-out',
  cursor: 'pointer',
  '&:hover': {
    background: getRoleBackgroundColor(theme, 0.2),
    transform: 'scale(1.05)',
  },
}));

const StyledTab = styled(Box)(({ theme }) => ({
  cursor: 'pointer',
  padding: '8px 16px',
  borderRadius: 8,
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    background: 'rgba(255,255,255,0.05)',
  },
}));

const StyledTabLabel = styled(Typography)(({ theme }) => ({
  fontSize: 14,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.7)',
  transition: 'color 0.3s ease-in-out',
}));

// Стили для скроллбара глобально для категорий
const globalStyles = `
<style>
  .custom-scrollbar .simplebar-scrollbar::before {
    background-color: rgba(194,24,91,0.4) !important;
    width: 4px !important;
    border-radius: 4px !important;
  }
  .custom-scrollbar .simplebar-scrollbar:hover::before {
    background-color: rgba(194,24,91,0.6) !important;
  }
</style>
`;

// Random placeholders
const categoryPlaceholders = [
  "💬 Общение",
  "🎮 Гейминг",
  "🎨 Творчество",
  "🎵 Музыка",
  "📚 Учеба"
];

const channelPlaceholders = [
  "💬 основной",
  "🔊 войс-рум",
  "📢 анонсы",
  "🎮 геймчат",
  "🤝 знакомства"
];

const categoryUpdatePlaceholders = [
  "🌟 Новый вайб",
  "💫 Свежий нейм",
  "🔥 Топ название",
  "✨ Крутая идея",
  "🎯 Точное попадание"
];

const channelUpdatePlaceholders = [
  "💬 Чил-чат",
  "🎮 Игровая",
  "🎵 Музыкалка",
  "📸 Медиа",
  "💡 Идеи"
];

const getRandomPlaceholder = (placeholders: string[]) => {
  return placeholders[Math.floor(Math.random() * placeholders.length)];
};

const HubPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { hubId, channelId } = useParams<{ hubId: string; channelId?: string }>();
  const { setUpdateHubData } = useHubContext();
  
  const [searchOpen, setSearchOpen] = useState(false);
  
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
  const [createChannelCategoryId, setCreateChannelCategoryId] = useState<number | string | null>(null);
  const [categorySettingsOpen, setCategorySettingsOpen] = useState(false);
  const [categorySettingsId, setCategorySettingsId] = useState<number | string | null>(null);
  const [categorySettingsLoading, setCategorySettingsLoading] = useState(false);
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false);
  const [channelSettingsId, setChannelSettingsId] = useState<number | string | null>(null);
  const [channelSettingsLoading, setChannelSettingsLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState<ChannelInterface | null>(null);
  const currentUser = useAppSelector(state => state.user.currentUser);
  const [isLoading, setIsLoading] = useState(false);
  const [previousHubId, setPreviousHubId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userPermissionKeys, setUserPermissionKeys] = useState<PermissionKey[]>([]);
  const [hubMembers, setHubMembers] = useState<HubMember[]>([]);
  const { setHubMembers: setContextHubMembers } = useHubContext();
  
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
    if (hubId) {
      const hub = hubsData.find((h: Hub) => h.id === Number(hubId));
      setCurrentHub(hub || null);
    }
  }, [hubsData, hubId]);

  // Handle hub change
  useEffect(() => {
    if (hubId !== previousHubId) {
      setActiveChannel(null);
      setPreviousHubId(hubId || null);
      // Always refetch when hub changes to ensure we have the latest data
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
      // Store the base62 encoded permissions for use with hasAnyPermission
      setUserPermissions(rolePermissions);
      
      // Get maximum permissions
      const maxPermissionsBase62 = getMaxPermissionsBase62(rolePermissions);

      // Decode maximum permissions to bits
      const maxPermissionBits = base62ToPermissions(maxPermissionsBase62);

      // Get specific permission names
      const specificPermissions = maxPermissionBits.map(bit => {
        const permission = PERMISSIONS.find(p => p.bit === bit);
        return permission ? permission.key : null;
      }).filter((key): key is PermissionKey => key !== null);

      // Store permission keys separately for easier access
      setUserPermissionKeys(specificPermissions);
    }
  }, [membershipData]);

  // Use RTK Query to fetch hub members
  const { data: membersData = [] } = useGetHubMembersQuery(
    currentHub?.id ? { hubId: currentHub.id } : undefined,
    { skip: !currentHub?.id }
  );

  // Update hub members when membership data changes
  useEffect(() => {
    if (membersData) {
      const membersArray = Array.isArray(membersData) ? membersData : [];
      setHubMembers(membersArray);
      setContextHubMembers(membersArray);
    }
  }, [membersData, setContextHubMembers]);

  // Category event handlers
  const handleAddCategory = () => {
    if (membershipData?.is_owner || hasPermission(userPermissions, 'MANAGE_CATEGORIES')) {
      setCreateCategoryOpen(true);
    }
  };

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

  const handleCreateChannel = async (name?: string, type?: ChannelType) => {
    const channelName = name || newChannelName;
    const channelType = type || selectedChannelType;
    const categoryId = createChannelCategoryId || activeCategoryId;
    
    if (!channelName.trim() || !categoryId || !currentHub?.id) {
      console.error('Missing required data:', { channelName: channelName.trim(), categoryId, currentHubId: currentHub?.id });
      window.notify && window.notify('Не удалось создать канал. Проверьте, что выбрана категория.', 'error');
      return;
    }
    setCreateChannelLoading(true);
    try {
      const res = await createChannel({
        hubId: Number(currentHub.id),
        categoryId: Number(categoryId),
        data: {
          name: channelName.trim(),
          type: channelType,
          categoryId: Number(categoryId)
        }
      }).unwrap();

      // Update categories with new channel
      setCategories((prevCategories: Category[]) =>
        prevCategories.map((cat: Category) =>
          cat.id === categoryId
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

  const processUpdateQueue = async () => {
    if (updateQueueRef.current.length === 0) {
      isUpdatingRef.current = false;
      return;
    }

    const nextUpdate = updateQueueRef.current[0];
    try {
      await nextUpdate();
      updateQueueRef.current = updateQueueRef.current.slice(1);
      
      if (updateQueueRef.current.length > 0) {
        setTimeout(processUpdateQueue, 100);
      } else {
        isUpdatingRef.current = false;
      }
    } catch (error) {
      console.error('Error processing update:', error);
      updateQueueRef.current = [];
      isUpdatingRef.current = false;
    }
  };

  // Queue category update helper
  const queueCategoryUpdate = (updateFn: () => Promise<void>) => {
    updateQueueRef.current.push(updateFn);
    
    if (!isUpdatingRef.current) {
      isUpdatingRef.current = true;
      processUpdateQueue();
    }
  };

  // --- handleDragEnd for drag-n-drop ---
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

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

  const handleDeleteCategory = async () => {
    if (!categorySettingsId || !currentHub?.id) return;
    setCategorySettingsLoading(true);
    try {
      await deleteCategory({
        hubId: Number(currentHub.id),
        categoryId: Number(categorySettingsId)
      }).unwrap();
      setCategories(categories => categories.filter(cat => cat.id !== categorySettingsId));
      setCategorySettingsOpen(false);
    } catch (e) {
      window.notify && window.notify('Ошибка при удалении категории', 'error');
    } finally {
      setCategorySettingsLoading(false);
    }
  };

  // --- Channel Settings Handler ---
  const openChannelSettings = (channel: ChannelInterface) => {
    setChannelSettingsId(channel.id);
    setChannelSettingsOpen(true);
  };

  const handleChannelSettingsSave = async () => {
    if (!channelSettingsId) return;
    const name = channelSettingsNameRef.current?.value.trim() || '';
    if (!name) return;
    const channel = categories.flatMap(cat => cat.channels).find(ch => ch.id === channelSettingsId);
    if (!channel) return;

    if (channel.name.trim() === name) {
      setChannelSettingsOpen(false);
      return;
    }

    setChannelSettingsLoading(true);
    try {
      await updateChannel({
        channelId: channel.id,
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

  const handleDeleteChannel = async () => {
    if (!channelSettingsId) return;
    const channel = categories.flatMap(cat => cat.channels).find(ch => ch.id === channelSettingsId);
    if (!channel) return;

    setChannelSettingsLoading(true);
    try {
      await deleteChannel({
        channelId: channel.id
      }).unwrap();
      setCategories(categories => categories.map(cat => ({
        ...cat,
        channels: cat.channels.filter(ch => ch.id !== channelSettingsId)
      })));
      setChannelSettingsOpen(false);
    } catch (e) {
      window.notify && window.notify('Ошибка при удалении канала', 'error');
    } finally {
      setChannelSettingsLoading(false);
    }
  };

  const handleAddChannel = (categoryId: number | string) => {
    console.log('handleAddChannel called with categoryId:', categoryId);
    setCreateChannelCategoryId(categoryId);
    setCreateChannelOpen(true);
  };

  const renderSkeleton = () => (
    <Box
      sx={{
        width: 240,
        background: getThemeColor(theme, 'backgroundPaper'),
        borderRight: `1px solid ${getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1)}`,
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(10px)',
        height: '100%',
      }}
    >
      <Box sx={{ p: 2 }}>
        <Skeleton variant="text" width="50%" height={24} sx={{ bgcolor: getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1), mb: 2 }} animation="wave" />
        <ChannelSkeleton />
        <Skeleton variant="text" width="50%" height={24} sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 2, mt: 3 }} animation="wave" />
        <ChannelSkeleton />
      </Box>
    </Box>
  );

  const renderMembersSkeleton = () => (
    <Box
      sx={{
        width: 240,
        background: getThemeColor(theme, 'backgroundOverlay'),
        borderLeft: `1px solid ${getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1)}`,
        p: 2,
      }}
    >
      <Skeleton variant="text" width="50%" height={24} sx={{ bgcolor: getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1), mb: 2 }} animation="wave" />
      {[1, 2, 3, 4, 5].map((i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1), mr: 1 }} animation="wave" />
          <Skeleton variant="text" width="60%" height={20} sx={{ bgcolor: getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1) }} animation="wave" />
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

  if (isHubsLoading || isMembershipLoading) {
    return (
      <Box sx={{ 
        display: 'flex',
        height: '100vh', 
        alignItems: 'center',
        justifyContent: 'center',
        background: getThemeColor(theme, 'backgroundMain'),
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
          zIndex: 0,
        }
      }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.secondary }}>
          Загрузка хаба...
        </Typography>
      </Box>
    );
  }

  if (!currentHub && !isHubsLoading) {
    return (
      <Box sx={{ 
        display: 'flex',
        height: '100vh', 
        alignItems: 'center',
        justifyContent: 'center',
        background: getThemeColor(theme, 'backgroundMain'),
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
          zIndex: 0,
        }
      }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.secondary }}>
          Хаб не найден
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ 
        display: 'flex',
        height: '100vh', 
        flexDirection: 'column',
        background: getThemeColor(theme, 'backgroundMain'),
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
          zIndex: 0,
        }
      }}>
        {/* Top Bar */}
        <Box
          sx={{
            height: 64,
            px: 4,
            display: 'flex',
            alignItems: 'center',
            background: getThemeColor(theme, 'backgroundPaper'),
            borderBottom: `1px solid ${getThemeAlpha(theme, theme.palette.mode === 'dark' ? 'white' : 'black', 0.1)}`,
            boxShadow: `0 2px 8px 0 ${getThemeAlpha(theme, 'black', 0.15)}`,
            backdropFilter: 'blur(10px)',
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              background: getThemeGradient(theme, 'main'),
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
              <IconButton sx={{ color: theme.palette.secondary.main }} onClick={() => setSearchOpen(true)}>
                <SearchIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Notifications">
              <IconButton sx={{ color: theme.palette.primary.main }}>
                <NotificationsIcon />
              </IconButton>
            </Tooltip>
            {(membershipData?.is_owner || 
              hasAnyPermission(userPermissions, ['MANAGE_ROLES', 'MANAGE_INVITES', 'MANAGE_HUB'])) && (
              <Tooltip title="Settings">
                <IconButton 
                  sx={{ color: theme.palette.primary.main }}
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
                background: getThemeColor(theme, 'backgroundPaper'),
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
          )}
          
          {/* Main Chat Area */}
          {activeChannel && currentUser ? (
            <MainChatAreaWrapper
              activeChannel={activeChannel}
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
            hubsData.find(h => h.id === Number(hubId)) && <MembersSidebar hubId={Number(hubId)} presenceUpdates={hubMembers} />
          )}
        </Box>
      </Box>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Модалка создания категории */}
      <AppModal 
        open={createCategoryOpen} 
        onClose={() => setCreateCategoryOpen(false)} 
         
        title="Создать категорию"
      >
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
                placeholder={getRandomPlaceholder(categoryPlaceholders)}
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
                  sx={{ 
                    color: 'rgba(255,255,255,0.7)'
                  }}
                >
                  Отмена
                </Button>
                <Button 
                  type="submit"
                  variant="contained" 
                  disabled={createCategoryLoading || !values.name.trim()}
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

      {/* AppModal для настроек категории */}
      <AppModal open={categorySettingsOpen} onClose={() => setCategorySettingsOpen(false)}  title="Настройки категории">
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
                  placeholder={getRandomPlaceholder(categoryUpdatePlaceholders)}
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
                  disabled={categorySettingsLoading}
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
                  Сохранить
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </AppModal>

      {/* AppModal для настроек канала */}
      <AppModal open={channelSettingsOpen} onClose={() => setChannelSettingsOpen(false)}  title="Настройки канала">
        <Formik
          initialValues={{
            name: categories.flatMap(cat => cat.channels).find(ch => ch.id === channelSettingsId)?.name || '',
            type: categories.flatMap(cat => cat.channels).find(ch => ch.id === channelSettingsId)?.type || ChannelType.TEXT
          }}
          enableReinitialize
          validationSchema={channelValidationSchema}
          onSubmit={async (values) => {
            if (!channelSettingsId) return;
            const name = values.name.trim();
            if (!name) return;
            const channel = categories.flatMap(cat => cat.channels).find(ch => ch.id === channelSettingsId);
            if (!channel) return;
            
            const hasChanges = channel.name.trim() !== name || channel.type !== values.type;
            
            if (!hasChanges) {
              setChannelSettingsOpen(false);
              return;
            }

            setChannelSettingsLoading(true);
            try {
              await updateChannel({
                channelId: channel.id,
                data: {
                  name,
                  type: values.type
                }
              }).unwrap();
              
              // Update channel in same category
              setCategories(categories => categories.map(cat => ({
                ...cat,
                channels: cat.channels.map(ch =>
                  ch.id === channelSettingsId ? { ...ch, name, type: values.type } : ch
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
                  placeholder={getRandomPlaceholder(channelUpdatePlaceholders)}
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
                <InputLabel id="channel-type-edit-label" sx={{ color: '#B0B0B0' }}>Тип канала</InputLabel>
                <Select
                  name="type"
                  labelId="channel-type-edit-label"
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
                  <MenuItem value={ChannelType.TEXT}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ForumIcon fontSize="small" />
                      Текстовый
                    </Box>
                  </MenuItem>
                  <MenuItem value={ChannelType.VOICE}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <VolumeUpIcon fontSize="small" />
                      Голосовой
                    </Box>
                  </MenuItem>
                </Select>
                {touched.type && errors.type && (
                  <Typography sx={{ color: '#ff4444', fontSize: '0.75rem', mt: 1, ml: 2 }}>
                    {errors.type}
                  </Typography>
                )}
              </FormControl>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                sx={{ mb: 2, fontWeight: 700 }}
                onClick={handleDeleteChannel}
              >
                Удалить канал
              </Button>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={() => setChannelSettingsOpen(false)} sx={{ color: '#B0B0B0' }}>Отмена</Button>
                <Button 
                  type="submit"
                  variant="contained" 
                  disabled={channelSettingsLoading}
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
                  Сохранить
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </AppModal>

      {/* AppModal для создания канала */}
      <AppModal open={createChannelOpen} onClose={() => { 
        setCreateChannelOpen(false);
        setCreateChannelCategoryId(null);
      }}  title="Создать канал">
        <Formik
          initialValues={{
            name: '',
            type: ChannelType.TEXT
          }}
          validationSchema={channelValidationSchema}
          onSubmit={async (values, { resetForm }) => {
            console.log('Form submitted with:', { values, createChannelCategoryId });
            await handleCreateChannel(values.name, values.type);
            resetForm();
            setCreateChannelOpen(false);
            setCreateChannelCategoryId(null);
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, resetForm }) => (
              <Form>
                <TextField
                  name="name"
                  label="Название канала"
                  placeholder={getRandomPlaceholder(channelPlaceholders)}
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
                  onChange={(e) => {
                    handleChange(e);
                    setSelectedChannelType(e.target.value as ChannelType);
                  }}
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
                  <MenuItem value={ChannelType.TEXT}>Текстовый</MenuItem>
                  <MenuItem value={ChannelType.VOICE}>Голосовой</MenuItem>
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
                    setCreateChannelCategoryId(null);
                  }} 
                  sx={{ color: '#B0B0B0' }}
                >
                  Отмена
                </Button>
                <Button 
                  type="submit"
                  variant="contained" 
                  disabled={createChannelLoading}
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
    </>
  );
};

export default HubPage;