import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function App() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Typography
            component="h1"
            variant="h2"
            sx={{ fontWeight: 700, letterSpacing: '0.05em' }}
          >
            Par
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            A daily word game that scores the quality of your decisions rather than the luck of
            your outcomes.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Scaffold only. The board, the scoring engine and the daily puzzle arrive in later
            increments.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
