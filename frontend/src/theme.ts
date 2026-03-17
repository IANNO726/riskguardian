import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00D9FF',
      light: '#5DFDFF',
      dark: '#00A7CC',
    },
    secondary: {
      main: '#9C27FF',
      light: '#C158FF',
      dark: '#7600CC',
    },
    success: {
      main: '#00E676',
      light: '#69F0AE',
      dark: '#00C853',
    },
    error: {
      main: '#FF1744',
      light: '#FF5252',
      dark: '#D50000',
    },
    warning: {
      main: '#FFC400',
      light: '#FFD740',
      dark: '#FF9100',
    },
    background: {
      default: '#0A0E27',
      paper: '#131842',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B8C4',
    },
  },

  shape: {
    borderRadius: 16,
  },

  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      fontSize: '2rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          transition: 'background-color 0.2s ease, color 0.2s ease',
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(135deg, #131842 0%, #1a1f4d 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(135deg, #131842 0%, #1a1f4d 100%)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(0, 217, 255, 0.05)',
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        },
        head: {
          fontWeight: 700,
          color: '#5DFDFF',
        },
      },
    },
  },
});

export default theme;
