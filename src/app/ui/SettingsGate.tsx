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
    <Dialog
      open
      maxWidth="xs"
      fullWidth
      aria-labelledby="settings-gate-title"
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(5, 7, 14, 0.75)' : 'rgba(15, 23, 42, 0.4)',
          },
        },
        paper: {
          sx: {
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            background: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(12, 17, 29, 0.9)' : 'rgba(255, 255, 255, 0.92)',
            border: '1px solid',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(0, 240, 255, 0.25)' : 'rgba(0, 0, 0, 0.1)',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 0 40px rgba(0, 240, 255, 0.15), 0 20px 50px rgba(0, 0, 0, 0.7)'
                : '0 20px 50px rgba(0, 0, 0, 0.15)',
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
            backgroundImage: (theme) =>
              theme.palette.mode === 'dark'
                ? 'radial-gradient(ellipse at top, rgba(0, 240, 255, 0.08) 0%, transparent 70%)'
                : 'none',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'linear-gradient(90deg, transparent, #00F0FF, #00FFA3, transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.2), transparent)',
            },
          },
        },
      }}
    >
      <DialogTitle
        id="settings-gate-title"
        sx={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 700,
          letterSpacing: '0.04em',
          fontSize: '1.25rem',
          color: (theme) => (theme.palette.mode === 'dark' ? '#F1F5F9' : 'text.primary'),
        }}
      >
        Puzzle {puzzleNumber}
      </DialogTitle>
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
                  sx={{
                    '& .MuiSwitch-switchBase': {
                      '&.Mui-checked': {
                        color: '#00FFA3',
                        transform: 'translateX(20px)',
                        '& + .MuiSwitch-track': {
                          backgroundColor: '#00FFA3',
                          opacity: 0.35,
                        },
                        '& .MuiSwitch-thumb': {
                          backgroundColor: '#00FFA3',
                          boxShadow: '0 0 10px rgba(0, 255, 163, 0.8)',
                        },
                      },
                    },
                    '& .MuiSwitch-track': {
                      borderRadius: 16,
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.2)'
                          : 'rgba(0, 0, 0, 0.25)',
                      opacity: 0.5,
                      border: (theme) =>
                        theme.palette.mode === 'dark'
                          ? '1px solid rgba(0, 240, 255, 0.2)'
                          : undefined,
                    },
                    '& .MuiSwitch-thumb': {
                      boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    },
                  }}
                />
              }
              label="Use the house starter"
              sx={{
                '& .MuiFormControlLabel-label': {
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  letterSpacing: '0.02em',
                },
              }}
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
                  sx={{
                    '& .MuiSwitch-switchBase': {
                      '&.Mui-checked': {
                        color: '#00FFA3',
                        transform: 'translateX(20px)',
                        '& + .MuiSwitch-track': {
                          backgroundColor: '#00FFA3',
                          opacity: 0.35,
                        },
                        '& .MuiSwitch-thumb': {
                          backgroundColor: '#00FFA3',
                          boxShadow: '0 0 10px rgba(0, 255, 163, 0.8)',
                        },
                      },
                    },
                    '& .MuiSwitch-track': {
                      borderRadius: 16,
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.2)'
                          : 'rgba(0, 0, 0, 0.25)',
                      opacity: 0.5,
                      border: (theme) =>
                        theme.palette.mode === 'dark'
                          ? '1px solid rgba(0, 240, 255, 0.2)'
                          : undefined,
                    },
                    '& .MuiSwitch-thumb': {
                      boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    },
                  }}
                />
              }
              label="Hard mode"
              sx={{
                '& .MuiFormControlLabel-label': {
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  letterSpacing: '0.02em',
                },
              }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 6 }}>
              Every clue you reveal has to be used in later guesses. Fewer options, not a
              harsher score — being forced into a coin flip still counts as playing perfectly.
            </Typography>
          </Stack>

          <Alert
            severity="info"
            variant="outlined"
            sx={{
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(0, 240, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.02)',
              borderColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(0, 240, 255, 0.3)' : 'info.light',
              borderRadius: 2,
              color: 'text.secondary',
              fontSize: '0.8rem',
              lineHeight: 1.45,
              '& .MuiAlert-icon': {
                color: (theme) => (theme.palette.mode === 'dark' ? '#00F0FF' : 'info.main'),
              },
            }}
          >
            Locked for the day once you start, including across reloads. A choice you could
            take back after seeing how it went would not be much of a choice.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={() => onConfirm({ hardMode, useHouseStarter })}
          sx={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            py: 1.25,
            borderRadius: 2,
            backgroundColor: '#00FFA3',
            color: '#05070E',
            boxShadow: '0 0 16px rgba(0, 255, 163, 0.35)',
            '&:hover': {
              backgroundColor: '#33FFB5',
              boxShadow: '0 0 24px rgba(0, 255, 163, 0.55)',
            },
          }}
        >
          Start
        </Button>
      </DialogActions>
    </Dialog>
  );
}
