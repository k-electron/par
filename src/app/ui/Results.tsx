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
  RESULTS,
  ROUND,
  fieldNote,
  guessNote,
  headline,
  luckNote,
  parPhrase,
  resultsBadges,
  skillPhrase,
  type RoundVariant,
} from '../copy/results';
import { PAR } from '../../engine/config/constants';
import { WIN_PATTERN } from '../../engine/words/pattern';
import { fieldFill } from './field';
import type { GameScore } from '../scoring/protocol';
import type { ConfirmedSettings } from '../storage/repository';

export interface ResultsProps {
  readonly score: GameScore | null;
  readonly settings: ConfirmedSettings;
  /** Whose round this is. Only the second-person phrasing changes. */
  readonly variant?: RoundVariant;
}

/**
 * How much of the field is still standing, as a length rather than a number.
 *
 * Decorative, and `aria-hidden` for that reason: it is a second presentation of
 * a chain the captions beneath it already state row by row, so a screen reader
 * reading down the column gets the same narrowing without hearing every row
 * described twice.
 */
function FieldBar({ fill }: { fill: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: '100%',
        maxWidth: 56,
        height: 4,
        borderRadius: 1,
        // Semantic tokens rather than a new colour, so the bar follows the
        // appearance setting and owes nothing to the tile palette.
        bgcolor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/*
        `style` rather than `sx` for the width alone: it is data, and it differs
        on every row, so `sx` would compile a fresh class for each one. It also
        leaves the drawn length legible to a test, which a generated class does
        not.
      */}
      <Box
        data-testid="field-bar"
        style={{ width: `${fill * 100}%` }}
        sx={{ height: '100%', bgcolor: 'text.secondary' }}
      />
    </Box>
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

  // The field every bar is drawn against: everything that was possible before a
  // guess had been played. Read off the first row rather than from the word
  // list, so the proportions describe the round as it was scored — a replay of
  // an older list included.
  const startingField = score.breakdown[0]?.candidateCount ?? 0;

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
                {RESULTS.columns.field}
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
              const note = fieldNote(
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
                    What this guess did to the field, and how much of it is left
                    — both as proportions, never as counts. The row still
                    describes its own guess; it simply says so without handing
                    over the size of the answer pool. `fieldNote` has the
                    argument.
                  */}
                  <Stack spacing={0.25} sx={{ alignItems: 'flex-end' }}>
                    <FieldBar fill={fieldFill(row.remainingCount, startingField)} />
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {note}
                    </Typography>
                  </Stack>
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
