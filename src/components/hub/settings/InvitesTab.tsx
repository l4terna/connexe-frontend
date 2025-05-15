import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Button, List, ListItem, ListItemText, ListItemSecondaryAction, Stack, Paper, IconButton, Tooltip, Chip, FormControlLabel, Checkbox } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AppModal from '../../../components/AppModal';
import { InviteDTO, useCreateInviteMutation, useGetInvitesQuery, useDeleteInviteMutation } from '../../../api/hubs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Notification from '../../Notification';
import { Formik, Form } from 'formik';
import Input from '../../common/Input';
import * as Yup from 'yup';

interface InvitesTabProps {
  hubId?: string;
  isActive: boolean;
}

const PAGE_SIZE = 10;

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
    background: '#C2185B',
    '&:hover': {
      background: '#8C0D3A',
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
  inactiveBadge: {
    color: '#ff4444',
    fontSize: '0.75rem',
    bgcolor: 'rgba(255,68,68,0.1)',
    px: 1,
    py: 0.25,
    borderRadius: 1
  },
  copyButton: {
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

const validationSchema = Yup.object().shape({
  maxUses: Yup.string().when('isUnlimited', {
    is: false,
    then: (schema) => schema
      .required('Обязательное поле')
      .test('is-positive', 'Минимум 1', (value) => {
        const num = Number(value);
        return !isNaN(num) && num >= 1;
      }),
    otherwise: (schema) => schema.notRequired()
  }),
  expiresAt: Yup.string().nullable(),
  isUnlimited: Yup.boolean()
});

const InvitesTab: React.FC<InvitesTabProps> = ({ hubId, isActive }) => {
  const [page, setPage] = useState(0);
  const [copyNotification, setCopyNotification] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [inviteToDelete, setInviteToDelete] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isCreateInviteModalOpen, setIsCreateInviteModalOpen] = useState(false);
  const [maxUsesError, setMaxUsesError] = useState('');
  const [expiresAtError, setExpiresAtError] = useState('');
  const [invites, setInvites] = useState<InviteDTO[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const { 
    data: invitesData, 
    isLoading, 
    isFetching,
    refetch
  } = useGetInvitesQuery(
    { 
      hubId: Number(hubId), 
      page, 
      size: PAGE_SIZE 
    },
    { 
      skip: !hubId || !isActive 
    }
  );

  useEffect(() => {
    if (invitesData?.content) {
      if (page === 0) {
        setInvites(invitesData.content);
        setInitialLoading(false);
      } else {
        setInvites(prev => [...prev, ...invitesData.content]);
      }
    }
  }, [invitesData]);

  const hasNextPage = invitesData && !invitesData.last;
  const hasItems = invites.length > 0;

  const [createInvite] = useCreateInviteMutation();
  const [deleteInvite] = useDeleteInviteMutation();

  React.useEffect(() => {
    if (!isActive || !hasNextPage || isFetching) return;
    
    const observer = new window.IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetching && hasNextPage) {
        setPage(prev => prev + 1);
      }
    }, {
      root: listRef.current,
      rootMargin: '0px',
      threshold: 0.4
    });

    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);
    return () => {
      if (sentinel) observer.unobserve(sentinel);
      observer.disconnect();
    };
  }, [isActive, hasNextPage, isFetching, hasItems]);

  const handleCopyInvite = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopyNotification(true);
  };

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

  const initialValues = {
    maxUses: '1',
    expiresAt: getDefaultExpiresAt(),
    isUnlimited: false
  };

  const handleCreateInvite = async (values: any) => {
    try {
      const response = await createInvite({
        hubId: Number(hubId),
        data: {
          max_uses: values.isUnlimited ? -1 : (values.maxUses === '' ? undefined : Number(values.maxUses)),
          expires_at: values.expiresAt ? `${values.expiresAt}T00:00:00Z` : undefined
        }
      }).unwrap();
      
      setInvites(prev => [response, ...prev]);
      
      setIsCreateInviteModalOpen(false);
    } catch (error) {
      console.error('Error creating invite:', error);
    }
  };

  const handleDeleteInvite = async (inviteId: number) => {
    setInvites(prev => prev.filter(invite => invite.id !== inviteId));
    setDeleteConfirmOpen(false);
    setInviteToDelete(null);

    try {
      await deleteInvite({
        hubId: Number(hubId),
        inviteId
      }).unwrap();
    } catch (error) {
      console.error('Error deleting invite:', error);
      if (invitesData?.content) {
        const deletedInvite = invitesData.content.find(invite => invite.id === inviteId);
        if (deletedInvite) {
          setInvites(prev => [...prev, deletedInvite]);
        }
      }
    }
  };

  return (
    <Box>
      <Box sx={commonStyles.header}>
        <Typography variant="h6" sx={commonStyles.title}>
          Управление приглашениями
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => setIsCreateInviteModalOpen(true)}
          sx={{
            background: '#FF69B4',
            '&:hover': {
              background: '#C71585',
            }
          }}
        >
          Создать
        </Button>
      </Box>

      <List ref={listRef} sx={{ overflow: 'auto', pr: 1, maxHeight: '65vh' }}>
        {!initialLoading && !isLoading && invites.length === 0 ? (
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', py: 3 }}>
            Нет приглашений
          </Typography>
        ) : (
          <>
            {invites.map((invite) => (
              <ListItem
                key={invite.id}
                sx={commonStyles.listItem}
              >
                <ListItemText 
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 500 }}>
                        {invite.code}
                      </Typography>
                      {invite.is_active === false && (
                        <Typography sx={commonStyles.inactiveBadge}>
                          Неактивно
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      <Typography component="span" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
                        Использовано: {invite.current_uses} из {invite.max_uses === null || invite.max_uses === -1 ? <span style={{ fontSize: '1.3em' }}>∞</span> : invite.max_uses}
                      </Typography>
                      <Typography component="span" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
                        Действует до: {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString('ru-RU') : 'Бессрочно'}
                      </Typography>
                      <Typography component="span" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                        Создано: {new Date(invite.created_at).toLocaleDateString('ru-RU')}
                      </Typography>
                    </span>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Скопировать код">
                      <IconButton
                        edge="end"
                        aria-label="copy"
                        onClick={() => handleCopyInvite(invite.code)}
                        sx={{
                          color: 'rgba(255,255,255,0.7)',
                          '&:hover': {
                            color: '#1E90FF',
                            background: 'rgba(30,144,255,0.1)'
                          }
                        }}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Удалить">
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => {
                          setInviteToDelete(invite.id);
                          setDeleteConfirmOpen(true);
                        }}
                        sx={{
                          color: 'rgba(255,255,255,0.7)',
                          '&:hover': {
                            color: '#FF69B4',
                            background: 'rgba(255,105,180,0.1)'
                          }
                        }}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            <div ref={sentinelRef} style={{ height: 20 }} />
          </>
        )}
      </List>

      <AppModal
        open={isCreateInviteModalOpen}
        onClose={() => setIsCreateInviteModalOpen(false)}
        title="Создание приглашения"
        maxWidth="xl"
      >
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleCreateInvite}
        >
          {({ values, setFieldValue, errors, touched }) => (
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
                        }
                      }}
                      sx={{
                        color: '#FF69B4',
                        '&.Mui-checked': {
                          color: '#FF69B4'
                        }
                      }}
                    />
                  }
                  label="Без ограничений"
                  sx={{ color: 'rgba(255,255,255,0.7)' }}
                />
                {!values.isUnlimited && (
                  <Input
                    name="maxUses"
                    label="Максимальное количество использований"
                    type="number"
                    errorMessage={touched.maxUses && errors.maxUses ? String(errors.maxUses) : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFieldValue('maxUses', value);
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
                      sx: {
                        '& .MuiPickersSectionList-root': {
                          color: 'rgba(255,255,255,0.7)'
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
                      }
                    },
                    openPickerButton: {
                      sx: {
                        color: 'rgba(255,255,255,0.7)',
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
                    onClick={() => setIsCreateInviteModalOpen(false)}
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
                    type="submit"
                    variant="contained"
                    sx={{
                      background: '#FF69B4',
                      '&:hover': {
                        background: '#C71585',
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

      <AppModal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setInviteToDelete(null);
        }}
        maxWidth="xs"
        title="Удалить приглашение?"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', py: 1 }}>
          <DeleteOutlineIcon sx={{ fontSize: 48, color: '#ff4444', mb: 1 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, textAlign: 'center' }}>
            Вы уверены, что хотите удалить это приглашение? Это действие необратимо.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setInviteToDelete(null);
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
                if (inviteToDelete) {
                  handleDeleteInvite(inviteToDelete);
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

      <Notification
        message="Код приглашения успешно скопирован"
        open={copyNotification}
        onClose={() => setCopyNotification(false)}
      />
    </Box>
  );
};

export default InvitesTab;