import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { PlayerStats } from '../state/stats';

function Figure({
  label,
  value,
  emphasis,
}: {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}) {
  return (
    <Stack spacing={0} sx={{ alignItems: 'center', flex: '1 1 0', minWidth: 72 }}>
      <Typography
        variant={emphasis === true ? 'h5' : 'h6'}
        sx={{ fontWeight: 700, lineHeight: 1.2 }}
      >
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        {label}
      </Typography>
    </Stack>
  );
}

function Distribution({ counts }: { readonly counts: readonly number[] }) {
  const most = Math.max(1, ...counts);

  return (
    <Stack spacing={0.5}>
      {counts.map((count, index) => (
        <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" sx={{ width: 12, color: 'text.secondary' }}>
            {index + 1}
          </Typography>
          <Box
            sx={{
              // A zero-width bar reads as a rendering fault, so an empty row
              // keeps a sliver.
              width: `${Math.max(2, (100 * count) / most)}%`,
              backgroundColor: count > 0 ? 'success.main' : 'action.disabledBackground',
              borderRadius: 0.5,
              px: 0.75,
              textAlign: 'right',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {count}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

export function StatsPanel({ stats }: { readonly stats: PlayerStats }) {
  if (stats.played === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
        Nothing here yet. Finish a round and it will start filling in.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {/*
        Averages lead. A single day is meant to be spiky — that is what makes a
        lucky round fun — so the honest measure of how someone plays is the mean
        over time, not their best day.
      */}
      <Stack direction="row" sx={{ justifyContent: 'space-around' }}>
        <Figure
          emphasis
          label="average total"
          value={stats.averageTotal === null ? '\u2014' : stats.averageTotal.toFixed(1)}
        />
        <Figure
          emphasis
          label="average skill"
          value={stats.averageSkill === null ? '\u2014' : `${stats.averageSkill.toFixed(0)}%`}
        />
      </Stack>

      <Divider />

      <Stack direction="row" sx={{ justifyContent: 'space-around', flexWrap: 'wrap', rowGap: 1 }}>
        <Figure label="played" value={String(stats.played)} />
        <Figure
          label="solved"
          value={stats.solveRate === null ? '\u2014' : `${stats.solveRate.toFixed(0)}%`}
        />
        <Figure
          label="average guesses"
          value={stats.averageGuesses === null ? '\u2014' : stats.averageGuesses.toFixed(2)}
        />
        <Figure label="streak" value={String(stats.currentStreak)} />
      </Stack>

      <Divider />

      <Stack spacing={0.75}>
        <Typography variant="subtitle2">Guess distribution</Typography>
        <Distribution counts={stats.distribution} />
      </Stack>
    </Stack>
  );
}

export function StatsDialog({
  open,
  stats,
  onClose,
}: {
  readonly open: boolean;
  readonly stats: PlayerStats;
  readonly onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Your record</DialogTitle>
      <DialogContent dividers>
        <StatsPanel stats={stats} />
      </DialogContent>
    </Dialog>
  );
}

export function StatsButton({ onOpen }: { readonly onOpen: () => void }) {
  return (
    <IconButton
      size="small"
      aria-label="Your record"
      onClick={onOpen}
      sx={{ color: 'text.secondary' }}
    >
      <Box aria-hidden component="span" sx={{ fontSize: '1rem', lineHeight: 1 }}>
        &#128202;
      </Box>
    </IconButton>
  );
}
