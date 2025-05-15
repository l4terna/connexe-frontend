import React from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { FieldProps } from 'formik';

interface InputProps extends Omit<TextFieldProps, 'variant'> {
  variant?: 'outlined' | 'filled' | 'standard';
  errorMessage?: string;
  field?: FieldProps['field'];
  form?: FieldProps['form'];
}

const Input: React.FC<InputProps> = ({ 
  errorMessage,
  sx,
  InputProps,
  InputLabelProps,
  FormHelperTextProps,
  field,
  form,
  ...props 
}) => {
  const error = form?.touched[field?.name || ''] && form?.errors[field?.name || ''];
  const helperText = error ? String(error) : errorMessage;

  return (
    <TextField
      variant="outlined"
      fullWidth
      error={!!error || !!errorMessage}
      helperText={helperText}
      {...field}
      {...props}
      sx={{
        '& .MuiInputBase-input': {
          color: '#fff !important',
          '&::placeholder': {
            color: 'rgba(255,255,255,0.7)'
          }
        },
        '& .Mui-disabled': {
          color: '#fff !important',
          WebkitTextFillColor: '#fff !important'
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
        },
        '& .MuiFormHelperText-root': {
          color: 'rgba(255,255,255,0.7)'
        },
        ...sx
      }}
      InputProps={{
        sx: { 
          color: '#fff',
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
        ...InputProps
      }}
      InputLabelProps={{
        sx: { color: 'rgba(255,255,255,0.7)' },
        ...InputLabelProps
      }}
      FormHelperTextProps={{
        sx: { color: 'rgba(255,255,255,0.7)' },
        ...FormHelperTextProps
      }}
    />
  );
};

export default Input; 