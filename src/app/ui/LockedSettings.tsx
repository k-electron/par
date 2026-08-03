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
      />
      <Chip
        size="small"
        variant={settings.hardMode ? 'filled' : 'outlined'}
        label={settings.hardMode ? '\u{1F512} Hard mode' : '\u{1F512} Normal mode'}
      />
      <IconButton
        size="small"
        aria-label="Why are these locked?"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ color: 'text.secondary', fontSize: '0.9rem', width: 24, height: 24 }}
      >
        ?
      </IconButton>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
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
