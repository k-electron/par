import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import type { ConfirmedSettings } from '../storage/repository';

/**
 * The day's settings, shown as locked.
 *
 * Spec §6 wants the lock visible with an explanation available, so the chips
 * carry a padlock and the button explains why rather than leaving it to feel
 * like the app being stubborn.
 */
export function LockedSettings({ settings }: { readonly settings: ConfirmedSettings }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', justifyContent: 'center' }}>
      <Chip
        size="small"
        variant={settings.useHouseStarter ? 'filled' : 'outlined'}
        label={settings.useHouseStarter ? '\u{1F512} House starter' : '\u{1F512} Own opener'}
        sx={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.03em',
          fontSize: '0.75rem',
          ...(settings.useHouseStarter
            ? {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(0, 240, 255, 0.12)' : undefined,
                border: '1px solid',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(0, 240, 255, 0.35)' : 'transparent',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark' ? '0 0 8px rgba(0, 240, 255, 0.15)' : undefined,
                color: (theme) => (theme.palette.mode === 'dark' ? '#F1F5F9' : undefined),
              }
            : {
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.18)' : 'divider',
              }),
        }}
      />
      <Chip
        size="small"
        variant={settings.hardMode ? 'filled' : 'outlined'}
        label={settings.hardMode ? '\u{1F512} Hard mode' : '\u{1F512} Normal mode'}
        sx={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.03em',
          fontSize: '0.75rem',
          ...(settings.hardMode
            ? {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255, 184, 0, 0.12)' : undefined,
                border: '1px solid',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255, 184, 0, 0.35)' : 'transparent',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark' ? '0 0 8px rgba(255, 184, 0, 0.15)' : undefined,
                color: (theme) => (theme.palette.mode === 'dark' ? '#F1F5F9' : undefined),
              }
            : {
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.18)' : 'divider',
              }),
        }}
      />
      <IconButton
        size="small"
        aria-label="Why are these locked?"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          color: (theme) => (theme.palette.mode === 'dark' ? '#00F0FF' : 'text.secondary'),
          fontSize: '0.85rem',
          fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace',
          width: 22,
          height: 22,
          border: '1px solid',
          borderColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(0, 240, 255, 0.25)' : 'divider',
          borderRadius: '50%',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: '#00F0FF',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark' ? '0 0 8px rgba(0, 240, 255, 0.4)' : undefined,
          },
        }}
      >
        ?
      </IconButton>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(12, 17, 29, 0.95)'
                  : 'rgba(255, 255, 255, 0.95)',
              border: '1px solid',
              borderColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(0, 240, 255, 0.25)' : 'divider',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              borderRadius: 2,
            },
          },
        }}
      >
        <Typography variant="body2" sx={{ p: 2, maxWidth: 300 }}>
          You picked these before seeing today&rsquo;s starter, and they stay put until tomorrow.
          The starter bonus is paid for taking that bet blind — being able to peek and then
          change your mind would turn it into free money. Your preferences carry over to
          tomorrow, where you can change them again.
        </Typography>
      </Popover>
    </Stack>
  );
}
