import React, { useState } from 'react';
import { Box } from '@mui/material';
import { Outlet, useParams, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useGetHubsQuery } from '@/api/hubs';
import { useAppSelector } from '@/hooks/redux';
import AppModal from './AppModal';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useCreateHubMutation } from '@/api/hubs';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/router/paths';

const createHubSchema = Yup.object().shape({
  name: Yup.string()
    .max(30, 'Не более 30 символов')
    .required('Обязательное поле'),
  type: Yup.string().required('Обязательное поле'),
});

const SharedLayout: React.FC = () => {
  const { hubId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAppSelector(state => state.user.currentUser);
  const { data: hubs = [], refetch: refetchHubs } = useGetHubsQuery({});
  const [createHubOpen, setCreateHubOpen] = useState(false);
  const [createHub] = useCreateHubMutation();

  return (
    <>
      <Box sx={{ display: 'flex', height: '100vh', backgroundColor: '#181824' }}>
        <Sidebar />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Outlet />
        </Box>
      </Box>

      {/* Create Hub Modal */}
      <AppModal
        open={createHubOpen}
        onClose={() => setCreateHubOpen(false)}
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
              const result = await createHub(formData).unwrap();
              await refetchHubs();
              setCreateHubOpen(false);
              resetForm();
              if (result.id) {
                navigate(ROUTES.HUB.DETAIL(result.id));
              }
            } catch (error) {
              // Handle error
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
    </>
  );
};

export default SharedLayout;