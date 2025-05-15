import React, { useState, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  List, 
  ListItem, 
  ListItemText, 
  Paper,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { Hub, useUpdateHubMutation } from '../../../api/hubs';
import Input from '../../common/Input';
import AppModal from '../../AppModal';
import RolesManager from './RolesTabManager';

interface HubSettingsProps {
  hub: Hub;
  isActive: boolean;
}

const HubSettings: React.FC<HubSettingsProps> = ({ hub, isActive }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [hubNameError, setHubNameError] = useState('');
  const hubNameRef = useRef<HTMLInputElement>(null);

  const [updateHub] = useUpdateHubMutation();

  const handleEditHub = () => {
    if (hubNameRef.current) hubNameRef.current.value = hub.name;
    setIsEditModalOpen(true);
  };

  const handleUpdateHub = async () => {
    const hubName = hubNameRef.current?.value || '';
    if (!hubName.trim()) {
      setHubNameError('Обязательное поле');
      return;
    }
    try {
      await updateHub({
        hubId: hub.id,
        data: {
          name: hubName
        }
      }).unwrap();
      setIsEditModalOpen(false);
      setHubNameError('');
    } catch (e) {
      setHubNameError('Ошибка сохранения хаба');
    }
    if (hubNameRef.current) hubNameRef.current.value = '';
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          Настройки хаба
        </Typography>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={handleEditHub}
        >
          Редактировать
        </Button>
      </Box>

      <Paper sx={{ background: 'rgba(30,30,47,0.95)', mb: 4 }}>
        <List>
          <ListItem>
            <ListItemText
              primary={
                <Typography sx={{ color: '#fff' }}>
                  {hub.name}
                </Typography>
              }
              secondary={
                <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  ID: {hub.id}
                </Typography>
              }
            />
          </ListItem>
        </List>
      </Paper>

      <RolesManager hubId={hub.id.toString()} isActive={isActive} />

      <AppModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setHubNameError('');
        }}
        title="Редактирование хаба"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Input
            label="Название хаба"
            inputRef={hubNameRef}
            errorMessage={hubNameError}
          />
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setIsEditModalOpen(false);
                setHubNameError('');
              }}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={handleUpdateHub}
            >
              Сохранить
            </Button>
          </Box>
        </Box>
      </AppModal>
    </Box>
  );
};

export default HubSettings; 