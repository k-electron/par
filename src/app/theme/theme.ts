import { createTheme } from '@mui/material/styles';

/**
 * Dark is the default and, for now, the only palette. Increment 11 owns the
 * light theme and the colorblind-safe option, so nothing here should grow a
 * mode switch before then.
 */
export const theme = createTheme({
  palette: {
    mode: 'dark',
  },
  typography: {
    fontFamily: [
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});
