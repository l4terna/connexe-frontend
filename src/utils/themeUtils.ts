import { alpha } from '@mui/material/styles';
import { Theme } from '@mui/material/styles';

// Define color constants for both themes
export const themeColors = {
  dark: {
    background: '#0A0A1A',
    backgroundVariant: '#1E1E2F',
    backgroundPaper: 'rgba(30,30,47,0.95)',
    backgroundGradient: 'linear-gradient(135deg, #1E1E2F 60%, #1E1E2F 100%)',
    backgroundMain: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    backgroundOverlay: 'rgba(30,30,47,0.6)',
    backgroundTransparent: 'rgba(30,30,47,0.85)',
    backgroundHover: 'rgba(255,255,255,0.05)',
    backgroundHoverAlt: 'rgba(255,255,255,0.1)',
    backgroundSelected: 'rgba(255,255,255,0.15)',
    backgroundOpacity: 'rgba(255,255,255,0.08)',
    channelBackground: 'rgba(37,37,54,0.95)',
    channelBackgroundHover: 'rgba(45,45,62,0.95)',
    tooltip: 'rgba(30,30,47,0.85)',
    messageBubble: 'rgba(20,20,35,0.85)',
  },
  light: {
    background: '#f5f5f5',
    backgroundVariant: '#ffffff',
    backgroundPaper: 'rgba(255,255,255,0.95)',
    backgroundGradient: 'linear-gradient(135deg, #ffffff 60%, #f5f5f5 100%)',
    backgroundMain: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
    backgroundOverlay: 'rgba(255,255,255,0.9)',
    backgroundTransparent: 'rgba(255,255,255,0.85)',
    backgroundHover: 'rgba(0,0,0,0.04)',
    backgroundHoverAlt: 'rgba(0,0,0,0.08)',
    backgroundSelected: 'rgba(0,0,0,0.12)',
    backgroundOpacity: 'rgba(0,0,0,0.06)',
    channelBackground: 'rgba(245,245,245,0.95)',
    channelBackgroundHover: 'rgba(235,235,235,0.95)',
    tooltip: 'rgba(97,97,97,0.92)',
    messageBubble: 'rgba(245,245,245,0.85)',
  }
};

// Utility function to get theme-aware colors
export const getThemeColor = (theme: Theme, colorKey: keyof typeof themeColors.dark): string => {
  const isDarkMode = theme.palette.mode === 'dark';
  return isDarkMode ? themeColors.dark[colorKey] : themeColors.light[colorKey];
};

// Utility function to get theme-aware alpha colors
export const getThemeAlpha = (theme: Theme, color: 'white' | 'black', opacity: number): string => {
  const isDarkMode = theme.palette.mode === 'dark';
  return isDarkMode 
    ? alpha('#FFFFFF', opacity)
    : alpha('#000000', opacity);
};

// Utility function for theme-aware borders
export const getThemeBorder = (theme: Theme, opacity: number = 0.1): string => {
  const isDarkMode = theme.palette.mode === 'dark';
  return `1px solid ${isDarkMode ? alpha('#FFFFFF', opacity) : alpha('#000000', opacity)}`;
};

// Utility function for theme-aware gradients
export const getThemeGradient = (theme: Theme, type: 'main' | 'hover' | 'cyber' = 'main'): string => {
  const isDarkMode = theme.palette.mode === 'dark';
  
  const gradients = {
    main: 'linear-gradient(90deg, #FF69B4 0%, #1E90FF 100%)',
    hover: 'linear-gradient(90deg, #FF1493 0%, #00BFFF 100%)', 
    cyber: 'linear-gradient(45deg, #FF69B4 0%, #1E90FF 50%, #FF69B4 100%)',
  };
  
  // Light theme can have slightly muted gradients
  if (!isDarkMode && type === 'main') {
    return 'linear-gradient(90deg, #E91E63 0%, #2196F3 100%)';
  }
  
  return gradients[type];
};

// Role color utilities
export const getRoleBackgroundColor = (theme: Theme, opacity: number = 0.12): string => {
  const isDarkMode = theme.palette.mode === 'dark';
  return isDarkMode 
    ? alpha('#FF69B4', opacity)
    : alpha('#E91E63', opacity);
};

export const getRoleHoverBackgroundColor = (theme: Theme, opacity: number = 0.25): string => {
  const isDarkMode = theme.palette.mode === 'dark';
  return isDarkMode 
    ? alpha('#FF69B4', opacity)
    : alpha('#E91E63', opacity);
};