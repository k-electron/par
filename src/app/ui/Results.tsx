import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import {
  PROGRESS,
  RESULTS,
  ROUND,
  guessNote,
  headline,
  luckNote,
  parPhrase,
  progressLevel,
  resultsBadges,
  skillPhrase,
  type ProgressLevel,
  type RoundVariant,
} from '../copy/results';
import { PAR } from '../../engine/config/constants';
import { WIN_PATTERN } from '../../engine/words/pattern';
import type { GameScore } from '../scoring/protocol';
import type { ConfirmedSettings } from '../storage/repository';

export interface ResultsProps {
  readonly score: GameScore | null;
  readonly settings: ConfirmedSettings;
  /** Whose round this is. Only the second-person phrasing changes. */
  readonly variant?: RoundVariant;
}

/**
 * The colour of each light, read off the theme rather than written here.
 *
 * Exhaustive by type on purpose: a fourth level cannot compile until this view
 * has decided how to show it, the same guarantee the badges get.
 *
 * `null` is a light deliberately not lit. A field already down to one word had
 * no uncertainty to remove, and marking that red would be a verdict on a guess
 * the scorer itself prices at nothing.
 */
const PROGRESS_COLOUR: Record<ProgressLevel, string | null> = {
  solved: 'success.main',
  major: 'success.main',
  minor: 'warning.main',
  slight: 'error.main',
  none: null,
};

/**
 * A light and the words for it.
 *
 * Never colour alone. Roughly one man in twelve cannot separate red from green,
 * which is why the board ships a high-contrast palette at all — a signal carried
 * only in hue would undo that. The phrase beneath is the signal; the colour makes
 * it quick to read down the column.
 */
function ProgressLight({ level }: { level: ProgressLevel }) {
  const colour = PROGRESS_COLOUR[level];

  return (
    <Stack spacing={0} sx={{ alignItems: 'flex-end' }}>
      <Box
        aria-hidden
        sx={{
          width: 10,
          height: 10,
          my: 0.375,
          borderRadius: '50%',
          bgcolor: colour ?? 'transparent',
          border: colour === null ? '1px solid' : undefined,
          borderColor: colour === null ? 'divider' : undefined,
        }}
      />
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {PROGRESS[level]}
      </Typography>
    </Stack>
  );
}

function Figure({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <Stack spacing={0} sx={{ alignItems: 'center', flex: '1 1 0' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
      {caption !== undefined && (
        <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
          {caption}
        </Typography>
      )}
    </Stack>
  );
}

export function Results({ score, settings, variant = 'own' }: ResultsProps) {
  const words = ROUND[variant];

  if (score === null) {
    return (
      <Stack spacing={1} sx={{ alignItems: 'center', py: 3 }} aria-busy="true">
        <CircularProgress size={22} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {words.pending}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ width: '100%' }}>
      <Stack spacing={0.5} sx={{ textAlign: 'center' }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          {words.title}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {score.total.toFixed(1)}
        </Typography>
        <Typography variant="body2">
          {skillPhrase(score.skill)}, {parPhrase(score.guessesUsed, PAR, score.solved)}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {headline(score.skill, score.solved)}
        </Typography>
      </Stack>

      <Stack
        direction="row"
        spacing={0.5}
        data-testid="badges"
        sx={{ flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {resultsBadges(score, settings).map((badge) => (
          <Chip key={badge} size="small" label={badge} variant="outlined" />
        ))}
      </Stack>

      <Divider />

      <Stack direction="row" sx={{ justifyContent: 'space-around' }}>
        <Figure label={RESULTS.skillLabel} value={`${score.skill.toFixed(0)}%`} />
        <Figure
          label={RESULTS.parLabel}
          value={score.outcome >= 0 ? `+${score.outcome.toFixed(1)}` : score.outcome.toFixed(1)}
          caption={score.solved ? `${score.guessesUsed} guesses` : RESULTS.unsolved}
        />
        {score.starterBonus > 0 && (
          <Figure label={RESULTS.bonusLabel} value={`+${score.starterBonus.toFixed(0)}`} />
        )}
      </Stack>

      <Divider />

      <Stack spacing={0.5}>
        <Typography variant="subtitle2">{RESULTS.breakdownTitle}</Typography>
        <Table size="small" aria-label={RESULTS.breakdownTitle}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ px: 0.5 }}>{RESULTS.columns.turn}</TableCell>
              <TableCell sx={{ px: 0.5 }} align="right">
                {RESULTS.columns.progress}
              </TableCell>
              <TableCell sx={{ px: 0.5 }} align="right">
                {RESULTS.columns.skill}
              </TableCell>
              <TableCell sx={{ px: 0.5 }} align="right">
                {RESULTS.columns.luck}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {score.breakdown.map((row) => {
              const progress = progressLevel(
                row.candidateCount,
                row.remainingCount,
                row.pattern === WIN_PATTERN,
              );

              return (
              <TableRow key={row.turn}>
                <TableCell sx={{ px: 0.5 }}>
                  <Stack spacing={0}>
                    <Box
                      component="span"
                      sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                      {row.guess}
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {guessNote(row.skill, row.forced, row.turn, row.candidateCount)}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ px: 0.5 }} align="right">
                  {/*
                    How far this guess got, in bands rather than in words. The
                    row still describes its own guess; it simply says so without
                    handing over the size of the answer pool. `progressLevel`
                    has the argument.
                  */}
                  <ProgressLight level={progress} />
                </TableCell>
                <TableCell sx={{ px: 0.5 }} align="right">
                  {row.skill === null ? '\u2014' : `${row.skill.toFixed(0)}%`}
                </TableCell>
                <TableCell sx={{ px: 0.5 }} align="right">
                  <Stack spacing={0} sx={{ alignItems: 'flex-end' }}>
                    <Box component="span">
                      {row.luck >= 0 ? '+' : ''}
                      {row.luck.toFixed(1)}
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {luckNote(row.luck)}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Stack>
    </Stack>
  );
}
