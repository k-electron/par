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

import { BADGES, RESULTS, guessNote, headline, luckNote, parPhrase, skillPhrase } from '../copy/results';
import { PAR } from '../../engine/config/constants';
import type { GameScore } from '../scoring/protocol';
import type { ConfirmedSettings } from '../storage/repository';

export interface ResultsProps {
  readonly score: GameScore | null;
  readonly settings: ConfirmedSettings;
}

/** Celebratory badges. Cosmetic by design — they must never carry points. */
function badgesFor(score: GameScore, settings: ConfirmedSettings): string[] {
  const badges: string[] = [
    settings.useHouseStarter ? BADGES.houseStarter : BADGES.ownOpener,
    ...(settings.hardMode ? [BADGES.hardMode] : []),
    score.solved ? BADGES.solved : BADGES.unsolved,
  ];

  if (score.solved && score.guessesUsed === 1) badges.push(BADGES.holeInOne);
  else if (score.solved && score.guessesUsed <= 3) badges.push(BADGES.quickRound);
  if (score.solved && score.skill >= 97) badges.push(BADGES.cleanRound);

  return badges;
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

export function Results({ score, settings }: ResultsProps) {
  if (score === null) {
    return (
      <Stack spacing={1} sx={{ alignItems: 'center', py: 3 }} aria-busy="true">
        <CircularProgress size={22} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Working out your round&hellip;
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ width: '100%' }}>
      <Stack spacing={0.5} sx={{ textAlign: 'center' }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          {RESULTS.title}
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

      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {badgesFor(score, settings).map((badge) => (
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
                  {row.candidateCount}
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
