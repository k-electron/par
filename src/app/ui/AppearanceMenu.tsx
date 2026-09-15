import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import { Sun } from 'lucide-react';
import { useState } from 'react';

import { sciFiSwitchSx, type AppearancePreferences } from '../theme/theme';

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
        sx={{
          color: (theme) => (theme.palette.mode === 'dark' ? '#00F0FF' : 'text.secondary'),
          transition: 'all 0.2s ease',
          '&:hover': {
            color: '#00FFA3',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark' ? '0 0 10px rgba(0, 255, 163, 0.4)' : undefined,
          },
        }}
      >
        <Box
          aria-hidden
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}
        >
          <Sun size={18} aria-hidden />
        </Box>
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
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
                theme.palette.mode === 'dark' ? 'rgba(0, 240, 255, 0.2)' : 'divider',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
              borderRadius: 2,
              minWidth: 260,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => onChange({ ...preferences, appearance: light ? 'dark' : 'light' })}
        >
          <ListItemText primary="Light theme" />
          <Switch
            checked={light}
            slotProps={{ input: { 'aria-label': 'Light theme' } }}
            onChange={() => onChange({ ...preferences, appearance: light ? 'dark' : 'light' })}
            sx={sciFiSwitchSx}
          />
        </MenuItem>
        <Divider
          sx={{
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(0, 240, 255, 0.14)' : 'divider',
          }}
        />
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
            sx={sciFiSwitchSx}
          />
        </MenuItem>
      </Menu>
    </>
  );
}
