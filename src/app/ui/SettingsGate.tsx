import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import type { Preferences } from '../storage/repository';

export interface SettingsGateProps {
  readonly puzzleNumber: number;
  /** Pre-filled from remembered preferences, so a regular just clicks through. */
  readonly initial: Preferences;
  readonly onConfirm: (settings: Preferences) => void;
}

/**
 * The daily settings confirmation.
 *
 * This is the mechanic, not a form. Philosophy position 3: the house-starter
 * bonus pays for a blind commitment, so the day's starter must not be
 * discoverable here — if you could see it and then decline, the bonus would be
 * free money. Nothing in this component receives the starter word.
 */
export function SettingsGate({ puzzleNumber, initial, onConfirm }: SettingsGateProps) {
  const [hardMode, setHardMode] = useState(initial.hardMode);
  const [useHouseStarter, setUseHouseStarter] = useState(initial.useHouseStarter);

  return (
    // No `onClose`: there is deliberately no way out of this dialog but
    // choosing. Escape and backdrop clicks have nothing to call, so the
    // commitment cannot be skipped.
    <Dialog open maxWidth="xs" fullWidth aria-labelledby="settings-gate-title">
      <DialogTitle id="settings-gate-title">Puzzle {puzzleNumber}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Pick how you are playing today. Both choices lock once you start.
        </DialogContentText>

        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={useHouseStarter}
                  onChange={(event) => setUseHouseStarter(event.target.checked)}
                />
              }
              label="Use the house starter"
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 6 }}>
              Everyone gets the same opener, played for you, sight unseen. Worth a small bonus
              for taking the bet. Turn it off to bring your own opener and forgo the bonus.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={hardMode}
                  onChange={(event) => setHardMode(event.target.checked)}
                />
              }
              label="Hard mode"
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 6 }}>
              Every clue you reveal has to be used in later guesses. Fewer options, not a
              harsher score — being forced into a coin flip still counts as playing perfectly.
            </Typography>
          </Stack>

          <Alert severity="info" variant="outlined">
            Locked for the day once you start, including across reloads. A choice you could
            take back after seeing how it went would not be much of a choice.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={() => onConfirm({ hardMode, useHouseStarter })}
        >
          Start
        </Button>
      </DialogActions>
    </Dialog>
  );
}
