import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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
  const round = score === null ? null : explainRound(score);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>How this is scored</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2">
            Ordinary word games score how few guesses you took, which is mostly a question of
            whether your opener happened to land near the answer. Par scores what each guess was
            worth <em>before</em> the tiles turned over, and then pays out the luck separately.
          </Typography>

          {round !== null && (
            <Stack spacing={1.5} data-testid="explainer-round">
              <Divider textAlign="left">
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  This round, number by number
                </Typography>
              </Divider>

              <Typography variant="body2">{round.lead}</Typography>

              <Stack spacing={1.25}>
                {round.guesses.map((guess) => (
                  <Stack key={guess.turn} spacing={0}>
                    <Box
                      component="span"
                      sx={{
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {guess.guess}
                    </Box>
                    <Typography variant="body2">{guess.skillStory}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {guess.luckStory}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Figure name="Skill" figure={round.skill}>
                {round.skill.shares.length > 0 && (
                  <Stack spacing={0} sx={{ py: 0.5 }}>
                    {round.skill.shares.map((share, index) => (
                      <Stack
                        key={`${share.guess}-${index}`}
                        direction="row"
                        spacing={1}
                        sx={{ justifyContent: 'space-between' }}
                      >
                        <Box
                          component="span"
                          sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
                        >
                          {share.guess}
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
            </Stack>
          )}

          <Divider textAlign="left">
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Why the scoring works this way
            </Typography>
          </Divider>

          <Stack spacing={0.5}>
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
            <Typography variant="subtitle2">Skill cannot see what happened</Typography>
            <Typography variant="body2">
              Each guess is measured against the best that was available in that exact position, so
              getting lucky cannot raise it and getting unlucky cannot lower it. Your opening guess
              is never scored: whatever you open with, good or wild, expresses itself through the
              position it leaves you, and that is priced by par instead. It is why a lucky opener is
              a legitimate win here rather than a loophole.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Par is set by strong play</Typography>
            <Typography variant="body2">
              Par is what a strong player averages, not what a typical player averages, so being
              over it is the normal state of affairs rather than a telling-off. Every guess under
              par is worth the same as every other, which is deliberate: it means a gamble can win
              you a day but never a season. Finishing fast earns a badge, never extra points.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">The progress light</Typography>
            <Typography variant="body2">
              The light beside each guess is how much of what was still unknown it cleared away, so
              striking a hundred words off a wide-open field counts for very little while narrowing
              two possibilities down to one counts for everything. It describes what the tiles did,
              not how well you chose &mdash; a well-judged guess can light red when the feedback
              breaks badly. It is also why a perfectly good opener often shows amber: it does a
              great deal of work and still leaves most of the guessing to do. A guess with only one
              word left to play gets no light at all, because there was nothing left to clear.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Luck counts for nothing</Typography>
            <Typography variant="body2">
              The luck figure says how the feedback broke against what your guess could reasonably
              expect. Positive means the tiles were kind. It is there to talk about: it never enters
              a total, and across every answer a guess could have faced it averages out to zero.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">The house starter</Typography>
            <Typography variant="body2">
              Everyone who takes it plays the same opener, chosen before you could see it, and
              earns a small bonus for taking that bet blind. That is the whole reason your choice
              locks for the day: a bet you could withdraw after peeking would not be one.
            </Typography>
          </Stack>

          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Par will never show you the word you should have played. Knowing it would not make you
            better at reading a position, and memorising it is the opposite of the point.
          </Typography>
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
