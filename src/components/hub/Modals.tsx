import React from 'react';
import { TextField, Button, Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import AppModal from '../AppModal';
import { ChannelType } from '../../api/channels';

interface ModalsProps {
  // Category Modal
  createCategoryOpen: boolean;
  setCreateCategoryOpen: (open: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  handleCreateCategory: () => void;
  createCategoryLoading: boolean;

  // Channel Modal
  createChannelOpen: boolean;
  setCreateChannelOpen: (open: boolean) => void;
  newChannelName: string;
  setNewChannelName: (name: string) => void;
  newChannelType: ChannelType;
  setNewChannelType: (type: ChannelType) => void;
  handleCreateChannel: () => void;
  createChannelLoading: boolean;

  // Category Settings Modal
  categorySettingsOpen: boolean;
  setCategorySettingsOpen: (open: boolean) => void;
  categorySettingsName: string;
  setCategorySettingsName: (name: string) => void;
  handleCategorySettingsSave: () => void;
  handleDeleteCategory: () => void;
  categorySettingsLoading: boolean;

  // Channel Settings Modal
  channelSettingsOpen: boolean;
  setChannelSettingsOpen: (open: boolean) => void;
  channelSettingsName: string;
  setChannelSettingsName: (name: string) => void;
  handleChannelSettingsSave: () => void;
  handleDeleteChannel: () => void;
  channelSettingsLoading: boolean;
}

const Modals: React.FC<ModalsProps> = ({
  // Category Modal
  createCategoryOpen,
  setCreateCategoryOpen,
  newCategoryName,
  setNewCategoryName,
  handleCreateCategory,
  createCategoryLoading,

  // Channel Modal
  createChannelOpen,
  setCreateChannelOpen,
  newChannelName,
  setNewChannelName,
  newChannelType,
  setNewChannelType,
  handleCreateChannel,
  createChannelLoading,

  // Category Settings Modal
  categorySettingsOpen,
  setCategorySettingsOpen,
  categorySettingsName,
  setCategorySettingsName,
  handleCategorySettingsSave,
  handleDeleteCategory,
  categorySettingsLoading,

  // Channel Settings Modal
  channelSettingsOpen,
  setChannelSettingsOpen,
  channelSettingsName,
  setChannelSettingsName,
  handleChannelSettingsSave,
  handleDeleteChannel,
  channelSettingsLoading,
}) => {
  return (
    <>
      {/* Create Category Modal */}
      <AppModal open={createCategoryOpen} onClose={() => setCreateCategoryOpen(false)} maxWidth="xs" title="Создать категорию">
        <TextField
          autoFocus
          margin="dense"
          label="Название категории"
          fullWidth
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          sx={{
            mb: 3,
            input: { color: '#fff' },
            label: { color: '#B0B0B0' },
            '& .MuiInputBase-input::placeholder': { color: '#B0B0B0', opacity: 1 },
          }}
          InputLabelProps={{ style: { color: '#B0B0B0' } }}
        />
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button onClick={() => setCreateCategoryOpen(false)} sx={{ color: '#B0B0B0' }}>Отмена</Button>
          <Button onClick={handleCreateCategory} variant="contained" color="primary" disabled={createCategoryLoading}>Создать</Button>
        </Box>
      </AppModal>

      {/* Create Channel Modal */}
      <AppModal open={createChannelOpen} onClose={() => setCreateChannelOpen(false)} maxWidth="xs" title="Создать канал">
        <TextField
          autoFocus
          margin="dense"
          label="Название канала"
          fullWidth
          value={newChannelName}
          onChange={e => setNewChannelName(e.target.value)}
          sx={{
            mb: 3,
            input: { color: '#fff' },
            label: { color: '#B0B0B0' },
            '& .MuiInputBase-input::placeholder': { color: '#B0B0B0', opacity: 1 },
          }}
          InputLabelProps={{ style: { color: '#B0B0B0' } }}
        />
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="channel-type-label" sx={{ color: '#B0B0B0' }}>Тип канала</InputLabel>
          <Select
            labelId="channel-type-label"
            value={newChannelType}
            label="Тип канала"
            onChange={e => setNewChannelType(Number(e.target.value) as ChannelType)}
            sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
          >
            <MenuItem value={ChannelType.VOICE}>Голосовой</MenuItem>
            <MenuItem value={ChannelType.TEXT}>Текстовый</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button onClick={() => setCreateChannelOpen(false)} sx={{ color: '#B0B0B0' }}>Отмена</Button>
          <Button 
            onClick={handleCreateChannel} 
            variant="contained" 
            color="primary"
            disabled={createChannelLoading}
          >
            Создать
          </Button>
        </Box>
      </AppModal>

      {/* Category Settings Modal */}
      <AppModal open={categorySettingsOpen} onClose={() => setCategorySettingsOpen(false)} maxWidth="xs" title="Настройки категории">
        <TextField
          autoFocus
          margin="dense"
          label="Название категории"
          fullWidth
          value={categorySettingsName}
          onChange={e => setCategorySettingsName(e.target.value)}
          sx={{
            mb: 3,
            input: { color: '#fff' },
            label: { color: '#B0B0B0' },
            '& .MuiInputBase-input::placeholder': { color: '#B0B0B0', opacity: 1 },
          }}
          InputLabelProps={{ style: { color: '#B0B0B0' } }}
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
          <Button onClick={handleCategorySettingsSave} variant="contained" color="primary" disabled={categorySettingsLoading}>Сохранить</Button>
        </Box>
      </AppModal>

      {/* Channel Settings Modal */}
      <AppModal open={channelSettingsOpen} onClose={() => setChannelSettingsOpen(false)} maxWidth="xs" title="Настройки канала">
        <TextField
          autoFocus
          margin="dense"
          label="Название канала"
          fullWidth
          value={channelSettingsName}
          onChange={e => setChannelSettingsName(e.target.value)}
          sx={{
            mb: 3,
            input: { color: '#fff' },
            label: { color: '#B0B0B0' },
            '& .MuiInputBase-input::placeholder': { color: '#B0B0B0', opacity: 1 },
          }}
          InputLabelProps={{ style: { color: '#B0B0B0' } }}
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
          <Button onClick={handleChannelSettingsSave} variant="contained" color="primary" disabled={channelSettingsLoading}>Сохранить</Button>
        </Box>
      </AppModal>
    </>
  );
};

export default Modals; 