import { createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

const commonTheme: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
    fontSize: 13,
    h4: { fontWeight: 700, fontSize: '1.65rem', letterSpacing: '-0.01em' },
    h5: { fontWeight: 600, fontSize: '1.18rem', letterSpacing: '-0.005em' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    subtitle1: { fontWeight: 500, lineHeight: 1.5 },
    subtitle2: { fontWeight: 600, fontSize: '0.76rem', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
    body1: { fontSize: '0.9rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8rem', lineHeight: 1.55 },
    caption: { fontSize: '0.72rem', lineHeight: 1.4 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: 600,
          borderRadius: 10,
          padding: '8px 20px',
          transition: `all 0.25s ${ease}`,
        },
        contained: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
          '&:hover': {
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': {
            borderWidth: 1.5,
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          transition: `box-shadow 0.25s ${ease}, transform 0.25s ${ease}`,
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06)',
            transform: 'translateY(-2px)',
          },
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
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.72rem',
          transition: `all 0.2s ${ease}`,
        },
        label: {
          paddingLeft: 10,
          paddingRight: 10,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          fontSize: '0.76rem',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.04em',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: 600,
          fontSize: '0.84rem',
          transition: `color 0.2s ${ease}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.72rem',
          fontWeight: 500,
          padding: '6px 12px',
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: '14px !important',
          overflow: 'hidden',
          '&::before': { display: 'none' },
        },
      },
    },
  },
};

export const lightTheme = createTheme({
  ...commonTheme,
  palette: {
    mode: 'light',
    primary: { main: '#3949ab', light: '#6f74dd', dark: '#00227b' },
    secondary: { main: '#00897b', light: '#4ebaaa', dark: '#005b4f' },
    error: { main: '#d32f2f' },
    warning: { main: '#ed6c02' },
    success: { main: '#2e7d32' },
    info: { main: '#0288d1' },
    background: { default: '#f4f6fb', paper: '#ffffff' },
    grey: { 50: '#fafafa', 100: '#f5f5f5', 200: '#eeeeee', 300: '#e0e0e0', 500: '#9e9e9e', 700: '#616161', 900: '#212121' },
  },
});

export const darkTheme = createTheme({
  ...commonTheme,
  palette: {
    mode: 'dark',
    primary: { main: '#7986cb', light: '#aab6fe', dark: '#49599a' },
    secondary: { main: '#4db6ac', light: '#82e9de', dark: '#00867d' },
    error: { main: '#ef5350' },
    warning: { main: '#ff9800' },
    success: { main: '#66bb6a' },
    info: { main: '#29b6f6' },
    background: { default: '#0f1117', paper: '#1a1c2b' },
  },
});
