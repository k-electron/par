import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import { useState } from 'react';

import type { AppearancePreferences } from '../theme/theme';

export interface AppearanceMenuProps {
  readonly preferences: AppearancePreferences;
  readonly onChange: (preferences: AppearancePreferences) => void;
}

/**
 * Appearance options: light or dark, and the colourblind-safe tile palette.
 *
 * Reduced motion is not here on purpose — it follows the operating system
 * setting, which is where a person has already said what they want, and asking
 * again would be worse than not asking.
 */
export function AppearanceMenu({ preferences, onChange }: AppearanceMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const light = preferences.appearance === 'light';
  const accessible = preferences.tilePalette === 'accessible';

  return (
    <>
      <IconButton
        size="small"
        aria-label="Appearance"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ color: 'text.secondary' }}
      >
        <Box aria-hidden component="span" sx={{ fontSize: '1rem', lineHeight: 1 }}>
          &#9788;
        </Box>
      </IconButton>

      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => onChange({ ...preferences, appearance: light ? 'dark' : 'light' })}
        >
          <ListItemText primary="Light theme" />
          <Switch
            checked={light}
            slotProps={{ input: { 'aria-label': 'Light theme' } }}
            onChange={() => onChange({ ...preferences, appearance: light ? 'dark' : 'light' })}
          />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() =>
            onChange({ ...preferences, tilePalette: accessible ? 'classic' : 'accessible' })
          }
        >
          <ListItemText
            primary="High-contrast tiles"
            secondary="Orange and blue instead of green and yellow"
          />
          <Switch
            checked={accessible}
            slotProps={{ input: { 'aria-label': 'High-contrast tiles' } }}
            onChange={() =>
              onChange({ ...preferences, tilePalette: accessible ? 'classic' : 'accessible' })
            }
          />
        </MenuItem>
      </Menu>
    </>
  );
}
