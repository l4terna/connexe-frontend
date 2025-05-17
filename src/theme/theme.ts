import { createTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

export const colors = {
  primary: '#FF69B4',
  secondary: '#1E90FF',
  background: '#0A0A1A',
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)',
  },
};

export const gradients = {
  neon: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
  hover: 'linear-gradient(90deg, #FF1493 0%, #00BFFF 100%)',
  cyber: 'linear-gradient(45deg, #FF69B4 0%, #1E90FF 50%, #FF69B4 100%)',
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary,
    },
    secondary: {
      main: colors.secondary,
    },
    background: {
      default: colors.background,
      paper: alpha(colors.background, 0.95),
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 900,
      letterSpacing: 2,
    },
    h2: {
      fontWeight: 900,
      letterSpacing: 2,
    },
    h3: {
      fontWeight: 900,
      letterSpacing: 2,
    },
    h4: {
      fontWeight: 900,
      letterSpacing: 2,
    },
    h5: {
      fontWeight: 900,
      letterSpacing: 2,
    },
    h6: {
      fontWeight: 900,
      letterSpacing: 2,
    },
    subtitle1: {
      fontWeight: 700,
      letterSpacing: 1,
    },
    subtitle2: {
      fontWeight: 700,
      letterSpacing: 1,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 700,
          letterSpacing: 1,
          '&:hover': {
            transform: 'scale(1.05)',
          },
          transition: 'all 0.3s ease',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 12,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          background: gradients.neon,
          color: colors.background,
          fontWeight: 700,
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        enterDelay: 600,
        arrow: true,
        disableInteractive: true,
        enterNextDelay: 600,
      },
      styleOverrides: {
        tooltip: {
          fontSize: '0.875rem',
          backgroundColor: 'rgba(30, 30, 47, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        },
        arrow: {
          color: 'rgba(30, 30, 47, 0.95)',
        },
      },
    },
  },
});

export default theme;