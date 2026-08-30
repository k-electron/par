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
  NEAR_BEST,
  REASONABLE,
  guessNote,
  skillMeterFill,
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
 * Read off the theme rather than written here, and exhaustive by type on
 * purpose: a sixth level cannot compile until this view has decided how to show
 * it, the same guarantee the badges get.
 *
 * `null` is a row deliberately left unmarked. A field already down to one word
 * had no uncertainty to remove, and such a row weighs nothing in the skill
 * average either — so a red mark would be the only judgement on screen for a
 * guess the score declines to count.
 */
const PROGRESS_COLOUR: Record<ProgressLevel, string | null> = {
  solved: 'success.main',
  major: 'success.main',
  minor: 'warning.main',
  slight: 'error.main',
  none: null,
};

/**
 * The count is the signal and the colour is the shortcut, not the other way
 * round. Roughly one man in twelve cannot separate red from green, and hue is
 * coarser than the bands anyway — `solved` and `major` are both green.
 *
 * Four pips are still a band and never a count of words; decision 0003 has why
 * the pool's size stays ours.
 */
const PROGRESS_PIPS: Record<ProgressLevel, number> = {
  solved: 4,
  major: 3,
  minor: 2,
  slight: 1,
  none: 0,
};

const PIPS = [0, 1, 2, 3];

/** Shared by both meters so the columns line up down the table. */
const METER_WIDTH = 46;
const METER_HEIGHT = 6;

/**
 * Off the screen, still in the accessibility tree.
 *
 * Every phrase this table stopped drawing is still rendered through one of
 * these. A meter means nothing to a screen reader, and the words were the whole
 * signal before there were meters to replace them.
 */
const HIDDEN = {
  position: 'absolute',
  width: 1,
  height: 1,
  p: 0,
  m: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

function ProgressPips({ level }: { level: ProgressLevel }) {
  const colour = PROGRESS_COLOUR[level];
  const lit = PROGRESS_PIPS[level];

  return (
    <Stack direction="row" spacing={0.25} sx={{ justifyContent: 'flex-end', py: 0.5 }}>
      {PIPS.map((pip) => (
        <Box
          key={pip}
          aria-hidden
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: pip < lit ? (colour ?? 'transparent') : 'transparent',
            border: pip < lit ? undefined : '1px solid',
            borderColor: pip < lit ? undefined : 'divider',
          }}
        />
      ))}
      <Box component="span" sx={HIDDEN}>
        {PROGRESS[level]}
      </Box>
    </Stack>
  );
}

/**
 * Banded on `guessNote`'s own thresholds, so the bar and the phrase it replaced
 * cannot disagree about a row.
 *
 * A forced move greys its fill instead: the position offered no real choice, so
 * whatever the number came out at was the position's doing and not the player's
 * — the same reason the pips go unlit on a field of one.
 */
function SkillMeter({
  skill,
  forced,
  note,
}: {
  skill: number | null;
  forced: boolean;
  note: string;
}) {
  return (
    <Stack spacing={0.25} sx={{ alignItems: 'flex-end' }}>
      {/*
        An unscored row is outlined rather than filled. Flooring the track means
        a row at the floor draws nothing, and a solid empty track would then read
        the same as an opener that was never measured — one is the worst score
        available, the other is no score at all.
      */}
      <Box
        aria-hidden
        sx={{
          width: METER_WIDTH,
          height: METER_HEIGHT,
          borderRadius: METER_HEIGHT,
          bgcolor: skill === null ? 'transparent' : 'action.hover',
          border: skill === null ? '1px dashed' : undefined,
          borderColor: skill === null ? 'divider' : undefined,
          overflow: 'hidden',
        }}
      >
        {skill !== null && (
          <Box
            sx={{
              width: `${skillMeterFill(skill)}%`,
              height: '100%',
              borderRadius: METER_HEIGHT,
              bgcolor: forced
                ? 'text.disabled'
                : skill >= NEAR_BEST
                  ? 'success.main'
                  : skill >= REASONABLE
                    ? 'warning.main'
                    : 'error.main',
            }}
          />
        )}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.2 }}>
        {skill === null ? '\u2014' : `${skill.toFixed(0)}%`}
      </Typography>
      <Box component="span" sx={HIDDEN}>
        {note}
      </Box>
    </Stack>
  );
}

/**
 * Where the bar is full. `luckNote` calls a bit either way hot or cold, so
 * twice that leaves the extremes somewhere to go without flattening every
 * ordinary row into a stub.
 */
const LUCK_FULL = 2;

/**
 * Amber and blue, deliberately not green and red. Luck never reaches a total,
 * so colouring a hot row like a good one would make the round's one display-only
 * figure look like the verdict on it.
 */
function LuckMeter({ bits, note }: { bits: number; note: string }) {
  const hot = bits >= 0;
  const share = Math.min(Math.abs(bits) / LUCK_FULL, 1) * 50;

  return (
    <Stack spacing={0.25} sx={{ alignItems: 'flex-end' }}>
      <Box
        aria-hidden
        sx={{
          position: 'relative',
          width: METER_WIDTH,
          height: METER_HEIGHT,
          borderRadius: METER_HEIGHT,
          bgcolor: 'action.hover',
        }}
      >
        {/* The zero mark, so a round that broke as expected shows something. */}
        <Box
          sx={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: '1px', bgcolor: 'divider' }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(hot ? { left: '50%' } : { right: '50%' }),
            width: `${share}%`,
            borderRadius: METER_HEIGHT,
            bgcolor: hot ? 'warning.main' : 'info.main',
          }}
        />
      </Box>
      <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.2 }}>
        {hot ? '+' : ''}
        {bits.toFixed(1)}
      </Typography>
      <Box component="span" sx={HIDDEN}>
        {note}
      </Box>
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
                  <Box
                    component="span"
                    sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  >
                    {row.guess}
                  </Box>
                </TableCell>
                <TableCell sx={{ px: 0.5 }} align="right">
                  {/*
                    How far this guess got, in bands rather than in words. The
                    row still describes its own guess; it simply says so without
                    handing over the size of the answer pool. `progressLevel`
                    has the argument.
                  */}
                  <ProgressPips level={progress} />
                </TableCell>
                <TableCell sx={{ px: 0.5 }} align="right">
                  {/*
                    The note that used to sit under the word lives here. Every
                    branch of it but `forced` and the unscored pair is a band of
                    this very number, so on the page it restated the score in
                    words, once per row.
                  */}
                  <SkillMeter
                    skill={row.skill}
                    forced={row.forced}
                    note={guessNote(row.skill, row.forced, row.turn, row.candidateCount)}
                  />
                </TableCell>
                <TableCell sx={{ px: 0.5 }} align="right">
                  <LuckMeter bits={row.luck} note={luckNote(row.luck)} />
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
