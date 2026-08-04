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
  guessNote,
  headline,
  luckNote,
  parPhrase,
  poolNote,
  resultsBadges,
  skillPhrase,
  type RoundVariant,
} from '../copy/results';
import { PAR } from '../../engine/config/constants';
import type { GameScore } from '../scoring/protocol';
import type { ConfirmedSettings } from '../storage/repository';

export interface ResultsProps {
  readonly score: GameScore | null;
  readonly settings: ConfirmedSettings;
  /** Whose round this is. Only the second-person phrasing changes. */
  readonly variant?: RoundVariant;
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
                {RESULTS.columns.candidates}
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
            {score.breakdown.map((row) => (
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
                    The count the guess left behind, not the one it started
                    from, so the row describes its own guess. The caption keeps
                    the starting point, which is what makes the figure mean
                    something.
                  */}
                  <Stack spacing={0} sx={{ alignItems: 'flex-end' }}>
                    <Box component="span">{row.remainingCount}</Box>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {poolNote(row.candidateCount, row.remainingCount)}
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
            ))}
          </TableBody>
        </Table>
      </Stack>
    </Stack>
  );
}
