import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';

import { explainRound, type ExplainedFigure, type RoundToExplain } from '../copy/explainer';

/**
 * The honest, short account of why the number is what it is.
 *
 * Three constraints shape this. It has to leave someone who has never heard of
 * information theory understanding why a probe can beat a guess. It must never
 * reveal best play. And it has to answer the question a player actually arrives
 * with, which is not "how does skill work" but "why is *my* skill 86" — so the
 * round they just finished is walked through first, guess by guess, and the
 * general account follows.
 *
 * The score is optional and the dialog reads without it. A replay that is still
 * scoring, or one the scorer declined, still opens and still explains the game;
 * it simply has no round to work through. That is also what makes this reach
 * links sent before it existed: a share link carries guesses, never figures,
 * so the walkthrough is rebuilt from the same recomputed score the card is.
 *
 * The invented example below is for teaching and cannot be a real Par position:
 * it asks you to imagine three answers at once, where Par draws one a day.
 */
export function ScoringExplainer({
  open,
  onClose,
  score = null,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Deliberately narrower than `GameScore`. `RoundToExplain` omits the
   * candidate counts, so this view cannot print the size of the answer pool
   * even by accident — decision 0003, held by the type rather than by care.
   */
  score?: RoundToExplain | null;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const round = score === null ? null : explainRound(score);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>How this is scored</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            Most word games only count how many guesses you used — which mostly rewards guessing
            near the answer on turn 1. Par evaluates how well you reasoned through each position{' '}
            <em>before</em> the tiles flipped, and accounts for turn-speed and luck separately.
          </Typography>

          {round !== null && (
            <Stack spacing={2} data-testid="explainer-round">
              {/* Hero Score & Active Zone Card */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                  borderColor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        Your Round Result
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                        {round.total.figure}
                      </Typography>
                    </Box>
                    <Chip
                      label={round.zones.activeZone.label}
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        bgcolor: isDark ? round.zones.activeZone.color.dark : round.zones.activeZone.color.light,
                        color: '#fff',
                        px: 1,
                      }}
                    />
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 500, pt: 0.5 }}>
                    {round.zones.story}
                  </Typography>
                </Stack>
              </Paper>

              <Divider textAlign="left">
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                  Score Breakdown & Formula
                </Typography>
              </Divider>

              <Figure name="Skill" figure={round.skill}>
                {round.skill.shares.length > 0 && (
                  <Stack spacing={0.5} sx={{ py: 0.5 }}>
                    {round.skill.shares.map((share, index) => (
                      <Stack
                        key={`${share.guess}-${index}`}
                        direction="row"
                        spacing={1}
                        sx={{ justifyContent: 'space-between' }}
                      >
                        <Box component="span" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                          {share.guess.toUpperCase()}
                        </Box>
                        <Box component="span" sx={{ fontWeight: 700 }}>
                          {share.score}
                        </Box>
                        <Box component="span" sx={{ color: 'text.secondary' }}>
                          {share.share}
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                )}
                <Typography variant="body2">{round.skill.result}</Typography>
              </Figure>

              <Figure name="Par" figure={round.par} />
              <Figure name="Starter bonus" figure={round.bonus} />
              <Figure name="Total" figure={round.total} />

              <Divider textAlign="left">
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                  The Score Meter & Performance Zones
                </Typography>
              </Divider>

              <Stack spacing={1}>
                <Typography variant="body2">
                  The meter on your results card organizes performance into qualitative tiers, calibrated specifically for today&rsquo;s puzzle:
                </Typography>
                <Stack spacing={0.75} sx={{ pt: 0.5 }}>
                  {round.zones.zones.map((zone) => {
                    const zoneColor = isDark ? zone.color.dark : zone.color.light;
                    return (
                      <Stack
                        key={zone.id}
                        direction="row"
                        sx={{
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          px: 1.5,
                          py: 0.75,
                          borderRadius: 1.5,
                          bgcolor: zone.isCurrent
                            ? isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.05)'
                            : 'transparent',
                          border: zone.isCurrent ? `1.5px solid ${zoneColor}` : '1px solid transparent',
                        }}
                      >
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: zoneColor,
                            }}
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: zone.isCurrent ? 700 : 500 }}>
                            {zone.label}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                          {zone.minScore.toFixed(1)} &ndash; {zone.maxScore.toFixed(1)}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, lineHeight: 1.5 }}>
                  <strong>Why 100 is the anchor:</strong> Finishing in benchmark par with 100% deduction skill scores exactly {round.zones.parScore.toFixed(0)}, separating Good from Ultra. Godlike marks the theoretical ceiling for solving the puzzle in 2 sharp moves.
                </Typography>
              </Stack>

              <Divider textAlign="left">
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                  Your Guess-by-Guess Walkthrough
                </Typography>
              </Divider>

              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {round.lead}
              </Typography>

              <Stack spacing={1.5}>
                {round.guesses.map((guess) => (
                  <Paper
                    key={guess.turn}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'),
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box
                          component="span"
                          sx={{
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          Turn {guess.turn}: {guess.guess.toUpperCase()}
                        </Box>
                      </Stack>
                      <Typography variant="body2">{guess.skillStory}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {guess.luckStory}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          )}

          <Divider textAlign="left">
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
              What the Numbers Mean
            </Typography>
          </Divider>

          <Stack spacing={1.5}>
            <Stack spacing={0.25}>
              <Typography variant="subtitle2">Skill Percentage</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Measures how much each guess reduced remaining uncertainty compared to the best
                possible move, calculated before tiles turn over. Earlier deductions carry more weight
                than late-game clean-up.
              </Typography>
            </Stack>

            <Stack spacing={0.25}>
              <Typography variant="subtitle2">Par Adjustment</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Compares how many guesses you took against benchmark par (what expert play averages for
                this board). Every guess saved awards +4.0 points; each additional guess subtracts 4.0 points.
              </Typography>
            </Stack>

            <Stack spacing={0.25}>
              <Typography variant="subtitle2">Progress Lights</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Shows how much of the remaining mystery the tile feedback eliminated. Striking 100
                words off a wide-open field is easy, but narrowing 2 words to 1 settles everything.
              </Typography>
            </Stack>

            <Stack spacing={0.25}>
              <Typography variant="subtitle2">Luck</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Shows whether you got lucky with helpful tile reveals or unlucky with unhelpful clues.
                Luck is displayed for interest only — it never enters your final score.
              </Typography>
            </Stack>
          </Stack>

          <Divider textAlign="left">
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
              Why the Scoring Works This Way
            </Typography>
          </Divider>

          <Stack spacing={0.75}>
            <Typography variant="subtitle2">Why a word that cannot win can be the best play</Typography>
            <Typography variant="body2">
              Suppose you have it narrowed to three possibilities that differ only in their first
              letter &mdash; something like BATCH, CATCH and HATCH. Guess one of them and you have a
              one-in-three shot; miss, and you still have two left and have burned a turn. Now
              imagine a word that contains B, C and H somewhere else entirely. It cannot possibly be
              the answer, so it can never win on the spot &mdash; but whatever comes back, it tells
              you which of the three is right, and you finish on the very next turn.
            </Typography>
            <Typography variant="body2">
              Counting it out: the gamble finishes in two guesses a third of the time and three
              guesses the rest, so about 2.7 on average. The word that cannot win finishes in
              exactly two, every time. It is the better play, and Par says so.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">No Spoilers</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Par will never show you the word you should have played. Knowing it would not make you
              better at reading a position, and memorising it is the opposite of the point.
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * One figure from the card, with the arithmetic that produced it.
 *
 * The name and the number sit on one line so a reader can find the same pair on
 * the card above and know they are reading about the right thing.
 */
function Figure({
  name,
  figure,
  children,
}: {
  name: string;
  figure: ExplainedFigure;
  children?: ReactNode;
}) {
  return (
    <Stack spacing={0.25}>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">{name}</Typography>
        <Typography variant="subtitle2">{figure.figure}</Typography>
      </Stack>
      <Typography variant="body2">{figure.story}</Typography>
      {children}
    </Stack>
  );
}
