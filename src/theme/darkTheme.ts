import { createTheme } from '@mui/material/styles';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#66BB6A',
      light: '#81C784',
      dark: '#43A047',
      contrastText: '#000',
    },
    secondary: {
      main: '#FF7043',
      light: '#FFB74D',
      dark: '#F4511E',
      contrastText: '#000',
    },
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      disabled: '#616161',
    },
    divider: '#424242',
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#1E1E1E',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
        },
      },
    },
  },
});

export default darkTheme;